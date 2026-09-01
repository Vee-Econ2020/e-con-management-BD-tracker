from __future__ import annotations

import os
import re
import uuid
import json
import time
import inspect
import asyncio
from datetime import datetime
from typing import List, Optional, Dict, Any

import pandas as pd
import numpy as np
from fastapi import APIRouter, Depends, HTTPException, Header, Query
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field
from dotenv import load_dotenv

import google.generativeai as genai

from routers.auth import get_current_user, get_optional_current_user, _get_db
import slides_compute
from context import target_week_var

load_dotenv()

router = APIRouter()

MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "DB_tracker")


def get_db():
    return AsyncIOMotorClient(MONGODB_URL)[DB_NAME]


# ─── MODELS ─────────────────────────────────────────────────────────────

class AiConfigPayload(BaseModel):
    api_key: Optional[str] = None
    model_name: str = "gemini-2.0-flash"
    agent_name: str = "e-con BD Analyst"
    system_prompt: Optional[str] = None
    visibility_mode: str = "permitted"  # "admin_only", "permitted", "all", "disabled"


class TestConnectionPayload(BaseModel):
    api_key: Optional[str] = None
    model_name: Optional[str] = None


class ChatMessageRequest(BaseModel):
    session_id: Optional[str] = None
    message: str
    week: Optional[int] = None
    active_region: Optional[str] = None
    active_slide_id: Optional[str] = None
    fy: Optional[str] = "FY2027"


class FeedbackPayload(BaseModel):
    session_id: str
    message_id: str
    rating: str  # "useful" or "not_useful"
    comment: Optional[str] = None


# ─── DEFAULT PROMPT ───────────────────────────────────────────────────────

DEFAULT_SYSTEM_PROMPT = """You are the official e-con Systems Weekly Tracker AI Business Intelligence Assistant.
Your primary role is to answer questions, analyze trends, and provide summaries based EXCLUSIVELY on the Weekly Tracker and Business Development dataset of e-con Systems.

STRICT DOMAIN GUARDRAILS:
1. You only answer questions related to e-con Systems weekly tracker metrics, regional performance, sales pipeline, Whale accounts, targets, invoicing, order backlogs, and manual slide notes/inputs.
2. If a user asks general world knowledge, politics, sports, entertainment, or any query unrelated to e-con Systems Weekly Tracker (e.g. "Who is Donald Trump?", "Tell me a joke"), you MUST politely decline with:
   "I am specialized exclusively for e-con Systems Weekly Tracker data and business development metrics. I cannot assist with topics outside this scope."
3. You have read-only database query, aggregation, and computation capabilities via tools. When a user asks about any metric, region, company/customer name, or slide activity, ALWAYS use the appropriate tool to query the live data.
4. EFFICIENCY & IMMEDIATE SYNTHESIS RULE:
   - Call the most specific tool directly in your very first turn (e.g., `get_dashboard_summary` for executive KPIs, `get_order_backlogs` for backlogs).
   - Once you receive the tool response, IMMEDIATELY synthesize and output your final structured answer. DO NOT loop or make repetitive queries.
5. Format your answers clearly with bullet points, structured sections, and markdown tables where suitable. Always specify the financial year or week number if relevant.

AVAILABLE TOOLS & STRATEGY PLAYBOOK:
1. `get_dashboard_summary`:
   - USE FOR: Executive KPI overviews, total PO won till now, cumulative performance, overall pipeline forecast, Base Target vs Stretch Target, total invoiced revenue, achievement percentages, and deficits.
   - Example Questions: "What is the total PO won till now in FY2027?", "What is our stretch target and deficit?", "How much have we invoiced so far?"
2. `get_order_backlogs`:
   - USE FOR: Total overall order backlog, regional backlog, and opportunity type breakdown (Existing Business, Samples, Service, etc.).
   - Returns: `total_uninvoiced_backlog` (in USD), `total_uninvoiced_formatted` (e.g., $17.87M), and detailed list per region.
   - Present the total uninvoiced order backlog prominently at the top, followed by the breakdown by region and opportunity type.
3. `run_mongo_aggregation`:
   - USE FOR: Custom aggregations, dynamic sums, counts, and grouping across any database collection.
   - Example Questions: "Breakdown of Closed Won POs by quarter", "Top 5 sales owners by pipeline", "Total revenue per region", "Count of opportunities in each stage".
4. `execute_pandas_analytics`:
   - USE FOR: Advanced mathematical calculations, custom ratios, percentile trends, or multi-week comparisons using Python/Pandas over the dataset.
5. `get_slide_data`:
   - USE FOR: Slide-specific data and charts (Slide 1 to 30, or Services slides).
6. `search_user_inputs`:
   - USE FOR: Qualitative manual slide notes (e.g. key POs won >50K, pending opps, RFQs, meeting notes).
7. `search_whale_accounts`:
   - USE FOR: High-value Whale account updates, executive notes, and historical logs.
8. `search_pipeline_data`:
   - USE FOR: Specific CRM opportunity drill-downs and deal details.

DATABASE SCHEMAS & KEY FIELD NAMES:
- `orderbacklogs`:
  * `week`: integer (e.g., 35, 36)
  * `mRegion` / `region`: string ('US West', 'Europe', 'US East', 'Japan', 'Asean', 'KANZ', 'APAC', 'ROW', 'Legacy')
  * `Amount - unInvoiced` / `amount`: numeric ($ amount remaining un-invoiced)
  * `OPP_Type`: string ('Existing Business', 'New Business', 'Samples', 'Service', 'Free Sample')
  * `closing date Fy`: string ('FY2026', 'FY2027', 'FY2028')
- `weekly_tracker_data` (CRM Opportunities):
  * `week`: integer (e.g., 35, 36)
  * `closing date Fy`: string (e.g., 'FY2027')
  * `mRegion` / `region`: string ('US West', 'Europe', 'US East', 'Japan', 'Asean', 'KANZ', 'APAC', 'ROW')
  * `projection - category`: string ('Closed Won' for won POs, 'Pipeline' for open pipeline)
  * `stage`: string ('Closed Won', 'Proposal', 'Negotiation', etc.)
  * `Weighted Amount`: numeric (dollar value weighted by probability; sum of Closed Won gives Total PO Won)
  * `amount` / `revenue` / `total_revenue`: numeric
  * `granular_QTR` / `closing date QTR`: string ('QP2', 'QP3', 'QP4', 'Q1', 'Q2', 'Q3', 'Q4')
  * `Opportunity Name`, `Account Name`, `Opportunity Owner`, `OPP_Type`
- `target_settings`:
  * `financial_year` ('FY2027'), `financial_qtr` ('overall', 'Q1'..), `category_type` ('Overall - region'), `category_value` ('Stretch Target', 'base target'), `target_value` (numeric)
- `invoice_data` / `invoicing_data`:
  * `week`, `grand_total`, `Account Name`, `econ-Region`, `Invoice Date`
"""


# ─── DATABASE READ TOOLS IMPLEMENTATION ────────────────────────────────────

def clean_html(raw_html: Optional[str]) -> str:
    if not raw_html:
        return ""
    clean = re.sub(r'<[^>]+>', ' ', raw_html)
    clean = re.sub(r'\s+', ' ', clean)
    return clean.strip()


