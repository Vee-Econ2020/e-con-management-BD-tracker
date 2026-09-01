# e-con Systems Weekly Tracker - Agent Guidelines & Architecture Rules

## 1. Google Gemini AI Function Calling & Serialization Invariants
- **Protobuf BSON Sanitization**: Gemini function call parameters (`fc.args`) and tool outputs contain Google Protobuf structures (`MapComposite`, `RepeatedComposite`). NEVER write raw `fc.args` or un-sanitized dictionaries directly to MongoDB.
- Always use `sanitize_gemini_args()` / `serialize_mongo_val()` to recursively cast all protobuf objects, NumPy types (`np.int64`, `np.float64`), and ObjectId/Decimal128 instances to native JSON-serializable Python types before MongoDB session or audit log insertion.
- **MongoDB `_id` Immutability**: When updating existing session documents (`ai_chat_sessions`) via `update_one` with `$set`, ALWAYS pop `_id` from the payload dictionary (`doc.pop("_id", None)`). In MongoDB, passing `_id` inside a `$set` operator triggers `WriteError: Performing an update on the path '_id' would modify the immutable field '_id'`.
- **Text Extraction Safety**: In multi-turn tool loops, never call `response.text` unconditionally without checking whether the candidate part is a `function_call`. Use safe extraction from `response.candidates[0].content.parts` to avoid `ValueError: Could not convert part.function_call to text`.

## 2. AI Tool Design & Anti-Looping Architecture
- **Pre-Aggregated Tool Payloads**: AI tools (`get_order_backlogs`, `get_dashboard_summary`, `run_mongo_aggregation`) MUST return executive-ready summary metrics (pre-calculated totals, regional breakdowns, and category sums) rather than massive dumps of 50+ raw rows.
  - Raw row dumps cause the LLM to enter repetitive query loops trying different aggregations, resulting in 15+ second latency.
- **Strict Loop Cap & Synthesis Enforcement**: Cap tool iterations to 3 turns maximum. Direct the system prompt to immediately synthesize structured tables and figures in the next turn once tool data is received.
- **Latency Tracking**: Always track execution duration (`time.time()`) and store `latency_ms` and `latency_formatted` in message metadata and audit logs (`ai_chat_logs`).

## 3. Database Schema & Business Domain Rules
- **Weekly Tracker Fallback**: If a requested week has 0 records (e.g. active dashboard week 36 while latest uploaded data is week 35), query tools must automatically fall back to the latest recorded week and append a clear note.
- **Order Backlogs (`orderbacklogs`)**:
  * Fields: `week` (int), `mRegion` / `region` (string), `Amount - unInvoiced` (numeric), `OPP_Type` (string), `closing date Fy` (string e.g. 'FY2027').
  * FY2027 specific backlog requires filtering `closing date Fy: "FY2027"` (~$47.19M for week 35/36); overall all-FY backlog is ~$59.45M.
- **Slide 2 Executive KPIs (`weekly_tracker_data` + `target_settings`)**:
  * Stretch Target ($73.00M) vs Base Target ($63.80M).
  * Total PO Won = Sum of `Weighted Amount` where `projection - category == 'Closed Won'` (~$67.67M).
  * Pipeline Forecast = Sum of `Weighted Amount` where `projection - category == 'Pipeline'` (~$10.73M).
  * Invoiced = Sum of `grand_total` from `invoice_data` (~$20.26M).

## 4. Frontend & Admin UI Standards
- **Chat UI (`AiChatbot.tsx`)**:
  * Assistant message bubbles must display expandable tool inspection details (`ToolExecutionViewer`) showing tools called, parameters, and latency pill (e.g. `⚡ 1 Tool Executed • 1.34s`).
  * Recent Conversations sidebar must be sorted in descending chronological order (`updated_at: -1, created_at: -1`) with a top-10 limit and an interactive **"Load More (10 older)"** button.
  * Live loading indicator must cycle through active progress sub-texts.
- **Admin AI Logs (`AiAgentConfig.tsx`)**:
  * Must display a **Time Taken** column with latency.
  * **"View Answer & Trace"** must show the formatted AI answer alongside the step-by-step query trace (tool name, JSON arguments, and returned data preview).
