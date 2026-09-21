import React, { useState, useEffect, useMemo } from 'react';
import { 
    Clock, ShieldCheck, ShieldAlert, AlertCircle, 
    ChevronDown, ChevronUp, ArrowUpRight, 
    RefreshCw, Filter, Eye, EyeOff, Layers, Activity,
    TrendingDown
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export interface SymbPlanRow {
    _id?: string;
    id?: string;
    "Shipment Week": string;
    "Event Type": string;
    "Variant Type": string;
    "Last Batch Date"?: string;
    "Estimated Completion Date"?: string;
    "Actual Completed Date"?: string;
    actual_completed_date?: string;
    completed?: number | string;
    "planned Value"?: number | string;
    "Material Covered"?: string;
    [key: string]: any;
}

export interface WeekBufferAnalysis {
    weekStr: string;
    shipDate: Date;
    targetFgDate: Date;
    projectedFgDate: Date;
    actualFgDate: Date | null;
    isFgCompleted: boolean;
    maxSlippageDays: number;
    bufferDays: number;
    bufferWeeks: number;
    status: 'healthy' | 'consumed' | 'at_risk' | 'breached';
    primaryEaterStage: string;
    stageBreakdowns: {
        stage: string;
        targetDate: Date | null;
        actualDate: Date | null;
        estDate: Date | null;
        slippageDays: number;
        isCompleted: boolean;
    }[];
    v1Planned: number;
    v2Planned: number;
    totalPlanned: number;
}

function parseDateSafe(val: any): Date | null {
    if (!val) return null;
    const str = String(val).trim();
    if (!str || ['none', 'nan', 'nat', 'null', '-', 'unknown'].includes(str.toLowerCase())) return null;

    const isoMatch = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
    if (isoMatch) {
        return new Date(parseInt(isoMatch[1], 10), parseInt(isoMatch[2], 10) - 1, parseInt(isoMatch[3], 10));
    }

    const match = str.match(/^(\d{1,2})[-/\s]+([A-Za-z]+)[-/\s]+(\d{2,4})/);
    if (match) {
        const day = parseInt(match[1], 10);
        const monthStr = match[2].toLowerCase();
        let year = parseInt(match[3], 10);
        if (year < 100) year += 2000;
        const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
        const monthIdx = months.findIndex(m => monthStr.startsWith(m));
        if (!isNaN(day) && monthIdx >= 0 && !isNaN(year)) {
            return new Date(year, monthIdx, day);
        }
    }

    const d = new Date(str);
    return isNaN(d.getTime()) ? null : d;
}

interface SymbBufferAnalysisViewProps {
    showBufferData?: boolean;
    onToggleBufferData?: () => void;
    onNavigateToPipelineWeek?: (weekStr: string) => void;
}

const SymbBufferAnalysisView: React.FC<SymbBufferAnalysisViewProps> = ({
    showBufferData = true,
    onToggleBufferData,
    onNavigateToPipelineWeek
}) => {
    const { user } = useAuth();
    const isAdmin = user?.role === 'Admin';

    const [data, setData] = useState<SymbPlanRow[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

    // Filters & Sorting
    const [bufferFilter, setBufferFilter] = useState<'all' | 'at_risk' | 'breached' | 'healthy'>('all');
    const [bufferSortMode, setBufferSortMode] = useState<'least_buffer' | 'chronological'>('least_buffer');
    const [selectedBufferStage, setSelectedBufferStage] = useState<string | null>(null);
    const [expandedWeekCards, setExpandedWeekCards] = useState<Record<string, boolean>>({});

    const BUFFER_STAGES = useMemo(() => [
        "EBOM covered",
        "PCBA covered",
        "All Material Available",
        "Materials Issued",
        "Active alignment",
        "Production/Assembly",
        "FQC",
        "Finished goods"
    ], []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const res = await fetch('/api/admin/symb-plan/transformed');
            if (res.ok) {
                const json = await res.json();
                setData(json);
            }
        } catch (error) {
            console.error("Error fetching buffer pipeline data:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleRefresh = async () => {
        try {
            setIsRefreshing(true);
            const res = await fetch('/api/admin/symb-plan/transformed');
            if (res.ok) {
                const json = await res.json();
                setData(json);
            }
        } catch (error) {
            console.error("Error refreshing buffer data:", error);
        } finally {
            setIsRefreshing(false);
        }
    };

    const toggleCardExpand = (weekStr: string) => {
        setExpandedWeekCards(prev => ({
            ...prev,
            [weekStr]: !prev[weekStr]
        }));
    };

    // Group rows by shipment week
    const groupedByWeek = useMemo(() => {
        const map: Record<string, SymbPlanRow[]> = {};
        data.forEach(r => {
            const w = r["Shipment Week"];
            if (w) {
                if (!map[w]) map[w] = [];
                map[w].push(r);
            }
        });
        return map;
    }, [data]);

    const sortedShipmentWeeks = useMemo(() => {
        return Object.keys(groupedByWeek).sort((a, b) => {
            const da = parseDateSafe(a)?.getTime() || 0;
            const db = parseDateSafe(b)?.getTime() || 0;
            return da - db;
        });
    }, [groupedByWeek]);

    // Calculate buffer status for every shipment week
    const weeklyBufferData = useMemo(() => {
        const today = new Date();
        const todayMid = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();

        const list: WeekBufferAnalysis[] = [];

        sortedShipmentWeeks.forEach(weekStr => {
            const rows = groupedByWeek[weekStr] || [];
            const shipDate = parseDateSafe(weekStr) || new Date();
            
            // Standard target: Finished Goods must complete 4 weeks (28 days) before shipment date
            const targetFgDate = new Date(shipDate.getTime() - (28 * 86400000));

            // Find Finished Goods row
            const fgRows = rows.filter(r => r["Event Type"] === "Finished goods");
            const isFgCompleted = fgRows.length > 0 && fgRows.every(r => 
                r["Material Covered"] === "Yes" || (Number(r["planned Value"] || 0) > 0 && Number(r.completed || 0) >= Number(r["planned Value"] || 0))
            );

            let actualFgDate: Date | null = null;
            if (isFgCompleted && fgRows.length > 0) {
                const dates = fgRows.map(r => parseDateSafe(r["Actual Completed Date"] || r.actual_completed_date)).filter(Boolean) as Date[];
                if (dates.length > 0) {
                    actualFgDate = new Date(Math.max(...dates.map(d => d.getTime())));
                }
            }

            let maxSlippageDays = 0;
            let primaryEaterStage = 'All on track';

            const stageBreakdowns = BUFFER_STAGES.map(stageName => {
                const stageRows = rows.filter(r => r["Event Type"] === stageName);
                if (stageRows.length === 0) {
                    return {
                        stage: stageName,
                        targetDate: null,
                        actualDate: null,
                        estDate: null,
                        slippageDays: 0,
                        isCompleted: false
                    };
                }

                // Target date from Last Batch Date
                const targetDates = stageRows.map(r => parseDateSafe(r["Last Batch Date"])).filter(Boolean) as Date[];
                const targetDate = targetDates.length > 0 ? targetDates[0] : null;

                const isCompleted = stageRows.every(r => 
                    r["Material Covered"] === "Yes" || (Number(r["planned Value"] || 0) > 0 && Number(r.completed || 0) >= Number(r["planned Value"] || 0))
                );

                const actualDates = stageRows.map(r => parseDateSafe(r["Actual Completed Date"] || r.actual_completed_date)).filter(Boolean) as Date[];
                const actualDate = actualDates.length > 0 ? new Date(Math.max(...actualDates.map(d => d.getTime()))) : null;

                const estDates = stageRows.map(r => parseDateSafe(r["Estimated Completion Date"])).filter(Boolean) as Date[];
                const estDate = estDates.length > 0 ? new Date(Math.max(...estDates.map(d => d.getTime()))) : null;

                let slippageDays = 0;
                if (targetDate) {
                    if (isCompleted) {
                        if (actualDate) {
                            slippageDays = Math.max(0, Math.round((actualDate.getTime() - targetDate.getTime()) / 86400000));
                        }
                    } else {
                        if (estDate) {
                            slippageDays = Math.max(0, Math.round((estDate.getTime() - targetDate.getTime()) / 86400000));
                        } else if (todayMid > targetDate.getTime()) {
                            slippageDays = Math.max(0, Math.round((todayMid - targetDate.getTime()) / 86400000));
                        }
                    }
                }

                if (slippageDays > maxSlippageDays) {
                    maxSlippageDays = slippageDays;
                    primaryEaterStage = stageName;
                }

                return {
                    stage: stageName,
                    targetDate,
                    actualDate,
                    estDate,
                    slippageDays,
                    isCompleted
                };
            });

            const bufferDays = 28 - maxSlippageDays;
            const bufferWeeks = Number((bufferDays / 7.0).toFixed(1));
            const projectedFgDate = new Date(targetFgDate.getTime() + (maxSlippageDays * 86400000));

            let status: 'healthy' | 'consumed' | 'at_risk' | 'breached';
            if (bufferWeeks >= 3.5) status = 'healthy';
            else if (bufferWeeks >= 2.0) status = 'consumed';
            else if (bufferWeeks > 0.0) status = 'at_risk';
            else status = 'breached';

            let v1Planned = 0;
            let v2Planned = 0;
            rows.forEach(r => {
                const v = (r["Variant Type"] || "").toLowerCase();
                const p = Number(r["planned Value"] || 0);
                if (v.includes("1") && p > v1Planned) v1Planned = p;
                if (v.includes("2") && p > v2Planned) v2Planned = p;
            });

            list.push({
                weekStr,
                shipDate,
                targetFgDate,
                projectedFgDate,
                actualFgDate,
                isFgCompleted,
                maxSlippageDays,
                bufferDays,
                bufferWeeks,
                status,
                primaryEaterStage: maxSlippageDays > 0 ? primaryEaterStage : 'All on track',
                stageBreakdowns,
                v1Planned,
                v2Planned,
                totalPlanned: v1Planned + v2Planned
            });
        });

        return list;
    }, [sortedShipmentWeeks, groupedByWeek, BUFFER_STAGES]);

    // High-level Executive KPIs
    const bufferExecutiveKPIs = useMemo(() => {
        if (weeklyBufferData.length === 0) {
            return {
                avgBufferWeeks: 4.0,
                avgBufferDays: 28,
                healthyCount: 0,
                consumedCount: 0,
                atRiskCount: 0,
                breachedCount: 0,
                totalWeeks: 0,
                topBottleneckStage: 'None',
                topBottleneckAvgDays: 0,
                topBottleneckWeeksCount: 0
            };
        }

        const totalWeeks = weeklyBufferData.length;
        const totalBufferDays = weeklyBufferData.reduce((sum, w) => sum + w.bufferDays, 0);
        const avgBufferDays = Math.round(totalBufferDays / totalWeeks);
        const avgBufferWeeks = Number((avgBufferDays / 7.0).toFixed(1));

        let healthyCount = 0;
        let consumedCount = 0;
        let atRiskCount = 0;
        let breachedCount = 0;

        weeklyBufferData.forEach(w => {
            if (w.status === 'healthy') healthyCount++;
            else if (w.status === 'consumed') consumedCount++;
            else if (w.status === 'at_risk') atRiskCount++;
            else if (w.status === 'breached') breachedCount++;
        });

        // Stage attribution: average slippage per stage across batches
        const stageTotals: Record<string, { totalDays: number; count: number }> = {};
        BUFFER_STAGES.forEach(s => { stageTotals[s] = { totalDays: 0, count: 0 }; });

        weeklyBufferData.forEach(w => {
            w.stageBreakdowns.forEach(sb => {
                if (sb.slippageDays > 0) {
                    stageTotals[sb.stage].totalDays += sb.slippageDays;
                    stageTotals[sb.stage].count += 1;
                }
            });
        });

        let topBottleneckStage = 'All on track';
        let topBottleneckAvgDays = 0;
        let topBottleneckWeeksCount = 0;
        let highestTotal = 0;

        Object.entries(stageTotals).forEach(([stg, val]) => {
            if (val.totalDays > highestTotal) {
                highestTotal = val.totalDays;
                topBottleneckStage = stg;
                topBottleneckAvgDays = val.count > 0 ? Math.round(val.totalDays / val.count) : 0;
                topBottleneckWeeksCount = val.count;
            }
        });

        return {
            avgBufferWeeks,
            avgBufferDays,
            healthyCount,
            consumedCount,
            atRiskCount,
            breachedCount,
            totalWeeks,
            topBottleneckStage,
            topBottleneckAvgDays,
            topBottleneckWeeksCount
        };
    }, [weeklyBufferData, BUFFER_STAGES]);

    // Stage Buffer Attribution Ranking - DISPLAYS AVERAGE DAYS ONLY
    const stageBufferAttribution = useMemo(() => {
        const list: { 
            stage: string; 
            avgDaysPerBatch: number; 
            avgWeeksPerBatch: number;
            impactedWeeksCount: number; 
            pctShare: number;
        }[] = [];

        let grandTotalDays = 0;
        const stageRawData: Record<string, { totalDays: number; count: number }> = {};

        BUFFER_STAGES.forEach(stageName => {
            stageRawData[stageName] = { totalDays: 0, count: 0 };

            weeklyBufferData.forEach(w => {
                const sb = w.stageBreakdowns.find(s => s.stage === stageName);
                if (sb && sb.slippageDays > 0) {
                    stageRawData[stageName].totalDays += sb.slippageDays;
                    stageRawData[stageName].count += 1;
                }
            });

            grandTotalDays += stageRawData[stageName].totalDays;
        });

        BUFFER_STAGES.forEach(stageName => {
            const raw = stageRawData[stageName];
            const avgDaysPerBatch = raw.count > 0 ? Math.round(raw.totalDays / raw.count) : 0;
            const avgWeeksPerBatch = Number((avgDaysPerBatch / 7.0).toFixed(1));
            const pctShare = grandTotalDays > 0 ? Math.round((raw.totalDays / grandTotalDays) * 100) : 0;

            list.push({
                stage: stageName,
                avgDaysPerBatch,
                avgWeeksPerBatch,
                impactedWeeksCount: raw.count,
                pctShare
            });
        });

        return list.sort((a, b) => b.avgDaysPerBatch - a.avgDaysPerBatch);
    }, [weeklyBufferData, BUFFER_STAGES]);

    // Filtered & Sorted Weekly Buffer List
    const filteredWeeklyBufferList = useMemo(() => {
        let list = [...weeklyBufferData];

        if (selectedBufferStage) {
            list = list.filter(w => {
                const sb = w.stageBreakdowns.find(s => s.stage === selectedBufferStage);
                return sb && sb.slippageDays > 0;
            });
        }

        if (bufferFilter === 'at_risk') {
            list = list.filter(w => w.status === 'at_risk');
        } else if (bufferFilter === 'breached') {
            list = list.filter(w => w.status === 'breached');
        } else if (bufferFilter === 'healthy') {
            list = list.filter(w => w.status === 'healthy');
        }

        if (bufferSortMode === 'least_buffer') {
            list.sort((a, b) => a.bufferDays - b.bufferDays);
        } else {
            list.sort((a, b) => a.shipDate.getTime() - b.shipDate.getTime());
        }

        return list;
    }, [weeklyBufferData, selectedBufferStage, bufferFilter, bufferSortMode]);

    const getStageThemeColor = (stage: string) => {
        switch (stage) {
            case 'EBOM covered': return { color: '#4f46e5', bg: '#eef2ff', border: '#c7d2fe' };
            case 'PCBA covered': return { color: '#0284c7', bg: '#f0f9ff', border: '#bae6fd' };
            case 'All Material Available':
            case '100% CTB': return { color: '#d97706', bg: '#fffbeb', border: '#fde68a' };
            case 'Materials Issued': return { color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe' };
            case 'Active alignment': return { color: '#ea580c', bg: '#fff7ed', border: '#fed7aa' };
            case 'Production/Assembly': return { color: '#0d9488', bg: '#f0fdfa', border: '#99f6e4' };
            case 'FQC': return { color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' };
            case 'Finished goods': return { color: '#059669', bg: '#ecfdf5', border: '#a7f3d0' };
            default: return { color: '#475569', bg: '#f8fafc', border: '#e2e8f0' };
        }
    };

    const getStatusStyle = (status: 'healthy' | 'consumed' | 'at_risk' | 'breached') => {
        switch (status) {
            case 'healthy':
                return { bg: '#ecfdf5', color: '#065f46', border: '#a7f3d0', label: 'Healthy (Full Cushion)' };
            case 'consumed':
                return { bg: '#fffbeb', color: '#92400e', border: '#fde68a', label: 'Buffer Consumed' };
            case 'at_risk':
                return { bg: '#fff7ed', color: '#9a3412', border: '#fed7aa', label: 'At Risk (< 2 wks)' };
            case 'breached':
                return { bg: '#fef2f2', color: '#991b1b', border: '#fecaca', label: 'Breached (Overdue)' };
        }
    };

    if (loading) {
        return (
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '4rem',
                backgroundColor: '#ffffff',
                borderRadius: '12px',
                border: '1px solid #e2e8f0',
                gap: '0.75rem',
                color: '#64748b'
            }}>
                <RefreshCw size={24} className="animate-spin" style={{ color: '#f5ad42' }} />
                <span style={{ fontSize: '1rem', fontWeight: 600 }}>Calculating 4-Week Finished Goods Buffer Models...</span>
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            
            {/* Header Control & Risk Banner */}
            <div style={{
                backgroundColor: '#0f172a',
                borderRadius: '12px',
                padding: '1.25rem 1.5rem',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '1rem',
                flexWrap: 'wrap',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                border: '1px solid #334155'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                    <div style={{ backgroundColor: 'rgba(245, 173, 66, 0.15)', color: '#f5ad42', padding: '0.65rem', borderRadius: '10px', display: 'flex' }}>
                        <Clock size={26} />
                    </div>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                Executive Production Risk & Buffer Intelligence
                            </span>
                            {isAdmin && (
                                <span style={{
                                    fontSize: '0.68rem',
                                    backgroundColor: showBufferData ? '#065f46' : '#991b1b',
                                    color: '#ffffff',
                                    padding: '0.15rem 0.5rem',
                                    borderRadius: '9999px',
                                    fontWeight: 800,
                                    letterSpacing: '0.03em'
                                }}>
                                    {showBufferData ? 'ACTIVE' : 'HIDDEN'}
                                </span>
                            )}
                        </div>
                        <h2 style={{ margin: '0.2rem 0 0 0', fontSize: '1.45rem', fontWeight: 800, color: '#f8fafc' }}>
                            Buffer Available & Execution Lead Time Analysis
                        </h2>
                        <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.82rem', color: '#94a3b8' }}>
                            Standard Operating Policy: Cameras must reach <strong>Finished Goods 4 weeks (28 days)</strong> before the customer shipment week.
                        </p>
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                    {/* Admin Hide/Show Persistent Toggle */}
                    {isAdmin && onToggleBufferData && (
                        <button
                            type="button"
                            onClick={onToggleBufferData}
                            title={showBufferData ? "Buffer data is currently visible. Click to hide." : "Buffer data is hidden. Click to show."}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.45rem',
                                padding: '0.5rem 0.9rem',
                                borderRadius: '8px',
                                fontSize: '0.82rem',
                                fontWeight: 700,
                                border: `1px solid ${showBufferData ? '#34d399' : '#f87171'}`,
                                backgroundColor: showBufferData ? 'rgba(6, 95, 70, 0.4)' : 'rgba(153, 27, 27, 0.45)',
                                color: showBufferData ? '#a7f3d0' : '#fecaca',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease'
                            }}
                        >
                            {showBufferData ? <Eye size={16} color="#34d399" /> : <EyeOff size={16} color="#f87171" />}
                            <span>{showBufferData ? 'Buffer Data: Visible' : 'Buffer Data: Hidden'}</span>
                            <span style={{ fontSize: '0.7rem', padding: '0.1rem 0.35rem', borderRadius: '4px', backgroundColor: 'rgba(255,255,255,0.15)' }}>
                                Toggle
                            </span>
                        </button>
                    )}

                    <button
                        type="button"
                        onClick={handleRefresh}
                        disabled={isRefreshing}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.4rem',
                            padding: '0.5rem 0.85rem',
                            backgroundColor: 'rgba(255, 255, 255, 0.1)',
                            color: '#f8fafc',
                            border: '1px solid rgba(255, 255, 255, 0.2)',
                            borderRadius: '8px',
                            fontSize: '0.82rem',
                            fontWeight: 700,
                            cursor: 'pointer'
                        }}
                    >
                        <RefreshCw size={15} className={isRefreshing ? "animate-spin" : ""} />
                        <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
                    </button>
                </div>
            </div>

            {/* If Buffer Data is Hidden by Admin, Show a Clear Warning & Enable Button */}
            {!showBufferData && (
                <div style={{
                    backgroundColor: '#fef2f2',
                    border: '1px solid #fecaca',
                    borderRadius: '10px',
                    padding: '1rem 1.25rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '1rem'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <ShieldAlert size={22} color="#dc2626" />
                        <div>
                            <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#991b1b' }}>
                                Buffer Data is Currently Hidden in Admin
                            </div>
                            <div style={{ fontSize: '0.8rem', color: '#b91c1c' }}>
                                This buffer tab and all weekly buffer badges are disabled and hidden from regular users until you click "Enable Buffer Data".
                            </div>
                        </div>
                    </div>
                    {isAdmin && onToggleBufferData && (
                        <button
                            type="button"
                            onClick={onToggleBufferData}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.4rem',
                                padding: '0.5rem 1rem',
                                backgroundColor: '#dc2626',
                                color: '#ffffff',
                                border: 'none',
                                borderRadius: '6px',
                                fontSize: '0.82rem',
                                fontWeight: 700,
                                cursor: 'pointer'
                            }}
                        >
                            <Eye size={15} />
                            <span>Enable Buffer Data</span>
                        </button>
                    )}
                </div>
            )}

            {/* KPI Summary Cards Grid */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
                gap: '1rem'
            }}>
                {/* Card 1: Avg Buffer Available */}
                <div style={{
                    backgroundColor: bufferExecutiveKPIs.avgBufferWeeks >= 3.5 ? '#ecfdf5' : bufferExecutiveKPIs.avgBufferWeeks >= 2.0 ? '#fffbeb' : '#fef2f2',
                    border: `1px solid ${bufferExecutiveKPIs.avgBufferWeeks >= 3.5 ? '#a7f3d0' : bufferExecutiveKPIs.avgBufferWeeks >= 2.0 ? '#fde68a' : '#fecaca'}`,
                    borderRadius: '10px',
                    padding: '1.1rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.35rem',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
                }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#475569', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span>AVG BUFFER IN HAND</span>
                        <Clock size={16} style={{ color: bufferExecutiveKPIs.avgBufferWeeks >= 3.5 ? '#059669' : '#d97706' }} />
                    </div>
                    <div style={{ fontSize: '1.85rem', fontWeight: 900, color: bufferExecutiveKPIs.avgBufferWeeks >= 3.5 ? '#065f46' : bufferExecutiveKPIs.avgBufferWeeks >= 2.0 ? '#92400e' : '#991b1b' }}>
                        {bufferExecutiveKPIs.avgBufferWeeks} <span style={{ fontSize: '1.05rem', fontWeight: 700 }}>weeks</span>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                        {bufferExecutiveKPIs.avgBufferDays} days avg cushion across {bufferExecutiveKPIs.totalWeeks} batches
                    </div>
                    {/* Progress bar */}
                    <div style={{ marginTop: '0.35rem', width: '100%', height: '6px', backgroundColor: '#e2e8f0', borderRadius: '9999px', overflow: 'hidden' }}>
                        <div style={{
                            width: `${Math.min(100, Math.max(0, Math.round((bufferExecutiveKPIs.avgBufferDays / 28) * 100)))}%`,
                            height: '100%',
                            backgroundColor: bufferExecutiveKPIs.avgBufferWeeks >= 3.5 ? '#10b981' : bufferExecutiveKPIs.avgBufferWeeks >= 2.0 ? '#f59e0b' : '#ef4444',
                            borderRadius: '9999px'
                        }} />
                    </div>
                </div>

                {/* Card 2: Healthy Weeks */}
                <div style={{
                    backgroundColor: '#f0fdf4',
                    border: '1px solid #bbf7d0',
                    borderRadius: '10px',
                    padding: '1.1rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.35rem',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
                }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#166534', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span>HEALTHY WEEKS</span>
                        <ShieldCheck size={17} style={{ color: '#16a34a' }} />
                    </div>
                    <div style={{ fontSize: '1.85rem', fontWeight: 900, color: '#15803d' }}>
                        {bufferExecutiveKPIs.healthyCount} <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#166534' }}>/ {bufferExecutiveKPIs.totalWeeks} wks</span>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#166534' }}>
                        Full 4-week safety cushion intact (≥ 3.5 wks)
                    </div>
                </div>

                {/* Card 3: At Risk & Depleted Weeks */}
                <div style={{
                    backgroundColor: bufferExecutiveKPIs.atRiskCount > 0 ? '#fff7ed' : '#f8fafc',
                    border: `1px solid ${bufferExecutiveKPIs.atRiskCount > 0 ? '#fed7aa' : '#e2e8f0'}`,
                    borderRadius: '10px',
                    padding: '1.1rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.35rem',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
                }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#9a3412', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span>BUFFER ERODED (AT RISK)</span>
                        <TrendingDown size={17} style={{ color: '#ea580c' }} />
                    </div>
                    <div style={{ fontSize: '1.85rem', fontWeight: 900, color: '#c2410c' }}>
                        {bufferExecutiveKPIs.atRiskCount + bufferExecutiveKPIs.consumedCount} <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#9a3412' }}>weeks</span>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#7c2d12' }}>
                        {bufferExecutiveKPIs.atRiskCount} critical (&lt; 2 wks) • {bufferExecutiveKPIs.consumedCount} caution (2-3.4 wks)
                    </div>
                </div>

                {/* Card 4: Breached & Top Culprit */}
                <div style={{
                    backgroundColor: bufferExecutiveKPIs.breachedCount > 0 ? '#fef2f2' : '#f8fafc',
                    border: `1px solid ${bufferExecutiveKPIs.breachedCount > 0 ? '#fecaca' : '#e2e8f0'}`,
                    borderRadius: '10px',
                    padding: '1.1rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.35rem',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
                }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#991b1b', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span>CRITICAL / BREACHED</span>
                        <AlertCircle size={17} style={{ color: '#dc2626' }} />
                    </div>
                    <div style={{ fontSize: '1.85rem', fontWeight: 900, color: '#b91c1c' }}>
                        {bufferExecutiveKPIs.breachedCount} <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#991b1b' }}>weeks</span>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#7f1d1d' }}>
                        Top Eater: <strong>{bufferExecutiveKPIs.topBottleneckStage}</strong> (Avg -{bufferExecutiveKPIs.topBottleneckAvgDays}d / batch)
                    </div>
                </div>
            </div>

            {/* Stage Attribution Breakdown ("Which Stage is Eating Buffer?") - AVERAGE DAYS ONLY */}
            <div style={{
                backgroundColor: '#ffffff',
                borderRadius: '12px',
                border: '1px solid #e2e8f0',
                padding: '1.25rem',
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Activity size={20} style={{ color: '#6366f1' }} />
                        <div>
                            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#1e293b' }}>
                                Which Stage is Eating Buffer Time? (Factory Attribution)
                            </h3>
                            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                Showing <strong>Average Lead-Time Delay per Batch</strong> (e.g. ~37 days per impacted batch) rather than cumulative numbers. Click a stage card to filter shipments below.
                            </span>
                        </div>
                    </div>
                    {selectedBufferStage && (
                        <button
                            type="button"
                            onClick={() => setSelectedBufferStage(null)}
                            style={{
                                fontSize: '0.75rem',
                                padding: '0.3rem 0.75rem',
                                borderRadius: '6px',
                                backgroundColor: '#f1f5f9',
                                color: '#334155',
                                border: '1px solid #cbd5e1',
                                cursor: 'pointer',
                                fontWeight: 700
                            }}
                        >
                            Clear Filter: <strong>{selectedBufferStage}</strong> ✕
                        </button>
                    )}
                </div>

                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                    gap: '0.85rem'
                }}>
                    {stageBufferAttribution.map(item => {
                        const isSelected = selectedBufferStage === item.stage;
                        const theme = getStageThemeColor(item.stage);
                        const hasDelay = item.avgDaysPerBatch > 0;

                        return (
                            <div 
                                key={item.stage}
                                onClick={() => setSelectedBufferStage(isSelected ? null : item.stage)}
                                style={{
                                    backgroundColor: isSelected ? '#eff6ff' : '#ffffff',
                                    border: `1px solid ${isSelected ? '#3b82f6' : hasDelay ? '#fed7aa' : '#e2e8f0'}`,
                                    borderRadius: '10px',
                                    padding: '0.85rem 1rem',
                                    cursor: 'pointer',
                                    transition: 'all 0.15s ease',
                                    boxShadow: isSelected ? '0 0 0 2px #93c5fd' : '0 1px 3px rgba(0,0,0,0.03)'
                                }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.45rem', gap: '0.5rem' }}>
                                    <span style={{ fontSize: '0.88rem', fontWeight: 800, color: theme.color }}>
                                        {item.stage === 'All Material Available' ? '100% CTB' : item.stage}
                                    </span>
                                    {/* Average Days ONLY (No scary cumulative totals) */}
                                    <span style={{
                                        fontSize: '0.74rem',
                                        fontWeight: 800,
                                        padding: '0.2rem 0.6rem',
                                        borderRadius: '9999px',
                                        backgroundColor: hasDelay ? '#fee2e2' : '#dcfce7',
                                        color: hasDelay ? '#b91c1c' : '#166534',
                                        border: `1px solid ${hasDelay ? '#fca5a5' : '#86efac'}`,
                                        whiteSpace: 'nowrap'
                                    }}>
                                        {hasDelay ? `Avg: -${item.avgDaysPerBatch}d / batch` : '✓ 0d (On Track)'}
                                    </span>
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', color: '#64748b', marginBottom: '0.45rem' }}>
                                    <span>Impacts: <strong>{item.impactedWeeksCount} batches</strong> {hasDelay && `(~${item.avgWeeksPerBatch} wks avg)`}</span>
                                    <span>{item.pctShare}% delay</span>
                                </div>

                                {/* Relative Impact Meter */}
                                <div style={{ width: '100%', height: '5px', backgroundColor: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
                                    <div style={{
                                        width: `${Math.min(100, Math.max(0, item.pctShare))}%`,
                                        height: '100%',
                                        backgroundColor: hasDelay ? '#ef4444' : '#10b981',
                                        borderRadius: '4px'
                                    }} />
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Filter & Sort Controls */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '0.75rem',
                backgroundColor: '#ffffff',
                padding: '0.85rem 1.25rem',
                borderRadius: '10px',
                border: '1px solid #e2e8f0'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <Filter size={15} style={{ color: '#64748b' }} />
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569' }}>Filter Batches:</span>
                    
                    <button
                        type="button"
                        onClick={() => setBufferFilter('all')}
                        style={{
                            padding: '0.3rem 0.8rem',
                            fontSize: '0.76rem',
                            borderRadius: '6px',
                            border: '1px solid #cbd5e1',
                            backgroundColor: bufferFilter === 'all' ? '#1e293b' : '#ffffff',
                            color: bufferFilter === 'all' ? '#ffffff' : '#475569',
                            fontWeight: 700,
                            cursor: 'pointer'
                        }}
                    >
                        All Weeks ({weeklyBufferData.length})
                    </button>

                    <button
                        type="button"
                        onClick={() => setBufferFilter('at_risk')}
                        style={{
                            padding: '0.3rem 0.8rem',
                            fontSize: '0.76rem',
                            borderRadius: '6px',
                            border: '1px solid #fed7aa',
                            backgroundColor: bufferFilter === 'at_risk' ? '#ea580c' : '#fff7ed',
                            color: bufferFilter === 'at_risk' ? '#ffffff' : '#9a3412',
                            fontWeight: 700,
                            cursor: 'pointer'
                        }}
                    >
                        At Risk (&lt; 2 wks) ({bufferExecutiveKPIs.atRiskCount})
                    </button>

                    <button
                        type="button"
                        onClick={() => setBufferFilter('breached')}
                        style={{
                            padding: '0.3rem 0.8rem',
                            fontSize: '0.76rem',
                            borderRadius: '6px',
                            border: '1px solid #fecaca',
                            backgroundColor: bufferFilter === 'breached' ? '#dc2626' : '#fef2f2',
                            color: bufferFilter === 'breached' ? '#ffffff' : '#991b1b',
                            fontWeight: 700,
                            cursor: 'pointer'
                        }}
                    >
                        Breached (≤ 0 wks) ({bufferExecutiveKPIs.breachedCount})
                    </button>

                    <button
                        type="button"
                        onClick={() => setBufferFilter('healthy')}
                        style={{
                            padding: '0.3rem 0.8rem',
                            fontSize: '0.76rem',
                            borderRadius: '6px',
                            border: '1px solid #a7f3d0',
                            backgroundColor: bufferFilter === 'healthy' ? '#059669' : '#ecfdf5',
                            color: bufferFilter === 'healthy' ? '#ffffff' : '#065f46',
                            fontWeight: 700,
                            cursor: 'pointer'
                        }}
                    >
                        Healthy (≥ 3.5 wks) ({bufferExecutiveKPIs.healthyCount})
                    </button>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.78rem', color: '#64748b' }}>Sort By:</span>
                    <select
                        value={bufferSortMode}
                        onChange={e => setBufferSortMode(e.target.value as any)}
                        style={{
                            padding: '0.3rem 0.7rem',
                            fontSize: '0.78rem',
                            borderRadius: '6px',
                            border: '1px solid #cbd5e1',
                            backgroundColor: '#ffffff',
                            color: '#334155',
                            fontWeight: 600,
                            outline: 'none'
                        }}
                    >
                        <option value="least_buffer">Least Buffer First (Highest Risk)</option>
                        <option value="chronological">Chronological (Shipment Date)</option>
                    </select>
                </div>
            </div>

            {/* Grid of Shipment Week Buffer Cards */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                gap: '1rem'
            }}>
                {filteredWeeklyBufferList.length === 0 ? (
                    <div style={{
                        gridColumn: '1 / -1',
                        textAlign: 'center',
                        padding: '3rem',
                        backgroundColor: '#ffffff',
                        borderRadius: '12px',
                        border: '1px solid #e2e8f0',
                        color: '#64748b'
                    }}>
                        <Layers size={32} style={{ margin: '0 auto 0.5rem auto', color: '#94a3b8' }} />
                        <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#334155' }}>
                            No shipment batches match the selected criteria
                        </div>
                        <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.25rem' }}>
                            Try clearing your stage filter or switching to "All Weeks".
                        </div>
                    </div>
                ) : (
                    filteredWeeklyBufferList.map(item => {
                        const style = getStatusStyle(item.status);
                        const isExpanded = !!expandedWeekCards[item.weekStr];
                        const targetFgFormatted = item.targetFgDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
                        const projectedFgFormatted = item.isFgCompleted && item.actualFgDate
                            ? item.actualFgDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                            : item.projectedFgDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

                        return (
                            <div 
                                key={item.weekStr}
                                style={{
                                    backgroundColor: '#ffffff',
                                    borderRadius: '10px',
                                    padding: '1rem',
                                    border: `1px solid ${style.border}`,
                                    borderLeft: `5px solid ${style.color}`,
                                    boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '0.55rem'
                                }}
                            >
                                {/* Card Header */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>Shipment Week</span>
                                        <div style={{ fontSize: '1rem', fontWeight: 800, color: '#1e293b' }}>
                                            {item.weekStr}
                                        </div>
                                    </div>
                                    <span style={{
                                        fontSize: '0.76rem',
                                        fontWeight: 800,
                                        padding: '0.2rem 0.6rem',
                                        borderRadius: '12px',
                                        backgroundColor: style.bg,
                                        color: style.color,
                                        border: `1px solid ${style.border}`
                                    }}>
                                        Buffer: {item.bufferWeeks} wks
                                    </span>
                                </div>

                                {/* Cushion Details */}
                                <div style={{
                                    backgroundColor: '#f8fafc',
                                    borderRadius: '8px',
                                    padding: '0.65rem 0.75rem',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '0.3rem',
                                    fontSize: '0.78rem',
                                    color: '#475569',
                                    border: '1px solid #f1f5f9'
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span>Target FG (Ship - 28d):</span>
                                        <strong style={{ color: '#0369a1' }}>{targetFgFormatted}</strong>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span>Estimated / Actual FG:</span>
                                        <strong style={{ color: item.maxSlippageDays > 0 ? '#b91c1c' : '#166534' }}>
                                            {projectedFgFormatted}
                                        </strong>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span>Cushion in Hand:</span>
                                        <strong style={{ color: item.bufferDays >= 0 ? '#166534' : '#b91c1c' }}>
                                            {item.bufferDays >= 0 ? `${item.bufferDays} days remaining` : `${Math.abs(item.bufferDays)} days breached`}
                                        </strong>
                                    </div>
                                </div>

                                {/* Top Eater Alert Tag */}
                                <div style={{
                                    fontSize: '0.75rem',
                                    padding: '0.35rem 0.6rem',
                                    borderRadius: '6px',
                                    backgroundColor: item.maxSlippageDays > 0 ? '#fff7ed' : '#ecfdf5',
                                    border: `1px solid ${item.maxSlippageDays > 0 ? '#fed7aa' : '#a7f3d0'}`,
                                    color: item.maxSlippageDays > 0 ? '#9a3412' : '#065f46',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between'
                                }}>
                                    <span>{item.maxSlippageDays > 0 ? `Top Bottleneck: ${item.primaryEaterStage}` : '✓ All Stages On Track'}</span>
                                    {item.maxSlippageDays > 0 && <strong>-{item.maxSlippageDays}d delay</strong>}
                                </div>

                                {/* Expandable Stage Breakdown Table */}
                                {isExpanded && (
                                    <div style={{
                                        marginTop: '0.35rem',
                                        padding: '0.5rem',
                                        backgroundColor: '#f8fafc',
                                        borderRadius: '6px',
                                        border: '1px solid #e2e8f0',
                                        fontSize: '0.72rem'
                                    }}>
                                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                                            <thead>
                                                <tr style={{ borderBottom: '1px solid #cbd5e1', color: '#64748b' }}>
                                                    <th style={{ padding: '0.3rem 0.2rem' }}>Stage</th>
                                                    <th style={{ padding: '0.3rem 0.2rem' }}>Target</th>
                                                    <th style={{ padding: '0.3rem 0.2rem' }}>Est / Actual</th>
                                                    <th style={{ padding: '0.3rem 0.2rem', textAlign: 'right' }}>Slippage</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {item.stageBreakdowns.map(sb => {
                                                    const tStr = sb.targetDate ? sb.targetDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : '-';
                                                    const aStr = sb.actualDate 
                                                        ? sb.actualDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
                                                        : sb.estDate 
                                                        ? sb.estDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) 
                                                        : '-';

                                                    return (
                                                        <tr key={sb.stage} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                            <td style={{ padding: '0.25rem 0.2rem', fontWeight: 600 }}>{sb.stage === 'All Material Available' ? '100% CTB' : sb.stage}</td>
                                                            <td style={{ padding: '0.25rem 0.2rem', color: '#64748b' }}>{tStr}</td>
                                                            <td style={{ padding: '0.25rem 0.2rem', color: '#334155' }}>{aStr}</td>
                                                            <td style={{ padding: '0.25rem 0.2rem', textAlign: 'right', fontWeight: 700, color: sb.slippageDays > 0 ? '#dc2626' : '#16a34a' }}>
                                                                {sb.slippageDays > 0 ? `-${sb.slippageDays}d` : '0d'}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                )}

                                {/* Action Buttons */}
                                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                                    <button
                                        type="button"
                                        onClick={() => toggleCardExpand(item.weekStr)}
                                        style={{
                                            flex: 1,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '0.25rem',
                                            padding: '0.35rem 0.5rem',
                                            fontSize: '0.74rem',
                                            fontWeight: 600,
                                            backgroundColor: '#f1f5f9',
                                            color: '#334155',
                                            border: '1px solid #cbd5e1',
                                            borderRadius: '6px',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                                        {isExpanded ? 'Hide Stages' : 'View Stages'}
                                    </button>

                                    {onNavigateToPipelineWeek && (
                                        <button
                                            type="button"
                                            onClick={() => onNavigateToPipelineWeek(item.weekStr)}
                                            style={{
                                                flex: 1,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: '0.25rem',
                                                padding: '0.35rem 0.5rem',
                                                fontSize: '0.74rem',
                                                fontWeight: 700,
                                                backgroundColor: '#eff6ff',
                                                color: '#2563eb',
                                                border: '1px solid #bfdbfe',
                                                borderRadius: '6px',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            <ArrowUpRight size={13} />
                                            Pipeline Card
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

        </div>
    );
};

export default SymbBufferAnalysisView;