def sanitize_gemini_args(obj: Any) -> Any:
    """Recursively convert Google Protobuf MapComposite, RepeatedComposite, Repeated, etc. to pure Python dicts/lists/primitives."""
    if obj is None:
        return None
    if isinstance(obj, (np.floating, np.float64, np.float32)):
        return float(obj)
    if isinstance(obj, (np.integer, np.int64, np.int32)):
        return int(obj)
    if isinstance(obj, datetime):
        return obj.isoformat()
    if hasattr(obj, "items") or isinstance(obj, dict):
        return {str(k): sanitize_gemini_args(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)) or (hasattr(obj, "__iter__") and not isinstance(obj, (str, bytes))):
        return [sanitize_gemini_args(item) for item in obj]
    if hasattr(obj, "__str__") and type(obj).__name__ in ["ObjectId", "Decimal128"]:
        return str(obj)
    return obj


def serialize_mongo_val(val: Any) -> Any:
    """Helper to convert MongoDB types (ObjectId, Decimal128, datetime), NumPy scalars, and protobuf objects to JSON serializable objects."""
    return sanitize_gemini_args(val)


async def execute_tool_call(tool_name: str, args: Dict[str, Any], db) -> Any:
    """Execute read-only database query or computation based on the tool name requested by the LLM."""
    try:
        # 1. Executive Dashboard KPIs (Slide 2 Overview)
        if tool_name == "get_dashboard_summary":
            fy = args.get("fy", "FY2027")
            week = args.get("week")
            token = None
            if week is not None:
                token = target_week_var.set(int(week))
            try:
                slide2 = await slides_compute.compute_slide2_data(db, fy=fy)
            finally:
                if token is not None:
                    target_week_var.reset(token)

            if not slide2 or "error" in slide2:
                return slide2 or {"error": "Could not compute dashboard summary"}

            curr_base = slide2.get("current_week_base", {})
            curr_stretch = slide2.get("current_week_stretch", {})
            prev_base = slide2.get("prev_week_base", {})
            inv = slide2.get("invoiced_data", {})

            po_amt = float(curr_base.get("po", 0.0))
            prev_po_amt = float(prev_base.get("po", 0.0))
            po_growth = po_amt - prev_po_amt

            pipe_amt = float(curr_base.get("pipeline", 0.0))
            prev_pipe_amt = float(prev_base.get("pipeline", 0.0))
            pipe_diff = pipe_amt - prev_pipe_amt

            total_ach = float(curr_base.get("total", 0.0))
            base_tgt = float(slide2.get("base_target", 0.0))
            stretch_tgt = float(slide2.get("stretch_target", 0.0))

            return serialize_mongo_val({
                "financial_year": fy,
                "current_week": slide2.get("current_week"),
                "previous_week": slide2.get("previous_week"),
                "stretch_target": {
                    "amount": stretch_tgt,
                    "formatted": f"${stretch_tgt / 1e6:.2f}M"
                },
                "base_target": {
                    "amount": base_tgt,
                    "formatted": f"${base_tgt / 1e6:.2f}M"
                },
                "total_po_won_closed_won": {
                    "amount": po_amt,
                    "formatted": f"${po_amt / 1e6:.2f}M",
                    "previous_week_po_won": prev_po_amt,
                    "previous_week_formatted": f"${prev_po_amt / 1e6:.2f}M",
                    "growth_from_last_week": po_growth,
                    "growth_formatted": f"{'+' if po_growth >= 0 else ''}{po_growth / 1e6:.2f}M"
                },
                "total_pipeline_weighted_forecast": {
                    "amount": pipe_amt,
                    "formatted": f"${pipe_amt / 1e6:.2f}M",
                    "previous_week_pipeline": prev_pipe_amt,
                    "diff_from_last_week": pipe_diff,
                    "diff_formatted": f"{'+' if pipe_diff >= 0 else ''}{pipe_diff / 1e6:.2f}M"
                },
                "total_achievement_po_plus_pipeline": {
                    "total": total_ach,
                    "formatted": f"${total_ach / 1e6:.2f}M",
                    "base_achievement_pct": f"{curr_base.get('achievement_pct', 0):.1f}%",
                    "base_deficit_or_surplus": curr_base.get("deficit"),
                    "stretch_achievement_pct": f"{curr_stretch.get('achievement_pct', 0):.1f}%",
                    "stretch_deficit": curr_stretch.get("deficit")
                },
                "total_invoiced": {
                    "total_invoiced_amount": inv.get("total_invoiced", 0.0),
                    "formatted": f"${inv.get('total_invoiced', 0.0) / 1e6:.2f}M",
                    "last_week_invoiced": inv.get("last_week_invoiced", 0.0),
                    "last_week_formatted": f"${inv.get('last_week_invoiced', 0.0) / 1e6:.2f}M",
                    "growth_amount": inv.get("growth_amount", 0.0),
                    "growth_pct": f"{inv.get('growth_pct', 0.0):.1f}%"
                }
            })

        # 2. Dynamic MongoDB Aggregation Playground
        elif tool_name == "run_mongo_aggregation":
            collection_name = args.get("collection_name", "").strip()
            raw_pipeline = args.get("pipeline", [])

            ALLOWED_COLLECTIONS = {
                "weekly_tracker_data",
                "invoice_data",
                "invoicing_data",
                "target_settings",
                "orderbacklogs",
                "whale_accounts",
                "weekly_tracker_user_input",
                "services_q1_snapshots",
                "weekly_tracker_summary"
            }

            if collection_name not in ALLOWED_COLLECTIONS:
                return {
                    "error": f"Collection '{collection_name}' is not allowed. Must be one of: {sorted(list(ALLOWED_COLLECTIONS))}"
                }

            if isinstance(raw_pipeline, str):
                try:
                    pipeline = json.loads(raw_pipeline)
                except Exception as e:
                    return {"error": f"Invalid JSON string in pipeline: {str(e)}"}
            elif isinstance(raw_pipeline, list):
                pipeline = raw_pipeline
            else:
                return {"error": "Pipeline must be a list of MongoDB stage objects or a JSON array string."}

            # Safety checks against write operators
            for stage in pipeline:
                if not isinstance(stage, dict):
                    return {"error": f"Invalid stage: {stage}. Each stage must be a dict."}
                for key in stage.keys():
                    if key in ["$out", "$merge", "$writeConcern"]:
                        return {"error": f"Forbidden write operation '{key}' in aggregation pipeline."}

            cursor = db[collection_name].aggregate(pipeline)
            raw_results = await cursor.to_list(length=100)
            serialized_results = [serialize_mongo_val(doc) for doc in raw_results]

            return {
                "count": len(serialized_results),
                "results": serialized_results
            }

        # 3. In-Memory Pandas Analytics Sandbox
        elif tool_name == "execute_pandas_analytics":
            code = args.get("code", "")
            week = args.get("week")
            fy = args.get("fy", "FY2027")

            if not code:
                return {"error": "No Python code provided to execute."}

            FORBIDDEN = ["os.", "sys.", "subprocess", "open(", "importlib", "shutil", "socket", "eval(", "exec(", "__import__"]
            if any(f in code for f in FORBIDDEN):
                return {"error": "Forbidden code construct or system import detected."}

            query: Dict[str, Any] = {}
            if week is not None:
                query["week"] = int(week)
            if fy:
                query["closing date Fy"] = fy

            docs = await db["weekly_tracker_data"].find(query).to_list(length=100000)
            if not docs and week is not None:
                docs = await db["weekly_tracker_data"].find({"closing date Fy": fy} if fy else {}).to_list(length=100000)

            df = pd.DataFrame(docs) if docs else pd.DataFrame()

            # Clean numeric columns if present
            for col in ["Weighted Amount", "amount", "revenue", "total_revenue", "Grand Total"]:
                if col in df.columns:
                    df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0.0)

            exec_globals = {
                "pd": pd,
                "np": np,
                "datetime": datetime,
                "df": df,
                "result": None
            }

            def run_code():
                exec_locals: Dict[str, Any] = {}
                exec(code, exec_globals, exec_locals)
                res = exec_locals.get("result", exec_globals.get("result"))
                if res is None:
                    res = {k: v for k, v in exec_locals.items() if not k.startswith("_")}
                return res

            execution_res = await asyncio.to_thread(run_code)

            if isinstance(execution_res, pd.DataFrame):
                serialized = execution_res.head(50).to_dict(orient="records")
            elif isinstance(execution_res, pd.Series):
                serialized = execution_res.head(50).to_dict()
            elif isinstance(execution_res, (np.integer, np.int64)):
                serialized = int(execution_res)
            elif isinstance(execution_res, (np.floating, np.float64)):
                serialized = float(execution_res)
            elif isinstance(execution_res, (dict, list, str, int, float, bool)) or execution_res is None:
                serialized = execution_res
            else:
                serialized = str(execution_res)

            return {"result": serialized}

        # 4. Slide Data Tool
        elif tool_name == "get_slide_data":
            slide_no = int(args.get("slide_number", 2))
            fy = args.get("fy", "FY2027")
            week = args.get("week")

            token = None
            if week is not None:
                token = target_week_var.set(int(week))
            try:
                fn_name = f"compute_slide{slide_no}_data"
                if hasattr(slides_compute, fn_name):
                    compute_fn = getattr(slides_compute, fn_name)
                    sig = inspect.signature(compute_fn)
                    kwargs = {"db": db}
                    if "fy" in sig.parameters:
                        kwargs["fy"] = fy
                    if "week" in sig.parameters and week is not None:
                        kwargs["week"] = int(week)
                    slide_result = await compute_fn(**kwargs)
                    return {"slide_number": slide_no, "data": serialize_mongo_val(slide_result)}
                elif slide_no in range(1, 40):
                    slide_result = await slides_compute.compute_slide_services_data(db, slide_no=slide_no, fy=fy)
                    return {"slide_number": slide_no, "type": "services", "data": serialize_mongo_val(slide_result)}
                else:
                    return {"error": f"Slide {slide_no} compute function not found."}
            finally:
                if token is not None:
                    target_week_var.reset(token)

        # 5. User manual slide notes search
        elif tool_name == "search_user_inputs":
            query_text = args.get("query_text", "")
            region = args.get("region")
            week = args.get("week")
            fy = args.get("fy", "FY2027")

            query: Dict[str, Any] = {}
            if region and region.lower() != "all" and region.lower() != "overall":
                query["region"] = {"$regex": f"^{re.escape(region)}$", "$options": "i"}
            if week is not None:
                query["week_recorded"] = int(week)
            if query_text:
                query["$or"] = [
                    {"freeform_text": {"$regex": re.escape(query_text), "$options": "i"}},
                    {"table_name": {"$regex": re.escape(query_text), "$options": "i"}},
                    {"slide_id": {"$regex": re.escape(query_text), "$options": "i"}},
                ]

            cursor = db["weekly_tracker_user_input"].find(query).limit(40)
            results = []
            async for doc in cursor:
                results.append({
                    "week": doc.get("week_recorded"),
                    "region": doc.get("region"),
                    "table_name": doc.get("table_name"),
                    "slide_id": doc.get("slide_id") or doc.get("slide_no"),
                    "text": clean_html(doc.get("freeform_text", ""))
                })
            return {"count": len(results), "user_inputs": results}

        # 6. Whale accounts search
        elif tool_name == "search_whale_accounts":
            account_name = args.get("account_name", "")
            region = args.get("region")
            query_text = args.get("query_text", "")
            fy = args.get("fy", "FY2027")

            query = {}
            if region and region.lower() != "all" and region.lower() != "overall":
                query["region"] = {"$regex": f"^{re.escape(region)}$", "$options": "i"}

            or_clauses = []
            if account_name:
                or_clauses.append({"account_name": {"$regex": re.escape(account_name), "$options": "i"}})
            if query_text:
                or_clauses.append({"text_data": {"$regex": re.escape(query_text), "$options": "i"}})
                or_clauses.append({"variants.text_data": {"$regex": re.escape(query_text), "$options": "i"}})
                or_clauses.append({"account_name": {"$regex": re.escape(query_text), "$options": "i"}})

            if or_clauses:
                query["$or"] = or_clauses

            cursor = db["whale_accounts"].find(query).limit(25)
            results = []
            async for doc in cursor:
                variants = []
                for v in doc.get("variants", []):
                    variants.append({
                        "version": v.get("version"),
                        "log_date": v.get("log_date"),
                        "text": clean_html(v.get("text_data", ""))[:500]
                    })
                results.append({
                    "account_name": doc.get("account_name"),
                    "region": doc.get("region"),
                    "date_updated": doc.get("date_updated"),
                    "week_updated": doc.get("week_updated"),
                    "latest_notes": clean_html(doc.get("text_data", "")),
                    "past_variants": variants[:3]
                })
            return {"count": len(results), "whale_accounts": results}

        # 7. Pipeline opportunity search
        elif tool_name == "search_pipeline_data":
            account_name = args.get("account_name")
            region = args.get("region")
            week = args.get("week")
            stage = args.get("stage")
            limit = min(int(args.get("limit", 30)), 60)

            query = {}
            if region and region.lower() != "all" and region.lower() != "overall":
                query["region"] = {"$regex": f"^{re.escape(region)}$", "$options": "i"}
            if week is not None:
                query["week"] = int(week)
            if stage:
                query["stage"] = {"$regex": re.escape(stage), "$options": "i"}
            if account_name:
                query["$or"] = [
                    {"account_name": {"$regex": re.escape(account_name), "$options": "i"}},
                    {"opportunity_name": {"$regex": re.escape(account_name), "$options": "i"}}
                ]

            cursor = db["weekly_tracker_data"].find(query).limit(limit)
            records = []
            async for doc in cursor:
                records.append({
                    "week": doc.get("week"),
                    "region": doc.get("region"),
                    "account_name": doc.get("account_name"),
                    "opportunity_name": doc.get("opportunity_name"),
                    "stage": doc.get("stage"),
                    "revenue": doc.get("revenue") or doc.get("amount") or doc.get("total_revenue"),
                    "category": doc.get("category") or doc.get("category_value"),
                    "owner": doc.get("opportunity_owner") or doc.get("owner")
                })
            return {"count": len(records), "records": records}

        # 8. Target settings
        elif tool_name == "get_target_settings":
            category = args.get("category")
            fy = args.get("financial_year", "FY2027")
            qtr = args.get("financial_qtr")

            query = {}
            if fy:
                query["financial_year"] = fy
            if qtr:
                query["financial_qtr"] = qtr
            if category:
                query["$or"] = [
                    {"category_value": {"$regex": re.escape(category), "$options": "i"}},
                    {"category_type": {"$regex": re.escape(category), "$options": "i"}}
                ]

            cursor = db["target_settings"].find(query).limit(50)
            targets = []
            async for doc in cursor:
                targets.append({
                    "financial_year": doc.get("financial_year"),
                    "financial_qtr": doc.get("financial_qtr"),
                    "category_type": doc.get("category_type"),
                    "category_value": doc.get("category_value"),
                    "target_value": doc.get("target_value"),
                    "ppt_type": doc.get("ppt_type")
                })
            return {"count": len(targets), "targets": targets}

        # 9. Order backlogs
        elif tool_name == "get_order_backlogs":
            region = args.get("region")
            week = args.get("week")
            fy = args.get("financial_year") or args.get("fy")

            # Determine available week
            query_week = int(week) if week is not None else None
            if query_week is not None:
                cnt = await db["orderbacklogs"].count_documents({"week": query_week})
                if cnt == 0:
                    latest_doc = await db["orderbacklogs"].find_one({}, sort=[("week", -1)])
                    query_week = latest_doc["week"] if latest_doc else query_week
            else:
                latest_doc = await db["orderbacklogs"].find_one({}, sort=[("week", -1)])
                query_week = latest_doc["week"] if latest_doc else 36

            match_clause: Dict[str, Any] = {"week": query_week}
            if region and region.lower() not in ["all", "overall"]:
                match_clause["$or"] = [
                    {"region": {"$regex": f"^{re.escape(region)}$", "$options": "i"}},
                    {"mRegion": {"$regex": f"^{re.escape(region)}$", "$options": "i"}}
                ]

            # Aggregate by region
            pipeline_reg = [
                {"$match": match_clause},
                {"$group": {"_id": "$mRegion", "total": {"$sum": "$Amount - unInvoiced"}}},
                {"$sort": {"total": -1}}
            ]
            reg_agg = await db["orderbacklogs"].aggregate(pipeline_reg).to_list(length=100)

            # Aggregate by opportunity type
            pipeline_type = [
                {"$match": match_clause},
                {"$group": {"_id": "$OPP_Type", "total": {"$sum": "$Amount - unInvoiced"}}},
                {"$sort": {"total": -1}}
            ]
            type_agg = await db["orderbacklogs"].aggregate(pipeline_type).to_list(length=100)

            # Aggregate by Financial Year
            pipeline_fy = [
                {"$match": match_clause},
                {"$group": {"_id": "$closing date Fy", "total": {"$sum": "$Amount - unInvoiced"}}},
                {"$sort": {"total": -1}}
            ]
            fy_agg = await db["orderbacklogs"].aggregate(pipeline_fy).to_list(length=100)

            total_overall = sum(float(d["total"] or 0) for d in reg_agg)
            fy27_total = sum(float(d["total"] or 0) for d in fy_agg if d["_id"] == "FY2027")

            return {
                "week_analyzed": query_week,
                "total_order_backlog_all_fy": total_overall,
                "total_order_backlog_all_fy_formatted": f"${total_overall / 1e6:.2f}M",
                "fy2027_order_backlog": fy27_total,
                "fy2027_order_backlog_formatted": f"${fy27_total / 1e6:.2f}M",
                "financial_year_breakdown": [
                    {"financial_year": d["_id"] or "Unassigned", "backlog_usd": float(d["total"] or 0), "formatted": f"${float(d['total'] or 0) / 1e6:.2f}M"}
                    for d in fy_agg if float(d["total"] or 0) > 0
                ],
                "regional_breakdown": [
                    {"region": d["_id"] or "Unassigned", "backlog_usd": float(d["total"] or 0), "formatted": f"${float(d['total'] or 0) / 1e6:.2f}M"}
                    for d in reg_agg if float(d["total"] or 0) > 0
                ],
                "opportunity_type_breakdown": [
                    {"opportunity_type": d["_id"] or "Unassigned", "backlog_usd": float(d["total"] or 0), "formatted": f"${float(d['total'] or 0) / 1e6:.2f}M"}
                    for d in type_agg if float(d["total"] or 0) > 0
                ]
            }

        # 10. Services snapshots
        elif tool_name == "get_services_snapshots":
            region = args.get("region")
            week = args.get("week")

            query = {}
            if region and region.lower() != "all" and region.lower() != "overall":
                query["region"] = {"$regex": f"^{re.escape(region)}$", "$options": "i"}
            if week is not None:
                query["upload_week"] = int(week)

            cursor = db["services_q1_snapshots"].find(query).limit(40)
            snapshots = []
            async for doc in cursor:
                doc_copy = {k: serialize_mongo_val(v) for k, v in doc.items() if k != "_id"}
                snapshots.append(doc_copy)
            return {"count": len(snapshots), "services_snapshots": snapshots}

        # 11. Invoicing data
        elif tool_name == "get_invoicing_data":
            region = args.get("region")
            account_name = args.get("account_name")

            query = {}
            if region and region.lower() != "all" and region.lower() != "overall":
                query["econ-region"] = {"$regex": f"^{re.escape(region)}$", "$options": "i"}
            if account_name:
                query["Account Name"] = {"$regex": re.escape(account_name), "$options": "i"}

            cursor = db["invoicing_data"].find(query).limit(40)
            invoices = []
            async for doc in cursor:
                invoices.append({
                    "account": doc.get("Account Name"),
                    "grand_total": doc.get("Grand Total"),
                    "region": doc.get("econ-Region"),
                    "invoice_date": doc.get("Invoice Date"),
                    "week": doc.get("week")
                })
            return {"count": len(invoices), "invoices": invoices}

        return {"error": f"Unknown tool: {tool_name}"}

    except Exception as err:
        return {"error": f"Tool execution failed: {str(err)}"}


