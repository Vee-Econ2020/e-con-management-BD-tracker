import React, { useState, useEffect, useMemo } from 'react';
import { Calendar, RefreshCw, Save, Plus, Edit2, Layers, X, Lock } from 'lucide-react';
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

export default function SymbOverallPlanView() {
    const { user } = useAuth();
    const isAdmin = user?.role === 'Admin';

    const [rawPlanData, setRawPlanData] = useState<SymbPlanRow[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
    const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // Editing State
    const [editingWeek, setEditingWeek] = useState<string | null>(null);
    const [editV1Planned, setEditV1Planned] = useState<number | string>('');
    const [editV2Planned, setEditV2Planned] = useState<number | string>('');
    const [saveLoading, setSaveLoading] = useState<boolean>(false);

    // Add New Week State
    const [showAddModal, setShowAddModal] = useState<boolean>(false);
    const [newWeekDate, setNewWeekDate] = useState<string>('');
    const [newV1Planned, setNewV1Planned] = useState<number | string>(0);
    const [newV2Planned, setNewV2Planned] = useState<number | string>(0);

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

    useEffect(() => {
        fetchPlanData();
    }, []);

    const handleRefresh = async () => {
        setIsRefreshing(true);
        await fetchPlanData();
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
            const isV1 = ["V1", "v1", "Variant 1", "Varient 1"].includes(variant);
            const isV2 = ["V2", "v2", "Variant 2", "Varient 2"].includes(variant);

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

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', backgroundColor: '#ffffff', borderRadius: '0 0 12px 12px', padding: '1.5rem', border: '1px solid #e2e8f0', borderTop: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
            
            {/* Header Controls */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                    <h2 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 800, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <Layers size={22} color="#f5ad42" /> Overall SYMB Plan
                    </h2>
                    <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
                        Weekly shipment plan breakdown for Variant 1 & Variant 2. {isAdmin ? 'Update planned numbers directly below.' : 'View-only access (Admin permissions required to edit).'}
                    </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    {isAdmin && (
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

            {/* Overall Weekly Plan Table */}
            {loading ? (
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
