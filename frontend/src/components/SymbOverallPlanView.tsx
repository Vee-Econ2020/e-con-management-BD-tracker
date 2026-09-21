import React, { useState, useEffect, useMemo } from 'react';
import { 
    Calendar, RefreshCw, Save, Plus, Edit2, Layers, X, Lock, 
    Clock, RotateCcw, Info, Calculator 
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface SymbPlanRow {
    id?: string;
    "Last Batch Date"?: string;
    "Shipment Week"?: string;
    "Variant Type"?: string;
    "Event Type"?: string;
    "planned Value"?: number;
    [key: string]: any;
}

interface WeeklyPlanSummary {
    shipmentWeek: string;
    formattedWeek: string;
    v1Planned: number;
    v2Planned: number;
}

interface StageLeadTimeItem {
    id?: string;
    stage: string;
    weeks: number;
    days: number;
    order?: number;
}

const DEFAULT_STAGE_LEAD_TIMES: StageLeadTimeItem[] = [
    { stage: "EBOM covered", weeks: 11, days: 0, order: 0 },
    { stage: "PCBA covered", weeks: 9, days: 0, order: 1 },
    { stage: "All Material Available", weeks: 7, days: 0, order: 2 },
    { stage: "Materials Issued", weeks: 7, days: 0, order: 3 },
    { stage: "Active alignment", weeks: 5, days: 0, order: 4 },
    { stage: "Production/Assembly", weeks: 5, days: 0, order: 5 },
    { stage: "FQC", weeks: 4, days: 0, order: 6 },
    { stage: "Finished goods", weeks: 4, days: 0, order: 7 },
    { stage: "Invoice Date", weeks: 1, days: 0, order: 8 },
    { stage: "Shipment Date", weeks: 0, days: 0, order: 9 },
    { stage: "customer place", weeks: 0, days: 7, order: 10 },
];

const STAGE_COLOR_MAP: Record<string, { color: string; bg: string; border: string; text: string }> = {
    'EBOM covered': { color: '#6366f1', bg: '#eef2ff', border: '#c7d2fe', text: '#3730a3' },
    'PCBA covered': { color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe', text: '#1e40af' },
    'PCBA Ready': { color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe', text: '#1e40af' },
    'All Material Available': { color: '#d97706', bg: '#fffbeb', border: '#fde68a', text: '#92400e' },
    '100% CTB': { color: '#d97706', bg: '#fffbeb', border: '#fde68a', text: '#92400e' },
    'Materials Issued': { color: '#8b5cf6', bg: '#f5f3ff', border: '#ddd6fe', text: '#5b21b6' },
    'Active alignment': { color: '#d97706', bg: '#fffbeb', border: '#fde68a', text: '#92400e' },
    'Production/Assembly': { color: '#0d9488', bg: '#f0fdfa', border: '#99f6e4', text: '#115e59' },
    'FQC': { color: '#4f46e5', bg: '#eef2ff', border: '#c7d2fe', text: '#3730a3' },
    'Finished goods': { color: '#059669', bg: '#ecfdf5', border: '#a7f3d0', text: '#065f46' },
    'Invoice Date': { color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe', text: '#5b21b6' },
    'Shipment Date': { color: '#db2777', bg: '#fdf2f8', border: '#fbcfe8', text: '#9d174d' },
    'customer place': { color: '#0284c7', bg: '#f0f9ff', border: '#bae6fd', text: '#0369a1' }
};

export default function SymbOverallPlanView() {
    const { user } = useAuth();
    const isAdmin = user?.role === 'Admin';

    // Sub-tab switcher: 'volumes' = Weekly Planned Volumes, 'lead_times' = Stage Lead Times Formula
    const [activeInnerTab, setActiveInnerTab] = useState<'volumes' | 'lead_times'>('volumes');

    const [rawPlanData, setRawPlanData] = useState<SymbPlanRow[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
    const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // Editing State (Weekly Volumes)
    const [editingWeek, setEditingWeek] = useState<string | null>(null);
    const [editV1Planned, setEditV1Planned] = useState<number | string>('');
    const [editV2Planned, setEditV2Planned] = useState<number | string>('');
    const [saveLoading, setSaveLoading] = useState<boolean>(false);

    // Add New Week State
    const [showAddModal, setShowAddModal] = useState<boolean>(false);
    const [newWeekDate, setNewWeekDate] = useState<string>('');
    const [newV1Planned, setNewV1Planned] = useState<number | string>(0);
    const [newV2Planned, setNewV2Planned] = useState<number | string>(0);

    // Stage Lead Times State
    const [leadTimes, setLeadTimes] = useState<StageLeadTimeItem[]>(DEFAULT_STAGE_LEAD_TIMES);
    const [loadingLeadTimes, setLoadingLeadTimes] = useState<boolean>(false);
    const [saveLeadTimesLoading, setSaveLeadTimesLoading] = useState<boolean>(false);
    const [selectedRefWeek, setSelectedRefWeek] = useState<string>('');
    const [hasUnsavedLeadTimeChanges, setHasUnsavedLeadTimeChanges] = useState<boolean>(false);

    const fetchPlanData = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/admin/symb-plan/transformed');
            if (res.ok) {
                const data = await res.json();
                setRawPlanData(data);
            }
        } catch (e) {
            console.error("Error fetching SYMB plan data", e);
        } finally {
            setLoading(false);
        }
    };

    const fetchLeadTimes = async () => {
        setLoadingLeadTimes(true);
        try {
            const res = await fetch('/api/admin/symb-stage-lead-times');
            if (res.ok) {
                const data = await res.json();
                if (Array.isArray(data) && data.length > 0) {
                    setLeadTimes(data);
                }
            }
        } catch (e) {
            console.error("Error fetching stage lead times", e);
        } finally {
            setLoadingLeadTimes(false);
            setHasUnsavedLeadTimeChanges(false);
        }
    };

    useEffect(() => {
        fetchPlanData();
        fetchLeadTimes();
    }, []);

    const handleRefresh = async () => {
        setIsRefreshing(true);
        await Promise.all([fetchPlanData(), fetchLeadTimes()]);
        setIsRefreshing(false);
    };

    // Extract single fixed planned values for Variant 1 and Variant 2 per Shipment Week
    const weeklySummaries: WeeklyPlanSummary[] = useMemo(() => {
        if (!rawPlanData || rawPlanData.length === 0) return [];

        const map = new Map<string, { v1P: number; v2P: number }>();

        rawPlanData.forEach(row => {
            const weekStr = (row["Shipment Week"] || row["shipment_week"] || "").trim();
            if (!weekStr) return;

            const variant = (row["Variant Type"] || row["variant"] || "").trim();
            const plannedVal = Number(row["planned Value"] || row["planned_value"] || 0);

            if (!map.has(weekStr)) {
                map.set(weekStr, { v1P: 0, v2P: 0 });
            }

            const entry = map.get(weekStr)!;
            const isV1 = ["V1", "v1", "Variant 1", "Variant 1"].includes(variant);
            const isV2 = ["V2", "v2", "Variant 2", "Variant 2"].includes(variant);

            if (isV1 && plannedVal > 0) {
                // Keep the planned number for Variant 1 (same across stages)
                entry.v1P = plannedVal;
            } else if (isV2 && plannedVal > 0) {
                // Keep the planned number for Variant 2 (same across stages)
                entry.v2P = plannedVal;
            }
        });

        // Convert Map to array and sort chronologically
        const list: WeeklyPlanSummary[] = [];
        map.forEach((vals, weekStr) => {
            let formattedWeek = weekStr;
            try {
                const d = new Date(weekStr);
                if (!isNaN(d.getTime())) {
                    formattedWeek = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
                }
            } catch (e) {
                formattedWeek = weekStr;
            }

            list.push({
                shipmentWeek: weekStr,
                formattedWeek,
                v1Planned: vals.v1P,
                v2Planned: vals.v2P
            });
        });

        return list.sort((a, b) => {
            const da = new Date(a.shipmentWeek).getTime();
            const db = new Date(b.shipmentWeek).getTime();
            if (isNaN(da) || isNaN(db)) return a.shipmentWeek.localeCompare(b.shipmentWeek);
            return da - db;
        });
    }, [rawPlanData]);

    // Set initial reference shipment week for live date preview
    useEffect(() => {
        if (!selectedRefWeek && weeklySummaries.length > 0) {
            setSelectedRefWeek(weeklySummaries[0].shipmentWeek);
        }
    }, [weeklySummaries, selectedRefWeek]);

    const startEditing = (summary: WeeklyPlanSummary) => {
        if (!isAdmin) return;
        setEditingWeek(summary.shipmentWeek);
        setEditV1Planned(summary.v1Planned);
        setEditV2Planned(summary.v2Planned);
        setStatusMsg(null);
    };

    const cancelEditing = () => {
        setEditingWeek(null);
        setEditV1Planned('');
        setEditV2Planned('');
    };

    const saveWeeklyPlan = async (shipmentWeek: string, v1Val?: number, v2Val?: number) => {
        if (!isAdmin) {
            setStatusMsg({ type: 'error', text: 'Admin authorization required to edit planned numbers.' });
            return;
        }

        setSaveLoading(true);
        setStatusMsg(null);
        const finalV1 = v1Val !== undefined ? v1Val : Number(editV1Planned) || 0;
        const finalV2 = v2Val !== undefined ? v2Val : Number(editV2Planned) || 0;

        try {
            const res = await fetch('/api/admin/symb-plan/update-weekly-plan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    shipment_week: shipmentWeek,
                    v1_planned: finalV1,
                    v2_planned: finalV2
                })
            });

            const data = await res.json();
            if (res.ok) {
                setStatusMsg({ type: 'success', text: data.message || `Successfully updated plan for week ${shipmentWeek}` });
                setEditingWeek(null);
                setShowAddModal(false);
                await fetchPlanData();
            } else {
                setStatusMsg({ type: 'error', text: data.detail || 'Failed to update plan numbers' });
            }
        } catch (e) {
            setStatusMsg({ type: 'error', text: 'Network error while updating plan' });
        } finally {
            setSaveLoading(false);
        }
    };

    const handleAddWeekSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newWeekDate) {
            setStatusMsg({ type: 'error', text: 'Please enter a shipment week date' });
            return;
        }
        saveWeeklyPlan(newWeekDate, Number(newV1Planned) || 0, Number(newV2Planned) || 0);
    };

    // Stage Lead Times Offset Handlers
    const handleLeadTimeChange = (stageName: string, field: 'weeks' | 'days', val: number) => {
        if (!isAdmin) return;
        setLeadTimes(prev => prev.map(item => {
            if (item.stage === stageName) {
                return { ...item, [field]: val };
            }
            return item;
        }));
        setHasUnsavedLeadTimeChanges(true);
    };

    const saveAllLeadTimes = async (customStages?: StageLeadTimeItem[]) => {
        if (!isAdmin) {
            setStatusMsg({ type: 'error', text: 'Admin authorization required to edit stage lead times.' });
            return;
        }

        setSaveLeadTimesLoading(true);
        setStatusMsg(null);
        try {
            const payload = customStages || leadTimes;
            const res = await fetch('/api/admin/symb-stage-lead-times', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ stages: payload })
            });

            const data = await res.json();
            if (res.ok) {
                setStatusMsg({ type: 'success', text: data.message || 'Successfully saved stage lead times and updated plan pipeline dates.' });
                setHasUnsavedLeadTimeChanges(false);
                await fetchPlanData();
                await fetchLeadTimes();
            } else {
                setStatusMsg({ type: 'error', text: data.detail || 'Failed to save stage lead times' });
            }
        } catch (e) {
            setStatusMsg({ type: 'error', text: 'Network error while saving stage lead times' });
        } finally {
            setSaveLeadTimesLoading(false);
        }
    };

    const resetToDefaults = () => {
        if (!isAdmin) return;
        if (window.confirm("Are you sure you want to reset all stage lead times to standard defaults? You will need to click 'Save Lead Times' to apply.")) {
            setLeadTimes(DEFAULT_STAGE_LEAD_TIMES);
            setHasUnsavedLeadTimeChanges(true);
        }
    };

    // Date preview calculation: x - (weeks * 7) + days
    const calculatePreviewDate = (refDateStr: string, weeks: number, days: number): string => {
        if (!refDateStr) return '-';
        try {
            const d = new Date(refDateStr);
            if (isNaN(d.getTime())) return '-';
            const targetMs = d.getTime() - (weeks * 7 * 86400000) + (days * 86400000);
            const targetDate = new Date(targetMs);
            return targetDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
        } catch {
            return '-';
        }
    };

    // Format formula display text: x - 9 wks + 3 days
    const formatFormulaText = (weeks: number, days: number): string => {
        const parts: string[] = ['x'];
        if (weeks !== 0) {
            if (weeks > 0) {
                parts.push(`- ${weeks} wk${weeks !== 1 ? 's' : ''}`);
            } else {
                parts.push(`+ ${Math.abs(weeks)} wk${Math.abs(weeks) !== 1 ? 's' : ''}`);
            }
        }
        if (days !== 0) {
            if (days > 0) {
                parts.push(`+ ${days} day${days !== 1 ? 's' : ''}`);
            } else {
                parts.push(`- ${Math.abs(days)} day${Math.abs(days) !== 1 ? 's' : ''}`);
            }
        }
        if (weeks === 0 && days === 0) {
            return 'x (Shipment Week)';
        }
        return parts.join(' ');
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', backgroundColor: '#ffffff', borderRadius: '0 0 12px 12px', padding: '1.5rem', border: '1px solid #e2e8f0', borderTop: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
            
            {/* Header Controls */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                    <h2 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 800, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <Layers size={22} color="#f5ad42" /> Overall SYMB Plan
                    </h2>
                    <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
                        {activeInnerTab === 'volumes' 
                            ? 'Weekly shipment volume breakdown for Variant 1 & Variant 2.' 
                            : 'Stage completion lead times & timeline formula rules for all shipment weeks.'} 
                        {isAdmin ? ' Update values directly below.' : ' View-only access (Admin permissions required to edit).'}
                    </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    {activeInnerTab === 'volumes' && isAdmin && (
                        <button
                            onClick={() => {
                                setNewWeekDate('');
                                setNewV1Planned(0);
                                setNewV2Planned(0);
                                setShowAddModal(true);
                            }}
                            style={{
                                backgroundColor: '#3b82f6',
                                color: '#ffffff',
                                border: 'none',
                                padding: '0.55rem 1.1rem',
                                borderRadius: '8px',
                                fontWeight: 700,
                                fontSize: '0.88rem',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.4rem',
                                boxShadow: '0 2px 4px rgba(59,130,246,0.3)'
                            }}
                        >
                            <Plus size={16} /> Add / Update Week Plan
                        </button>
                    )}

                    {activeInnerTab === 'lead_times' && isAdmin && (
                        <>
                            <button
                                onClick={resetToDefaults}
                                style={{
                                    backgroundColor: '#f8fafc',
                                    color: '#475569',
                                    border: '1px solid #cbd5e1',
                                    padding: '0.55rem 0.9rem',
                                    borderRadius: '8px',
                                    fontWeight: 600,
                                    fontSize: '0.85rem',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.4rem'
                                }}
                                title="Reset stage lead times to standard defaults"
                            >
                                <RotateCcw size={15} /> Reset Defaults
                            </button>

                            <button
                                onClick={() => saveAllLeadTimes()}
                                disabled={saveLeadTimesLoading}
                                style={{
                                    backgroundColor: hasUnsavedLeadTimeChanges ? '#16a34a' : '#2563eb',
                                    color: '#ffffff',
                                    border: 'none',
                                    padding: '0.55rem 1.15rem',
                                    borderRadius: '8px',
                                    fontWeight: 700,
                                    fontSize: '0.88rem',
                                    cursor: saveLeadTimesLoading ? 'not-allowed' : 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.4rem',
                                    boxShadow: '0 2px 6px rgba(0,0,0,0.1)'
                                }}
                            >
                                <Save size={16} />
                                {saveLeadTimesLoading ? 'Saving...' : hasUnsavedLeadTimeChanges ? 'Save Lead Times *' : 'Save Lead Times'}
                            </button>
                        </>
                    )}

                    <button
                        onClick={handleRefresh}
                        disabled={isRefreshing}
                        style={{
                            backgroundColor: '#f1f5f9',
                            color: '#334155',
                            border: '1px solid #cbd5e1',
                            padding: '0.55rem 1rem',
                            borderRadius: '8px',
                            fontWeight: 600,
                            fontSize: '0.88rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.4rem'
                        }}
                    >
                        <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
                        Refresh
                    </button>
                </div>
            </div>

            {/* Inner Sub-Tab Switcher */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                borderBottom: '2px solid #e2e8f0',
                paddingBottom: '0.5rem'
            }}>
                <button
                    onClick={() => setActiveInnerTab('volumes')}
                    style={{
                        padding: '0.55rem 1.15rem',
                        borderRadius: '8px',
                        fontWeight: 700,
                        fontSize: '0.9rem',
                        cursor: 'pointer',
                        border: activeInnerTab === 'volumes' ? '2px solid #3b82f6' : '1px solid #cbd5e1',
                        backgroundColor: activeInnerTab === 'volumes' ? '#eff6ff' : '#ffffff',
                        color: activeInnerTab === 'volumes' ? '#1d4ed8' : '#64748b',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        transition: 'all 0.15s ease'
                    }}
                >
                    <Layers size={16} color={activeInnerTab === 'volumes' ? '#2563eb' : '#64748b'} />
                    Weekly Planned Volumes
                </button>

                <button
                    onClick={() => setActiveInnerTab('lead_times')}
                    style={{
                        padding: '0.55rem 1.15rem',
                        borderRadius: '8px',
                        fontWeight: 700,
                        fontSize: '0.9rem',
                        cursor: 'pointer',
                        border: activeInnerTab === 'lead_times' ? '2px solid #3b82f6' : '1px solid #cbd5e1',
                        backgroundColor: activeInnerTab === 'lead_times' ? '#eff6ff' : '#ffffff',
                        color: activeInnerTab === 'lead_times' ? '#1d4ed8' : '#64748b',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        transition: 'all 0.15s ease'
                    }}
                >
                    <Clock size={16} color={activeInnerTab === 'lead_times' ? '#2563eb' : '#64748b'} />
                    Stage Completion Lead Times (Formula)
                    {hasUnsavedLeadTimeChanges && (
                        <span style={{ backgroundColor: '#ef4444', color: '#ffffff', fontSize: '0.7rem', padding: '0.1rem 0.4rem', borderRadius: '10px' }}>
                            Unsaved
                        </span>
                    )}
                </button>
            </div>

            {/* Status Messages */}
            {statusMsg && (
                <div style={{
                    padding: '0.75rem 1rem',
                    borderRadius: '8px',
                    backgroundColor: statusMsg.type === 'success' ? '#f0fdf4' : '#fef2f2',
                    border: statusMsg.type === 'success' ? '1px solid #bbf7d0' : '1px solid #fecaca',
                    color: statusMsg.type === 'success' ? '#166534' : '#991b1b',
                    fontSize: '0.88rem',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                }}>
                    <span>{statusMsg.type === 'success' ? '✅ ' : '⚠️ '}{statusMsg.text}</span>
                    <button onClick={() => setStatusMsg(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}><X size={16} /></button>
                </div>
            )}

            {/* Sub-Tab 1: Overall Weekly Plan Volumes Table */}
            {activeInnerTab === 'volumes' && (
                loading ? (
                <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
                    <RefreshCw size={28} className="animate-spin" style={{ color: '#3b82f6', marginBottom: '0.75rem' }} />
                    <p style={{ margin: 0, fontWeight: 600 }}>Loading Overall SYMB Plan Data...</p>
                </div>
            ) : (
                <div style={{ overflowX: 'auto', borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                        <thead>
                            <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '2px solid #cbd5e1', color: '#334155' }}>
                                <th style={{ padding: '0.9rem 1.25rem', fontWeight: 700, width: '30%' }}>Shipment Week</th>
                                <th style={{ padding: '0.9rem 1.25rem', fontWeight: 700, textAlign: 'center', backgroundColor: '#eff6ff', color: '#1e40af', width: '25%' }}>Variant 1 Planned</th>
                                <th style={{ padding: '0.9rem 1.25rem', fontWeight: 700, textAlign: 'center', backgroundColor: '#f0fdf4', color: '#166534', width: '25%' }}>Variant 2 Planned</th>
                                <th style={{ padding: '0.9rem 1.25rem', fontWeight: 700, textAlign: 'center', width: '20%' }}>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {weeklySummaries.map((summary, idx) => {
                                const isEditing = editingWeek === summary.shipmentWeek;

                                return (
                                    <tr key={summary.shipmentWeek} style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: isEditing ? '#fff7ed' : (idx % 2 === 0 ? '#ffffff' : '#f8fafc') }}>
                                        <td style={{ padding: '0.9rem 1.25rem', fontWeight: 700, color: '#1e293b' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <Calendar size={16} color="#64748b" />
                                                <span>{summary.formattedWeek}</span>
                                            </div>
                                            <span style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'block', marginTop: '0.15rem' }}>
                                                Raw: {summary.shipmentWeek}
                                            </span>
                                        </td>

                                        {/* Variant 1 Planned */}
                                        <td style={{ padding: '0.9rem 1.25rem', textAlign: 'center', backgroundColor: isEditing ? '#eff6ff' : 'transparent' }}>
                                            {isEditing ? (
                                                <input
                                                    type="number"
                                                    min="0"
                                                    value={editV1Planned}
                                                    onChange={e => setEditV1Planned(e.target.value)}
                                                    style={{ width: '110px', padding: '0.4rem', borderRadius: '6px', border: '2px solid #3b82f6', textAlign: 'center', fontWeight: 700, fontSize: '0.95rem' }}
                                                    autoFocus
                                                />
                                            ) : (
                                                <span style={{ fontWeight: 800, fontSize: '1.05rem', color: '#1d4ed8' }}>
                                                    {summary.v1Planned.toLocaleString()}
                                                </span>
                                            )}
                                        </td>

                                        {/* Variant 2 Planned */}
                                        <td style={{ padding: '0.9rem 1.25rem', textAlign: 'center', backgroundColor: isEditing ? '#f0fdf4' : 'transparent' }}>
                                            {isEditing ? (
                                                <input
                                                    type="number"
                                                    min="0"
                                                    value={editV2Planned}
                                                    onChange={e => setEditV2Planned(e.target.value)}
                                                    style={{ width: '110px', padding: '0.4rem', borderRadius: '6px', border: '2px solid #16a34a', textAlign: 'center', fontWeight: 700, fontSize: '0.95rem' }}
                                                />
                                            ) : (
                                                <span style={{ fontWeight: 800, fontSize: '1.05rem', color: '#15803d' }}>
                                                    {summary.v2Planned.toLocaleString()}
                                                </span>
                                            )}
                                        </td>

                                        {/* Action Column */}
                                        <td style={{ padding: '0.9rem 1.25rem', textAlign: 'center' }}>
                                            {isEditing ? (
                                                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                                                    <button
                                                        onClick={() => saveWeeklyPlan(summary.shipmentWeek)}
                                                        disabled={saveLoading}
                                                        style={{
                                                            backgroundColor: '#16a34a',
                                                            color: 'white',
                                                            border: 'none',
                                                            padding: '0.4rem 0.85rem',
                                                            borderRadius: '6px',
                                                            fontWeight: 700,
                                                            fontSize: '0.85rem',
                                                            cursor: saveLoading ? 'not-allowed' : 'pointer',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '0.3rem'
                                                        }}
                                                    >
                                                        <Save size={14} /> {saveLoading ? 'Saving...' : 'Save'}
                                                    </button>
                                                    <button
                                                        onClick={cancelEditing}
                                                        disabled={saveLoading}
                                                        style={{
                                                            backgroundColor: '#e2e8f0',
                                                            color: '#475569',
                                                            border: 'none',
                                                            padding: '0.4rem 0.7rem',
                                                            borderRadius: '6px',
                                                            fontWeight: 600,
                                                            fontSize: '0.85rem',
                                                            cursor: 'pointer'
                                                        }}
                                                    >
                                                        Cancel
                                                    </button>
                                                </div>
                                            ) : isAdmin ? (
                                                <button
                                                    onClick={() => startEditing(summary)}
                                                    style={{
                                                        backgroundColor: '#f1f5f9',
                                                        color: '#2563eb',
                                                        border: '1px solid #cbd5e1',
                                                        padding: '0.4rem 0.9rem',
                                                        borderRadius: '6px',
                                                        fontWeight: 700,
                                                        fontSize: '0.85rem',
                                                        cursor: 'pointer',
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '0.4rem'
                                                    }}
                                                >
                                                    <Edit2 size={14} /> Edit
                                                </button>
                                            ) : (
                                                <span style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.2rem' }}>
                                                    <Lock size={12} /> View Only
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}

                            {weeklySummaries.length === 0 && (
                                <tr>
                                    <td colSpan={4} style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
                                        No SYMB plan records found. {isAdmin ? 'Click "Add / Update Week Plan" above to enter planned numbers.' : ''}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            ))}

            {/* Sub-Tab 2: Stage Lead Times & Completion Formula */}
            {activeInnerTab === 'lead_times' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    
                    {/* Formula Info Banner & Reference Shipment Week Selector */}
                    <div style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '1rem',
                        backgroundColor: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: '10px',
                        padding: '1rem 1.25rem'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', maxWidth: '650px' }}>
                            <Calculator size={22} style={{ color: '#2563eb', marginTop: '0.2rem', flexShrink: 0 }} />
                            <div>
                                <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#1e293b' }}>
                                    Calculation Formula: <code style={{ backgroundColor: '#eff6ff', color: '#1d4ed8', padding: '0.2rem 0.5rem', borderRadius: '4px', border: '1px solid #bfdbfe', fontSize: '0.92rem' }}>Should be completed on = Shipment Week (x) - Weeks + Days</code>
                                </div>
                                <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '0.35rem' }}>
                                    Offsets entered below dynamically determine target deadline dates across all shipment weeks in the Plan Pipeline cards. E.g. For EBOM with <code>9 weeks</code> & <code>3 days</code>, target is <code>x - 9 wks + 3 days</code>.
                                </div>
                            </div>
                        </div>

                        {/* Reference Shipment Week Preview Selector */}
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.6rem',
                            backgroundColor: '#ffffff',
                            padding: '0.5rem 0.85rem',
                            borderRadius: '8px',
                            border: '1px solid #cbd5e1',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                        }}>
                            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#475569', whiteSpace: 'nowrap' }}>
                                Preview Week (x):
                            </span>
                            {weeklySummaries.length > 0 ? (
                                <select
                                    value={selectedRefWeek}
                                    onChange={e => setSelectedRefWeek(e.target.value)}
                                    style={{
                                        border: '1px solid #cbd5e1',
                                        borderRadius: '6px',
                                        padding: '0.35rem 0.6rem',
                                        fontSize: '0.85rem',
                                        fontWeight: 700,
                                        color: '#1e293b',
                                        backgroundColor: '#f8fafc',
                                        outline: 'none',
                                        cursor: 'pointer'
                                    }}
                                >
                                    {weeklySummaries.map(ws => (
                                        <option key={ws.shipmentWeek} value={ws.shipmentWeek}>
                                            {ws.formattedWeek} ({ws.shipmentWeek})
                                        </option>
                                    ))}
                                </select>
                            ) : (
                                <input
                                    type="text"
                                    value={selectedRefWeek || '2026-08-27'}
                                    onChange={e => setSelectedRefWeek(e.target.value)}
                                    placeholder="YYYY-MM-DD"
                                    style={{
                                        border: '1px solid #cbd5e1',
                                        borderRadius: '6px',
                                        padding: '0.35rem 0.6rem',
                                        fontSize: '0.85rem',
                                        fontWeight: 700,
                                        width: '120px'
                                    }}
                                />
                            )}
                        </div>
                    </div>

                    {/* Stage Lead Times Table */}
                    {loadingLeadTimes ? (
                        <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
                            <RefreshCw size={28} className="animate-spin" style={{ color: '#3b82f6', marginBottom: '0.75rem' }} />
                            <p style={{ margin: 0, fontWeight: 600 }}>Loading Stage Lead Times...</p>
                        </div>
                    ) : (
                        <div style={{ overflowX: 'auto', borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                                <thead>
                                    <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '2px solid #cbd5e1', color: '#334155' }}>
                                        <th style={{ padding: '0.85rem 1rem', fontWeight: 700, width: '5%', textAlign: 'center' }}>#</th>
                                        <th style={{ padding: '0.85rem 1.25rem', fontWeight: 700, width: '28%' }}>Stage Name</th>
                                        <th style={{ padding: '0.85rem 1rem', fontWeight: 700, textAlign: 'center', backgroundColor: '#eff6ff', color: '#1e40af', width: '18%' }}>
                                            Weeks Offset (-w)
                                        </th>
                                        <th style={{ padding: '0.85rem 1rem', fontWeight: 700, textAlign: 'center', backgroundColor: '#f0fdf4', color: '#166534', width: '18%' }}>
                                            Days Offset (+d)
                                        </th>
                                        <th style={{ padding: '0.85rem 1rem', fontWeight: 700, textAlign: 'center', width: '17%' }}>Formula</th>
                                        <th style={{ padding: '0.85rem 1.25rem', fontWeight: 700, textAlign: 'center', width: '14%' }}>
                                            Preview Date (x)
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {leadTimes.map((item, idx) => {
                                        const theme = STAGE_COLOR_MAP[item.stage] || { color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe', text: '#1e40af' };
                                        const previewDate = calculatePreviewDate(selectedRefWeek, item.weeks, item.days);
                                        const formulaStr = formatFormulaText(item.weeks, item.days);

                                        return (
                                            <tr key={item.stage} style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: idx % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                                                {/* Order # */}
                                                <td style={{ padding: '0.8rem 1rem', textAlign: 'center', color: '#94a3b8', fontWeight: 700 }}>
                                                    {idx + 1}
                                                </td>

                                                {/* Stage Name */}
                                                <td style={{ padding: '0.8rem 1.25rem' }}>
                                                    <span style={{
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '0.4rem',
                                                        padding: '0.3rem 0.75rem',
                                                        borderRadius: '6px',
                                                        backgroundColor: theme.bg,
                                                        color: theme.text,
                                                        border: `1px solid ${theme.border}`,
                                                        fontWeight: 700,
                                                        fontSize: '0.88rem'
                                                    }}>
                                                         {item.stage === 'All Material Available' ? '100% CTB' : item.stage}
                                                    </span>
                                                </td>

                                                {/* Weeks Offset Input */}
                                                <td style={{ padding: '0.8rem 1rem', textAlign: 'center', backgroundColor: 'rgba(239, 246, 255, 0.4)' }}>
                                                    {isAdmin ? (
                                                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                                                            <input
                                                                type="number"
                                                                value={item.weeks}
                                                                onChange={e => handleLeadTimeChange(item.stage, 'weeks', parseInt(e.target.value) || 0)}
                                                                style={{
                                                                    width: '75px',
                                                                    padding: '0.4rem',
                                                                    borderRadius: '6px',
                                                                    border: '1.5px solid #3b82f6',
                                                                    textAlign: 'center',
                                                                    fontWeight: 800,
                                                                    fontSize: '0.95rem',
                                                                    color: '#1d4ed8'
                                                                }}
                                                            />
                                                            <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>wks</span>
                                                        </div>
                                                    ) : (
                                                        <span style={{ fontWeight: 800, color: '#1d4ed8', fontSize: '1rem' }}>
                                                            {item.weeks} wks
                                                        </span>
                                                    )}
                                                </td>

                                                {/* Days Offset Input */}
                                                <td style={{ padding: '0.8rem 1rem', textAlign: 'center', backgroundColor: 'rgba(240, 253, 244, 0.4)' }}>
                                                    {isAdmin ? (
                                                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                                                            <input
                                                                type="number"
                                                                value={item.days}
                                                                onChange={e => handleLeadTimeChange(item.stage, 'days', parseInt(e.target.value) || 0)}
                                                                style={{
                                                                    width: '75px',
                                                                    padding: '0.4rem',
                                                                    borderRadius: '6px',
                                                                    border: '1.5px solid #16a34a',
                                                                    textAlign: 'center',
                                                                    fontWeight: 800,
                                                                    fontSize: '0.95rem',
                                                                    color: '#15803d'
                                                                }}
                                                            />
                                                            <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>days</span>
                                                        </div>
                                                    ) : (
                                                        <span style={{ fontWeight: 800, color: '#15803d', fontSize: '1rem' }}>
                                                            {item.days} days
                                                        </span>
                                                    )}
                                                </td>

                                                {/* Configured Formula Display */}
                                                <td style={{ padding: '0.8rem 1rem', textAlign: 'center' }}>
                                                    <code style={{
                                                        backgroundColor: '#f1f5f9',
                                                        color: '#334155',
                                                        padding: '0.25rem 0.55rem',
                                                        borderRadius: '5px',
                                                        fontSize: '0.85rem',
                                                        fontWeight: 700,
                                                        border: '1px solid #cbd5e1'
                                                    }}>
                                                        {formulaStr}
                                                    </code>
                                                </td>

                                                {/* Preview Date */}
                                                <td style={{ padding: '0.8rem 1.25rem', textAlign: 'center' }}>
                                                    <div style={{
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '0.35rem',
                                                        color: '#0369a1',
                                                        backgroundColor: '#e0f2fe',
                                                        padding: '0.3rem 0.65rem',
                                                        borderRadius: '6px',
                                                        fontWeight: 700,
                                                        fontSize: '0.85rem'
                                                    }}>
                                                        <Clock size={13} style={{ color: '#0284c7' }} />
                                                        <span>{previewDate}</span>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Bottom Action Footer for Lead Times */}
                    {isAdmin && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                            <span style={{ fontSize: '0.82rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <Info size={15} style={{ color: '#3b82f6' }} />
                                Clicking <strong>Save Lead Times</strong> will recalculate target completion dates for all shipment weeks immediately.
                            </span>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <button
                                    onClick={resetToDefaults}
                                    style={{
                                        backgroundColor: '#f8fafc',
                                        color: '#475569',
                                        border: '1px solid #cbd5e1',
                                        padding: '0.55rem 1rem',
                                        borderRadius: '8px',
                                        fontWeight: 600,
                                        fontSize: '0.88rem',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.4rem'
                                    }}
                                >
                                    <RotateCcw size={15} /> Reset Defaults
                                </button>

                                <button
                                    onClick={() => saveAllLeadTimes()}
                                    disabled={saveLeadTimesLoading}
                                    style={{
                                        backgroundColor: hasUnsavedLeadTimeChanges ? '#16a34a' : '#2563eb',
                                        color: '#ffffff',
                                        border: 'none',
                                        padding: '0.55rem 1.4rem',
                                        borderRadius: '8px',
                                        fontWeight: 700,
                                        fontSize: '0.9rem',
                                        cursor: saveLeadTimesLoading ? 'not-allowed' : 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.4rem',
                                        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                                    }}
                                >
                                    <Save size={16} />
                                    {saveLeadTimesLoading ? 'Saving & Recalculating...' : 'Save Lead Times'}
                                </button>
                            </div>
                        </div>
                    )}

                </div>
            )}

            {/* Modal for Add / Update New Shipment Week Plan */}
            {showAddModal && isAdmin && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
                    <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', padding: '1.75rem', width: '420px', maxWidth: '90vw', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                            <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <Plus size={18} color="#3b82f6" /> Add / Update Shipment Week Plan
                            </h3>
                            <button onClick={() => setShowAddModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}><X size={18} /></button>
                        </div>

                        <form onSubmit={handleAddWeekSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#475569', marginBottom: '0.35rem' }}>
                                    Shipment Week Date
                                </label>
                                <input
                                    type="text"
                                    placeholder="e.g. 07/06/2026 or 2026-07-06"
                                    value={newWeekDate}
                                    onChange={e => setNewWeekDate(e.target.value)}
                                    required
                                    style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.9rem', outline: 'none' }}
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#1d4ed8', marginBottom: '0.35rem' }}>
                                    Variant 1 Planned Quantity
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    value={newV1Planned}
                                    onChange={e => setNewV1Planned(e.target.value)}
                                    required
                                    style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid #bfdbfe', fontSize: '0.9rem', backgroundColor: '#eff6ff', outline: 'none' }}
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#15803d', marginBottom: '0.35rem' }}>
                                    Variant 2 Planned Quantity
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    value={newV2Planned}
                                    onChange={e => setNewV2Planned(e.target.value)}
                                    required
                                    style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid #bbf7d0', fontSize: '0.9rem', backgroundColor: '#f0fdf4', outline: 'none' }}
                                />
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                                <button
                                    type="button"
                                    onClick={() => setShowAddModal(false)}
                                    style={{ padding: '0.55rem 1rem', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', color: '#475569', cursor: 'pointer', fontWeight: 600 }}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={saveLoading}
                                    style={{ padding: '0.55rem 1.2rem', borderRadius: '6px', border: 'none', backgroundColor: '#3b82f6', color: '#ffffff', cursor: saveLoading ? 'not-allowed' : 'pointer', fontWeight: 700 }}
                                >
                                    {saveLoading ? 'Saving...' : 'Save Plan'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

        </div>
    );
}