# ─── GEMINI TOOL DECLARATIONS ──────────────────────────────────────────────

TOOL_DECLARATIONS = [
    {
        "name": "get_dashboard_summary",
        "description": "Fetches the high-level executive dashboard summary and Slide 2 KPI metrics for e-con Systems (Base Target, Stretch Target, Total Closed Won POs, Pipeline Forecast, Total Invoiced, Deficits, Growth vs Previous Week). ALWAYS use this tool first whenever the user asks for total PO won, cumulative metrics, overall pipeline, targets, or invoiced revenue.",
        "parameters": {
            "type": "object",
            "properties": {
                "fy": {"type": "string", "description": "Financial year (default 'FY2027')."},
                "week": {"type": "integer", "description": "Week number (1-53). If omitted, uses latest/current week."}
            }
        }
    },
    {
        "name": "run_mongo_aggregation",
        "description": "Executes a dynamic MongoDB read-only aggregation pipeline ($match, $group, $sum, $project, $sort, $limit) against any database collection (weekly_tracker_data, invoice_data, target_settings, orderbacklogs, whale_accounts, weekly_tracker_user_input, services_q1_snapshots). Use this to calculate custom sums, count deals, group by region/stage/quarter/owner, or perform arbitrary database analytics.",
        "parameters": {
            "type": "object",
            "properties": {
                "collection_name": {
                    "type": "string",
                    "description": "Target collection name, e.g. 'weekly_tracker_data', 'invoice_data', 'target_settings', 'orderbacklogs', 'whale_accounts', 'weekly_tracker_user_input'."
                },
                "pipeline": {
                    "type": "array",
                    "items": {"type": "object"},
                    "description": "MongoDB aggregation pipeline stages as a list of stage objects."
                }
            },
            "required": ["collection_name", "pipeline"]
        }
    },
    {
        "name": "execute_pandas_analytics",
        "description": "Executes a Python/Pandas calculation script over the weekly tracker dataset (preloaded as DataFrame 'df'). Use this for advanced math, percentage changes, custom filtering, and multi-dimensional analysis. Store the final output in the 'result' variable.",
        "parameters": {
            "type": "object",
            "properties": {
                "code": {"type": "string", "description": "Python snippet operating on 'df' and assigning output to 'result'."},
                "week": {"type": "integer", "description": "Week number to load into df."},
                "fy": {"type": "string", "description": "Financial year filter (default 'FY2027')."}
            },
            "required": ["code"]
        }
    },
    {
        "name": "get_slide_data",
        "description": "Fetches the exact computed data and chart metrics for any presentation slide (Slide 1 to 30, or Services slides). Use this when the user asks about a specific slide, regional overview slide, or chart.",
        "parameters": {
            "type": "object",
            "properties": {
                "slide_number": {"type": "integer", "description": "Slide number (1 to 30)."},
                "week": {"type": "integer", "description": "Week number."},
                "fy": {"type": "string", "description": "Financial year (default 'FY2027')."}
            },
            "required": ["slide_number"]
        }
    },
    {
        "name": "search_user_inputs",
        "description": "Searches weekly tracker user manual inputs and slide notes (e.g. POs won >50k, RFQs, proposals, pending opps, freeform text notes about specific companies or deals) for a given week or region.",
        "parameters": {
            "type": "object",
            "properties": {
                "query_text": {"type": "string", "description": "Search keyword or company/client name mentioned in text notes."},
                "region": {"type": "string", "description": "Region filter (e.g., 'US West', 'Europe', 'US East', 'ASEAN', 'Japan', 'KANZ', 'Legacy', 'ROW')."},
                "week": {"type": "integer", "description": "Week number (1-53)."},
                "fy": {"type": "string", "description": "Financial year, default FY2027."}
            }
        }
    },
    {
        "name": "search_whale_accounts",
        "description": "Searches high-value 'Whale' client accounts, their latest executive notes, updates, and historic log variants.",
        "parameters": {
            "type": "object",
            "properties": {
                "account_name": {"type": "string", "description": "Account / client name to search for."},
                "region": {"type": "string", "description": "Region filter (e.g., 'USA West', 'Europe', 'USA East', 'Asean', 'Japan', 'Korea', 'Legacy', 'ROW')."},
                "query_text": {"type": "string", "description": "Text or keywords inside whale account updates and logs."}
            }
        }
    },
    {
        "name": "search_pipeline_data",
        "description": "Searches CRM opportunity and sales pipeline dataset for opportunities, revenues, accounts, and stages.",
        "parameters": {
            "type": "object",
            "properties": {
                "account_name": {"type": "string", "description": "Company or opportunity name."},
                "region": {"type": "string", "description": "Region name."},
                "week": {"type": "integer", "description": "Week number."},
                "stage": {"type": "string", "description": "Opportunity stage (e.g., 'Closed Won', 'Proposal', etc.)."},
                "limit": {"type": "integer", "description": "Number of records to return (max 60)."}
            }
        }
    },
    {
        "name": "get_target_settings",
        "description": "Fetches target values for categories and regions for a given Financial Year / Financial Quarter.",
        "parameters": {
            "type": "object",
            "properties": {
                "category": {"type": "string", "description": "Category or region name (e.g., 'Revenue', 'US West', 'Hardware', 'Services')."},
                "financial_year": {"type": "string", "description": "Financial year (e.g., 'FY2027', 'FY2026')."},
                "financial_qtr": {"type": "string", "description": "Quarter (e.g., 'Q1', 'Q2', 'Q3', 'Q4')."}
            }
        }
    },
    {
        "name": "get_order_backlogs",
        "description": "Fetches order backlog amounts and summary per region for a specific week.",
        "parameters": {
            "type": "object",
            "properties": {
                "region": {"type": "string", "description": "Region name."},
                "week": {"type": "integer", "description": "Week number."}
            }
        }
    },
    {
        "name": "get_services_snapshots",
        "description": "Fetches Services Q1/Q2 snapshot analysis, timeline analysis, and services opportunity breakdowns.",
        "parameters": {
            "type": "object",
            "properties": {
                "region": {"type": "string", "description": "Region name."},
                "week": {"type": "integer", "description": "Upload week number."}
            }
        }
    },
    {
        "name": "get_invoicing_data",
        "description": "Fetches actual invoicing data records, totals, and trends by account name or region.",
        "parameters": {
            "type": "object",
            "properties": {
                "region": {"type": "string", "description": "Region name."},
                "account_name": {"type": "string", "description": "Client or company name."}
            }
        }
    }
]


# ─── HELPER: GET AI CONFIG ─────────────────────────────────────────────────

async def get_effective_ai_config(db) -> Dict[str, Any]:
    config_doc = await db["ai_agent_config"].find_one({"_id": "global_config"})
    if not config_doc:
        config_doc = {}

    api_key = config_doc.get("api_key") or os.getenv("GEMINI_API_KEY", "")
    model_name = config_doc.get("model_name", "gemini-3.6-flash")
    agent_name = config_doc.get("agent_name", "e-con BD Analyst")
    
    stored_prompt = config_doc.get("system_prompt") or ""
    if not stored_prompt or "orderbacklogs" not in stored_prompt or "DATABASE SCHEMAS" not in stored_prompt:
        system_prompt = DEFAULT_SYSTEM_PROMPT
    else:
        system_prompt = stored_prompt

    visibility_mode = config_doc.get("visibility_mode", "permitted")

    return {
        "api_key": api_key,
        "model_name": model_name,
        "agent_name": agent_name,
        "system_prompt": system_prompt,
        "visibility_mode": visibility_mode,
        "updated_at": config_doc.get("updated_at"),
        "updated_by": config_doc.get("updated_by")
    }


def mask_key(key: str) -> str:
    if not key:
        return ""
    if len(key) <= 8:
        return "****"
    return key[:4] + "..." + key[-4:]


# ─── ADMIN ENDPOINTS ───────────────────────────────────────────────────────

COMPREHENSIVE_GEMINI_MODELS = [
    # Gemini 3.6 & 3.5 Generation (Recommended Latest)
    {"id": "gemini-3.6-flash", "name": "Gemini 3.6 Flash (Recommended - Latest High Speed & Grounded)", "category": "Gemini 3.6 / 3.5 Generation"},
    {"id": "gemini-3.6-pro", "name": "Gemini 3.6 Pro (Frontier Complex Reasoning & Analysis)", "category": "Gemini 3.6 / 3.5 Generation"},
    {"id": "gemini-3.5-flash", "name": "Gemini 3.5 Flash (Ultra Fast & Low Latency)", "category": "Gemini 3.6 / 3.5 Generation"},
    {"id": "gemini-3.5-pro", "name": "Gemini 3.5 Pro (Deep Analytics)", "category": "Gemini 3.6 / 3.5 Generation"},
    {"id": "gemini-3.0-flash", "name": "Gemini 3.0 Flash", "category": "Gemini 3.0 Generation"},
    {"id": "gemini-3.0-pro", "name": "Gemini 3.0 Pro", "category": "Gemini 3.0 Generation"},

    # Gemini 2.5 & 2.0 Generation
    {"id": "gemini-2.5-flash", "name": "Gemini 2.5 Flash", "category": "Gemini 2.5 / 2.0"},
    {"id": "gemini-2.5-pro", "name": "Gemini 2.5 Pro", "category": "Gemini 2.5 / 2.0"},
    {"id": "gemini-2.0-flash", "name": "Gemini 2.0 Flash", "category": "Gemini 2.5 / 2.0"},
    {"id": "gemini-2.0-flash-lite", "name": "Gemini 2.0 Flash Lite", "category": "Gemini 2.5 / 2.0"},
    {"id": "gemini-2.0-pro-exp-02-05", "name": "Gemini 2.0 Pro Experimental", "category": "Experimental"},
    {"id": "gemini-2.0-flash-thinking-exp-01-21", "name": "Gemini 2.0 Flash Thinking Exp", "category": "Experimental"},
    
    # Gemini 1.5 Generation
    {"id": "gemini-1.5-pro", "name": "Gemini 1.5 Pro", "category": "Gemini 1.5"},
    {"id": "gemini-1.5-pro-latest", "name": "Gemini 1.5 Pro Latest", "category": "Gemini 1.5"},
    {"id": "gemini-1.5-flash", "name": "Gemini 1.5 Flash", "category": "Gemini 1.5"},
    {"id": "gemini-1.5-flash-latest", "name": "Gemini 1.5 Flash Latest", "category": "Gemini 1.5"},
    {"id": "gemini-1.5-flash-8b", "name": "Gemini 1.5 Flash 8B", "category": "Gemini 1.5"},
    {"id": "gemini-1.5-flash-8b-latest", "name": "Gemini 1.5 Flash 8B Latest", "category": "Gemini 1.5"},

    # Experimental & Research
    {"id": "gemini-exp-1206", "name": "Gemini Exp 1206", "category": "Experimental"},
    {"id": "gemini-exp-1121", "name": "Gemini Exp 1121", "category": "Experimental"},
    {"id": "gemini-exp-1114", "name": "Gemini Exp 1114", "category": "Experimental"},
    {"id": "learnlm-1.5-pro-experimental", "name": "LearnLM 1.5 Pro Experimental", "category": "Experimental"},

    # Standard
    {"id": "gemini-1.0-pro", "name": "Gemini 1.0 Pro", "category": "Standard / Legacy"},
    {"id": "gemini-pro", "name": "Gemini Pro", "category": "Standard / Legacy"}
]


@router.get("/admin/ai/models")
async def get_live_gemini_models(current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "Admin":
        raise HTTPException(status_code=403, detail="Admin role required")

    db = get_db()
    cfg = await get_effective_ai_config(db)
    api_key = cfg.get("api_key")

    live_models = []
    if api_key:
        try:
            genai.configure(api_key=api_key)
            models_iter = await asyncio.to_thread(genai.list_models)
            for m in models_iter:
                m_name = m.name.replace("models/", "")
                # Only include generateContent models, exclude embedding, imagen, video models
                if "generateContent" in m.supported_generation_methods and not any(ex in m_name.lower() for ex in ["embedding", "imagen", "veo", "aqa"]):
                    display = m.display_name or m_name
                    live_models.append({
                        "id": m_name,
                        "name": f"{display} ({m_name})",
                        "category": "Available via Live API"
                    })
        except Exception as e:
            print(f"Could not fetch live models: {e}")

    # Merge comprehensive fallback list with live fetched models
    merged = {m["id"]: m for m in COMPREHENSIVE_GEMINI_MODELS}
    for lm in live_models:
        merged[lm["id"]] = lm

    return {"models": list(merged.values())}


@router.get("/admin/ai/config")
async def get_ai_config(current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "Admin":
        raise HTTPException(status_code=403, detail="Admin role required")

    db = get_db()
    cfg = await get_effective_ai_config(db)

    # Attempt live query if API key is present
    all_models = list(COMPREHENSIVE_GEMINI_MODELS)
    if cfg.get("api_key"):
        try:
            genai.configure(api_key=cfg["api_key"])
            models_iter = await asyncio.to_thread(genai.list_models)
            existing_ids = {m["id"] for m in all_models}
            for m in models_iter:
                m_name = m.name.replace("models/", "")
                if "generateContent" in m.supported_generation_methods and not any(ex in m_name.lower() for ex in ["embedding", "imagen", "veo", "aqa"]):
                    if m_name not in existing_ids:
                        all_models.append({
                            "id": m_name,
                            "name": f"{m.display_name or m_name} ({m_name})",
                            "category": "Discovered from Google API"
                        })
        except Exception:
            pass

    return {
        "api_key_masked": mask_key(cfg["api_key"]),
        "has_api_key": bool(cfg["api_key"]),
        "model_name": cfg["model_name"],
        "agent_name": cfg["agent_name"],
        "system_prompt": cfg["system_prompt"],
        "visibility_mode": cfg["visibility_mode"],
        "updated_at": cfg.get("updated_at"),
        "updated_by": cfg.get("updated_by"),
        "available_models": all_models
    }


@router.post("/admin/ai/config")
async def save_ai_config(payload: AiConfigPayload, current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "Admin":
        raise HTTPException(status_code=403, detail="Admin role required")

    db = get_db()
    existing = await db["ai_agent_config"].find_one({"_id": "global_config"}) or {}

    update_fields: Dict[str, Any] = {
        "model_name": payload.model_name,
        "agent_name": payload.agent_name,
        "system_prompt": payload.system_prompt or DEFAULT_SYSTEM_PROMPT,
        "visibility_mode": payload.visibility_mode,
        "updated_at": datetime.utcnow(),
        "updated_by": current_user.get("email") or current_user.get("username")
    }

    # Only update API key if user provided a non-empty string that isn't the masked representation
    if payload.api_key and not payload.api_key.startswith("****") and "..." not in payload.api_key:
        update_fields["api_key"] = payload.api_key.strip()
    elif "api_key" in existing:
        update_fields["api_key"] = existing["api_key"]

    await db["ai_agent_config"].update_one(
        {"_id": "global_config"},
        {"$set": update_fields},
        upsert=True
    )

    return {"status": "ok", "message": "AI Agent configuration saved successfully"}


@router.post("/admin/ai/test-connection")
async def test_ai_connection(payload: TestConnectionPayload, current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "Admin":
        raise HTTPException(status_code=403, detail="Admin role required")

    db = get_db()
    cfg = await get_effective_ai_config(db)
    api_key = payload.api_key if (payload.api_key and not payload.api_key.startswith("****") and "..." not in payload.api_key) else cfg["api_key"]
    model_name = payload.model_name or cfg["model_name"]

    if not api_key:
        raise HTTPException(status_code=400, detail="API Key is missing. Please provide a valid Google Gemini API Key.")

    start_time = datetime.utcnow()
    try:
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel(model_name)
        response = await asyncio.to_thread(
            model.generate_content,
            "Respond with only the words: 'AI Agent Connection Successful'"
        )
        latency_ms = int((datetime.utcnow() - start_time).total_seconds() * 1000)
        return {
            "status": "success",
            "latency_ms": latency_ms,
            "model_response": response.text.strip(),
            "model_tested": model_name
        }
    except Exception as e:
        latency_ms = int((datetime.utcnow() - start_time).total_seconds() * 1000)
        raise HTTPException(status_code=500, detail=f"Connection test failed ({latency_ms}ms): {str(e)}")


@router.get("/admin/ai/logs")
async def get_ai_logs(
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    search: Optional[str] = None,
    filter_rating: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    if current_user.get("role") != "Admin":
        raise HTTPException(status_code=403, detail="Admin role required")

    db = get_db()
    query: Dict[str, Any] = {}

    if filter_rating and filter_rating in ["useful", "not_useful"]:
        query["feedback_rating"] = filter_rating

    if search:
        query["$or"] = [
            {"user_email": {"$regex": re.escape(search), "$options": "i"}},
            {"user_prompt": {"$regex": re.escape(search), "$options": "i"}},
            {"ai_response": {"$regex": re.escape(search), "$options": "i"}},
            {"session_id": {"$regex": re.escape(search), "$options": "i"}},
        ]

    total = await db["ai_chat_logs"].count_documents(query)
    cursor = db["ai_chat_logs"].find(query).sort("timestamp", -1).skip((page - 1) * page_size).limit(page_size)

    logs = []
    async for doc in cursor:
        doc["id"] = str(doc["_id"])
        del doc["_id"]
        logs.append(doc)

    # Calculate overall stats
    total_queries = await db["ai_chat_logs"].count_documents({})
    useful_count = await db["ai_chat_logs"].count_documents({"feedback_rating": "useful"})
    not_useful_count = await db["ai_chat_logs"].count_documents({"feedback_rating": "not_useful"})

    return {
        "logs": logs,
        "total": total,
        "page": page,
        "page_size": page_size,
        "stats": {
            "total_queries": total_queries,
            "useful_count": useful_count,
            "not_useful_count": not_useful_count,
            "satisfaction_rate": f"{(useful_count / max(useful_count + not_useful_count, 1)) * 100:.1f}%"
        }
    }


# ─── USER CHAT ENDPOINTS ───────────────────────────────────────────────────

@router.get("/ai/access-status")
async def check_ai_access(current_user: Optional[dict] = Depends(get_optional_current_user)):
    db = get_db()
    cfg = await get_effective_ai_config(db)
    mode = cfg.get("visibility_mode", "permitted")

    if mode == "disabled":
        return {"has_access": False, "reason": "AI Agent is currently disabled"}

    if not current_user:
        if mode == "all":
            return {"has_access": True, "role": "Guest"}
        return {"has_access": False, "reason": "Authentication required"}

    role = current_user.get("role", "User")
    tracker_access = current_user.get("tracker_access", [])

    if role == "Admin":
        return {"has_access": True, "role": "Admin", "mode": mode}

    if mode == "admin_only":
        return {"has_access": False, "reason": "AI Agent is currently in Admin Testing mode"}

    # Permitted mode: check tracker_access or ai_agent_access
    has_perm = (
        "AI Agent" in tracker_access or
        "Weekly" in tracker_access or
        current_user.get("ai_agent_access", False)
    )

    return {"has_access": has_perm, "role": role, "mode": mode}


@router.get("/ai/sessions")
async def get_user_sessions(
    limit: int = Query(10, ge=1, le=50),
    skip: int = Query(0, ge=0),
    current_user: Optional[dict] = Depends(get_optional_current_user)
):
    email = current_user.get("email") if current_user else "anonymous"
    db = get_db()

    total = await db["ai_chat_sessions"].count_documents({"user_email": email})
    cursor = db["ai_chat_sessions"].find({"user_email": email}).sort([("updated_at", -1), ("created_at", -1)]).skip(skip).limit(limit)
    sessions = []
    async for s in cursor:
        sessions.append({
            "session_id": s["session_id"],
            "title": s.get("title", "New Conversation"),
            "created_at": s.get("created_at"),
            "updated_at": s.get("updated_at"),
            "message_count": len(s.get("messages", []))
        })
    return {
        "sessions": sessions,
        "total": total,
        "has_more": (skip + len(sessions)) < total
    }


@router.get("/ai/sessions/{session_id}")
async def get_session_details(session_id: str, current_user: Optional[dict] = Depends(get_optional_current_user)):
    db = get_db()
    session = await db["ai_chat_sessions"].find_one({"session_id": session_id})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    return {
        "session_id": session["session_id"],
        "title": session.get("title", "New Conversation"),
        "messages": session.get("messages", []),
        "created_at": session.get("created_at")
    }


@router.post("/ai/chat")
async def handle_ai_chat(payload: ChatMessageRequest, current_user: Optional[dict] = Depends(get_optional_current_user)):
    db = get_db()
    cfg = await get_effective_ai_config(db)

    # Permission check
    mode = cfg.get("visibility_mode", "permitted")
    if mode == "disabled":
        raise HTTPException(status_code=403, detail="AI Agent is currently disabled by administrator.")
    if mode == "admin_only" and (not current_user or current_user.get("role") != "Admin"):
        raise HTTPException(status_code=403, detail="AI Agent is currently restricted to Admin users.")

    api_key = cfg["api_key"]
    if not api_key:
        raise HTTPException(status_code=500, detail="Gemini API Key is not configured. Please contact the administrator.")

    session_id = payload.session_id or str(uuid.uuid4())
    user_email = current_user.get("email") if current_user else "anonymous"
    user_name = current_user.get("username") or user_email.split("@")[0]

    # Session recovery or creation
    session_doc = await db["ai_chat_sessions"].find_one({"session_id": session_id})
    is_new_session = False
    if not session_doc:
        is_new_session = True
        session_doc = {
            "session_id": session_id,
            "user_email": user_email,
            "user_name": user_name,
            "title": payload.message[:45] + ("..." if len(payload.message) > 45 else ""),
            "messages": [],
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }

    # Setup Gemini SDK
    genai.configure(api_key=api_key)

    # Context enrichment in system instruction
    context_note = f"\n\nCURRENT DASHBOARD CONTEXT:\n- Target Financial Year: {payload.fy or 'FY2027'}\n- Active User Selected Week: {payload.week or 'Latest'}\n- Active Region Context: {payload.active_region or 'Overall'}\n- Active Slide ID: {payload.active_slide_id or 'Overview'}\n- Logged-in User: {user_name} ({user_email})\n"

    full_system_instruction = cfg["system_prompt"] + context_note

    # Build Gemini tools
    gemini_tools = [{"function_declarations": TOOL_DECLARATIONS}]

    model = genai.GenerativeModel(
        model_name=cfg["model_name"],
        system_instruction=full_system_instruction,
        tools=gemini_tools
    )

    # Build conversation history for multi-turn chat
    history = []
    for m in session_doc.get("messages", []):
        role = "user" if m.get("role") == "user" else "model"
        history.append({"role": role, "parts": [m.get("content", "")]})

    chat = model.start_chat(history=history)

    # Multi-step Function Calling execution loop with latency and thought tracking
    start_time = time.time()
    tools_executed_log = []
    final_response_text = ""

    try:
        response = await asyncio.to_thread(chat.send_message, payload.message)

        max_tool_iterations = 3
        iteration = 0

        while iteration < max_tool_iterations:
            iteration += 1

            # Check if model requested function calls
            function_calls = []
            if response.candidates and response.candidates[0].content and response.candidates[0].content.parts:
                for part in response.candidates[0].content.parts:
                    if hasattr(part, "function_call") and part.function_call:
                        function_calls.append(part.function_call)

            if not function_calls:
                # No more function calls, we have the final text answer
                try:
                    final_response_text = response.text
                except Exception:
                    text_parts = [p.text for p in response.candidates[0].content.parts if hasattr(p, "text") and p.text]
                    final_response_text = "\n".join(text_parts)
                break

            # Execute the function calls against read-only MongoDB
            function_responses = []
            for fc in function_calls:
                f_name = fc.name
                f_args = sanitize_gemini_args(dict(fc.args)) if hasattr(fc, "args") else {}

                tool_result = await execute_tool_call(f_name, f_args, db)
                clean_tool_result = serialize_mongo_val(tool_result)

                # Generate a concise snippet for admin trace
                try:
                    res_str = json.dumps(clean_tool_result)
                    summary_snippet = res_str[:350] + ("..." if len(res_str) > 350 else "")
                except Exception:
                    summary_snippet = str(clean_tool_result)[:350]

                tools_executed_log.append({
                    "step": iteration,
                    "tool": f_name,
                    "args": f_args,
                    "result_summary": summary_snippet
                })

                function_responses.append({
                    "response": {
                        "name": f_name,
                        "content": clean_tool_result
                    }
                })

            # Send function execution results back to Gemini
            response = await asyncio.to_thread(
                chat.send_message,
                [genai.protos.Part(function_response=genai.protos.FunctionResponse(name=fr["response"]["name"], response={"result": fr["response"]["content"]})) for fr in function_responses]
            )

        if not final_response_text:
            try:
                final_response_text = response.text
            except Exception:
                text_parts = []
                if response.candidates and response.candidates[0].content and response.candidates[0].content.parts:
                    text_parts = [p.text for p in response.candidates[0].content.parts if hasattr(p, "text") and p.text]
                if text_parts:
                    final_response_text = "\n".join(text_parts)
                else:
                    # Final synthesis fallback if needed
                    synth_resp = await asyncio.to_thread(
                        chat.send_message,
                        "Please synthesize and present your final structured summary answer based on the data retrieved above."
                    )
                    try:
                        final_response_text = synth_resp.text
                    except Exception:
                        final_response_text = "Analysis completed based on the retrieved data."

    except Exception as gemini_err:
        final_response_text = f"An error occurred while generating the answer: {str(gemini_err)}"

    latency_ms = int((time.time() - start_time) * 1000)
    latency_formatted = f"{latency_ms / 1000.0:.2f}s"

    # Record message IDs and metadata
    user_msg_id = str(uuid.uuid4())
    assistant_msg_id = str(uuid.uuid4())
    timestamp_now = datetime.utcnow()

    user_entry = {
        "id": user_msg_id,
        "role": "user",
        "content": payload.message,
        "timestamp": timestamp_now.isoformat() + "Z"
    }

    clean_tools_log = serialize_mongo_val(tools_executed_log)

    assistant_entry = {
        "id": assistant_msg_id,
        "role": "assistant",
        "content": final_response_text,
        "tools_called": clean_tools_log,
        "latency_ms": latency_ms,
        "latency_formatted": latency_formatted,
        "model_used": cfg["model_name"],
        "feedback_rating": None,
        "timestamp": datetime.utcnow().isoformat() + "Z"
    }

    session_doc["messages"].append(user_entry)
    session_doc["messages"].append(assistant_entry)
    session_doc["updated_at"] = datetime.utcnow()

    clean_session_doc = serialize_mongo_val(session_doc)

    # Update or insert session in DB
    await db["ai_chat_sessions"].update_one(
        {"session_id": session_id},
        {"$set": clean_session_doc},
        upsert=True
    )

    # Insert individual audit log entry for admin analytics
    log_entry = {
        "session_id": session_id,
        "user_msg_id": user_msg_id,
        "assistant_msg_id": assistant_msg_id,
        "user_email": user_email,
        "user_name": user_name,
        "user_prompt": payload.message,
        "ai_response": final_response_text,
        "tools_called": [t["tool"] for t in clean_tools_log],
        "tools_executed_details": clean_tools_log,
        "latency_ms": latency_ms,
        "latency_formatted": latency_formatted,
        "model_used": cfg["model_name"],
        "week": payload.week,
        "region": payload.active_region,
        "slide_id": payload.active_slide_id,
        "feedback_rating": None,
        "timestamp": datetime.utcnow()
    }
    clean_log_entry = serialize_mongo_val(log_entry)
    await db["ai_chat_logs"].insert_one(clean_log_entry)

    return {
        "session_id": session_id,
        "user_message": user_entry,
        "assistant_message": assistant_entry,
        "tools_called": clean_tools_log,
        "latency_ms": latency_ms,
        "latency_formatted": latency_formatted,
        "is_new_session": is_new_session
    }


@router.post("/ai/feedback")
async def record_ai_feedback(payload: FeedbackPayload, current_user: Optional[dict] = Depends(get_optional_current_user)):
    db = get_db()

    # Update message in ai_chat_sessions
    await db["ai_chat_sessions"].update_one(
        {
            "session_id": payload.session_id,
            "messages.id": payload.message_id
        },
        {
            "$set": {
                "messages.$.feedback_rating": payload.rating,
                "messages.$.feedback_comment": payload.comment,
                "messages.$.feedback_at": datetime.utcnow()
            }
        }
    )

    # Update audit log entry
    await db["ai_chat_logs"].update_one(
        {
            "session_id": payload.session_id,
            "assistant_msg_id": payload.message_id
        },
        {
            "$set": {
                "feedback_rating": payload.rating,
                "feedback_comment": payload.comment,
                "feedback_at": datetime.utcnow()
            }
        }
    )

    return {"status": "ok", "message": "Feedback recorded successfully"}
