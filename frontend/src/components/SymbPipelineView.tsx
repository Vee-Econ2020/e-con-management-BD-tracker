import React, { useState, useEffect, useMemo } from 'react';
import { Calendar, Filter, AlertCircle, CalendarDays, ArrowRight, RefreshCw, Clock, CheckCircle2, ChevronDown } from 'lucide-react';

interface SymbPlanRow {
    id: string;
    "Last Batch Date": string;
    "Shipment Week": string;
    "Variant Type": string;
    "Event Type": string;
    "planned Value": number;
    completed: number;
    "Material Covered": string;
    "Delayed by days": number;
    "Delayed by weeks": number;
    "Estimated Completion Date"?: string;
}

const EVENT_ORDER = [
    "EBOM covered",
    "PCBA covered",
    "All Material Available",
    "Active alignment",
    "Production/Assembly",
    "FQC",
    "Finished goods",
    "Invoice Date",
    "Shipment Date",
    "customer place"
];

const ProgressRing: React.FC<{ percentage: number; size?: number; strokeWidth?: number }> = ({ percentage, size = 26, strokeWidth = 3 }) => {
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (percentage / 100) * circumference;
    const isComplete = percentage === 100;
    const color = isComplete ? '#10b981' : percentage > 50 ? '#f5ad42' : '#ef4444';

    return (
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', flexShrink: 0 }}>
            <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                stroke="#334155"
                strokeWidth={strokeWidth}
                fill="transparent"
            />
            <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                stroke={color}
                strokeWidth={strokeWidth}
                fill="transparent"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                strokeLinecap="round"
                style={{ transition: 'stroke-dashoffset 0.3s ease' }}
            />
        </svg>
    );
};

const SymbPipelineView: React.FC = () => {
    const [data, setData] = useState<SymbPlanRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isCompletedSectionOpen, setIsCompletedSectionOpen] = useState(false);
    
    // Filters
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
    const [selectedVariant, setSelectedVariant] = useState<string>('All');

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const res = await fetch('/api/admin/symb-plan/transformed');
            const json = await res.json();
            setData(json);
        } catch (error) {
            console.error("Error fetching pipeline data:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleRefresh = async () => {
        try {
            setIsRefreshing(true);
            const res = await fetch('/api/admin/symb-plan/transformed');
            const json = await res.json();
            setData(json);
        } catch (error) {
            console.error("Error refreshing pipeline data:", error);
        } finally {
            setIsRefreshing(false);
        }
    };

    const filteredAndSortedData = useMemo(() => {
        let filtered = data;

        // Apply Variant Filter
        if (selectedVariant !== 'All') {
            filtered = filtered.filter(d => d["Variant Type"] === selectedVariant);
        }

        // Apply Date Filters based on "Shipment Week"
        if (fromDate) {
            const from = new Date(fromDate).getTime();
            filtered = filtered.filter(d => new Date(d["Shipment Week"]).getTime() >= from);
        }
        
        if (toDate) {
            const to = new Date(toDate).getTime();
            filtered = filtered.filter(d => new Date(d["Shipment Week"]).getTime() <= to);
        }

        // Sort by Shipment Week
        filtered.sort((a, b) => {
            const timeA = new Date(a["Shipment Week"]).getTime();
            const timeB = new Date(b["Shipment Week"]).getTime();
            return sortOrder === 'asc' ? timeA - timeB : timeB - timeA;
        });

        return filtered;
    }, [data, fromDate, toDate, sortOrder, selectedVariant]);

    // Group by Shipment Week
    const groupedByWeek = useMemo(() => {
        const groups: Record<string, SymbPlanRow[]> = {};
        filteredAndSortedData.forEach(row => {
            const weekStr = row["Shipment Week"] ? row["Shipment Week"].split(' ')[0] : 'Unknown';
            if (!groups[weekStr]) groups[weekStr] = [];
            groups[weekStr].push(row);
        });
        return groups;
    }, [filteredAndSortedData]);

    const getWeekBackfillInfo = (rows: SymbPlanRow[]) => {
        const variants = ["Varient 1", "Varient 2"];
        const maxNativeCompletedIdxMap: Record<string, number> = {};
        const maxNativeCompletedStageNameMap: Record<string, string> = {};

        variants.forEach(variantKey => {
            let maxIdx = -1;
            let stageName = '';

            EVENT_ORDER.forEach((evt, idx) => {
                const row = rows.find(r => r["Event Type"] === evt && (r["Variant Type"] || "").toLowerCase() === variantKey.toLowerCase());
                if (row) {
                    const isNativeCompleted = row["Material Covered"] === "Yes" || (row["planned Value"] > 0 && row.completed >= row["planned Value"]);
                    if (isNativeCompleted) {
                        maxIdx = idx;
                        stageName = evt;
                    }
                }
            });

            maxNativeCompletedIdxMap[variantKey.toLowerCase()] = maxIdx;
            maxNativeCompletedStageNameMap[variantKey.toLowerCase()] = stageName;
        });

        return { maxNativeCompletedIdxMap, maxNativeCompletedStageNameMap };
    };

    const { completedWeeks, activeWeeks } = useMemo(() => {
        const completed: [string, SymbPlanRow[], number][] = [];
        const active: [string, SymbPlanRow[], number][] = [];

        Object.entries(groupedByWeek).forEach(([weekStr, rows]) => {
            const { maxNativeCompletedIdxMap } = getWeekBackfillInfo(rows);
            let completedSlots = 0;

            EVENT_ORDER.forEach((evt, stageIdx) => {
                const eventRows = rows.filter(r => r["Event Type"] === evt);
                eventRows.forEach(r => {
                    const variantKey = (r["Variant Type"] || "").toLowerCase();
                    const maxCompletedIdx = maxNativeCompletedIdxMap[variantKey] ?? -1;
                    const isNativeCompleted = r["Material Covered"] === "Yes" || (r["planned Value"] > 0 && r.completed >= r["planned Value"]);
                    const isBackfilled = !isNativeCompleted && stageIdx < maxCompletedIdx;

                    if (isNativeCompleted || isBackfilled) {
                        completedSlots++;
                    }
                });
            });

            const pct = Math.min(100, Math.round(completedSlots * 5));
            if (pct === 100) {
                completed.push([weekStr, rows, pct]);
            } else {
                active.push([weekStr, rows, pct]);
            }
        });

        return { completedWeeks: completed, activeWeeks: active };
    }, [groupedByWeek]);

    const overallSummaryCards = useMemo(() => {
        const STAGES = [
            { 
                key: 'PCBA', 
                title: 'PCBA', 
                eventMatch: ['PCBA covered', 'PCBA Ready'],
                bgColor: '#eff6ff',
                borderColor: '#bfdbfe',
                titleColor: '#1e40af',
                numColor: '#1d4ed8',
                subTextColor: '#2563eb'
            },
            { 
                key: 'Active alignment', 
                title: 'Active Alignment', 
                eventMatch: ['Active alignment'],
                bgColor: '#fffbeb',
                borderColor: '#fde68a',
                titleColor: '#92400e',
                numColor: '#b45309',
                subTextColor: '#d97706'
            },
            { 
                key: 'Production/Assembly', 
                title: 'Production / Assembly', 
                eventMatch: ['Production/Assembly'],
                bgColor: '#f0fdfa',
                borderColor: '#99f6e4',
                titleColor: '#115e59',
                numColor: '#0f766e',
                subTextColor: '#0d9488'
            },
            { 
                key: 'FQC', 
                title: 'FQC', 
                eventMatch: ['FQC'],
                bgColor: '#eef2ff',
                borderColor: '#c7d2fe',
                titleColor: '#3730a3',
                numColor: '#4338ca',
                subTextColor: '#4f46e5'
            },
            { 
                key: 'Finished goods', 
                title: 'Finished Goods', 
                eventMatch: ['Finished goods'],
                bgColor: '#ecfdf5',
                borderColor: '#a7f3d0',
                titleColor: '#065f46',
                numColor: '#047857',
                subTextColor: '#059669'
            }
        ];

        return STAGES.map(stage => {
            const stageRows = data.filter(r => stage.eventMatch.includes(r["Event Type"]));
            
            const v1Sum = stageRows
                .filter(r => (r["Variant Type"] || "").toLowerCase().includes("1"))
                .reduce((acc, curr) => acc + (curr.completed || 0), 0);
                
            const v2Sum = stageRows
                .filter(r => (r["Variant Type"] || "").toLowerCase().includes("2"))
                .reduce((acc, curr) => acc + (curr.completed || 0), 0);

            return {
                title: stage.title,
                v1: v1Sum,
                v2: v2Sum,
                total: v1Sum + v2Sum,
                bgColor: stage.bgColor,
                borderColor: stage.borderColor,
                titleColor: stage.titleColor,
                numColor: stage.numColor,
                subTextColor: stage.subTextColor
            };
        });
    }, [data]);

    const renderVariantSection = (row: SymbPlanRow, isBackfilled: boolean, backfillSourceStage?: string) => {
        const isNativeCompleted = row["Material Covered"] === "Yes" || (row["planned Value"] > 0 && row.completed >= row["planned Value"]);
        const isCompleted = isNativeCompleted || isBackfilled;
        const isDelayed = !isCompleted && row["Delayed by days"] > 0;
        
        return (
            <div key={row.id} style={{ 
                padding: '0.75rem', 
                backgroundColor: isBackfilled ? '#f1f5f9' : '#f8fafc', 
                borderRadius: '8px',
                borderLeft: `4px solid ${isNativeCompleted ? '#10b981' : isBackfilled ? '#94a3b8' : isDelayed ? '#ef4444' : '#f59e0b'}`,
                marginBottom: '0.5rem',
                fontSize: '0.85rem'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                    <span style={{ fontWeight: 700, color: isBackfilled ? '#475569' : '#1e293b' }}>{row["Variant Type"]}</span>
                    <span style={{
                        padding: '0.15rem 0.5rem',
                        borderRadius: '12px',
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        backgroundColor: isNativeCompleted ? '#dcfce7' : isBackfilled ? '#e2e8f0' : isDelayed ? '#fee2e2' : '#fef3c7',
                        color: isNativeCompleted ? '#166534' : isBackfilled ? '#475569' : isDelayed ? '#991b1b' : '#92400e'
                    }}>
                        {isNativeCompleted ? 'Completed' : isBackfilled ? 'Auto-Completed' : isDelayed ? 'Delayed' : 'Pending'}
                    </span>
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem', color: isBackfilled ? '#64748b' : '#475569' }}>
                    <span>Planned: <strong>{row["planned Value"] || 0}</strong></span>
                    <span>Completed: <strong>{isBackfilled ? (row["planned Value"] || 0) : (row.completed || 0)}</strong></span>
                </div>

                {isBackfilled && (
                    <div style={{ color: '#475569', fontSize: '0.73rem', display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.3rem', backgroundColor: '#e2e8f0', padding: '0.25rem 0.4rem', borderRadius: '4px' }}>
                        <CheckCircle2 size={12} style={{ color: '#64748b', flexShrink: 0 }} />
                        <span>Auto-completed (Data not updated; backfilled from {backfillSourceStage})</span>
                    </div>
                )}

                {isDelayed && (
                    <div style={{ color: '#dc2626', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.3rem' }}>
                        <AlertCircle size={12} />
                        Delayed by {row["Delayed by days"]} days ({row["Delayed by weeks"]} wks)
                    </div>
                )}
                
                {(!isCompleted && row["Estimated Completion Date"]) && (
                    <div style={{ color: '#0369a1', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.3rem', backgroundColor: '#e0f2fe', padding: '0.25rem 0.4rem', borderRadius: '4px' }}>
                        <CalendarDays size={12} />
                        Will complete on: <strong>{row["Estimated Completion Date"]}</strong>
                    </div>
                )}
            </div>
        );
    };

    const renderWeekCardBlock = (weekStr: string, rows: SymbPlanRow[], pct: number) => {
        const isComplete = pct === 100;
        const { maxNativeCompletedIdxMap, maxNativeCompletedStageNameMap } = getWeekBackfillInfo(rows);

        return (
            <div key={weekStr} style={{ border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
                <div style={{ backgroundColor: '#1e293b', padding: '0.75rem 1.5rem', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Calendar size={18} style={{ color: '#f5ad42' }} />
                        <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>Shipment Week: {weekStr}</h4>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', backgroundColor: '#0f172a', padding: '0.35rem 0.75rem', borderRadius: '20px', border: '1px solid #334155' }}>
                        <ProgressRing percentage={pct} />
                        <span style={{ fontSize: '0.9rem', fontWeight: 800, color: isComplete ? '#10b981' : '#f5ad42' }}>
                            {pct}% Completed
                        </span>
                    </div>
                </div>
                
                <div style={{ display: 'flex', padding: '1.5rem', gap: '1rem', overflowX: 'auto', backgroundColor: '#f1f5f9' }}>
                    {EVENT_ORDER.map((eventType, idx) => {
                        const eventRows = rows.filter(r => r["Event Type"] === eventType);
                        
                        const missingPlanVariants = eventRows
                            .filter(row => {
                                const variantKey = (row["Variant Type"] || "").toLowerCase();
                                const maxCompletedIdx = maxNativeCompletedIdxMap[variantKey] ?? -1;
                                const isNativeCompleted = row["Material Covered"] === "Yes" || (row["planned Value"] > 0 && row.completed >= row["planned Value"]);
                                const isBackfilled = !isNativeCompleted && idx < maxCompletedIdx;
                                const isCompleted = isNativeCompleted || isBackfilled;

                                const hasEstDate = row["Estimated Completion Date"] && 
                                                   row["Estimated Completion Date"] !== "None" && 
                                                   row["Estimated Completion Date"] !== "N/A" && 
                                                   row["Estimated Completion Date"].trim() !== "";
                                return !isCompleted && !hasEstDate;
                            })
                            .map(row => {
                                const vType = row["Variant Type"] || "";
                                if (vType.toLowerCase().includes("1")) return "V1";
                                if (vType.toLowerCase().includes("2")) return "V2";
                                return vType;
                            });

                        let criticalMsg = "";
                        if (missingPlanVariants.length > 0) {
                            const uniqueVariants = Array.from(new Set(missingPlanVariants));
                            const variantStr = uniqueVariants.join(" & ");
                            criticalMsg = `${eventType} Plan not available for ${variantStr}`;
                        }

                        const cardBatchDate = eventRows.find(r => r["Last Batch Date"])?.["Last Batch Date"] 
                            ? String(eventRows.find(r => r["Last Batch Date"])?.["Last Batch Date"]).split(' ')[0] 
                            : '';

                        return (
                            <React.Fragment key={eventType}>
                                <div style={{ 
                                    minWidth: '280px', 
                                    flex: '0 0 auto', 
                                    backgroundColor: '#ffffff', 
                                    borderRadius: '10px', 
                                    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                                    display: 'flex',
                                    flexDirection: 'column'
                                }}>
                                    <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #f1f5f9', color: '#334155', textAlign: 'center' }}>
                                        <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#1e293b' }}>{eventType}</div>
                                        {cardBatchDate && (
                                            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginTop: '0.25rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}>
                                                <Clock size={12} style={{ color: '#0284c7' }} />
                                                Should be completed by : <span style={{ color: '#0284c7', fontWeight: 700 }}>{cardBatchDate}</span>
                                            </div>
                                        )}
                                    </div>
                                    <div style={{ padding: '1rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
                                        {eventRows.length === 0 ? (
                                            <div style={{ textAlign: 'center', color: '#cbd5e1', fontSize: '0.85rem', marginTop: '1rem' }}>No data</div>
                                        ) : (
                                            eventRows.map(row => {
                                                const variantKey = (row["Variant Type"] || "").toLowerCase();
                                                const maxCompletedIdx = maxNativeCompletedIdxMap[variantKey] ?? -1;
                                                const isNativeCompleted = row["Material Covered"] === "Yes" || (row["planned Value"] > 0 && row.completed >= row["planned Value"]);
                                                const isBackfilled = !isNativeCompleted && idx < maxCompletedIdx;
                                                const backfillSourceStage = isBackfilled ? maxNativeCompletedStageNameMap[variantKey] : '';

                                                return renderVariantSection(row, isBackfilled, backfillSourceStage);
                                            })
                                        )}

                                        {criticalMsg && (
                                            <div style={{
                                                marginTop: 'auto',
                                                padding: '0.6rem 0.75rem',
                                                backgroundColor: '#fef2f2',
                                                border: '1px solid #fecaca',
                                                borderRadius: '6px',
                                                color: '#991b1b',
                                                fontSize: '0.78rem',
                                                fontWeight: 700,
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '0.4rem'
                                            }}>
                                                <AlertCircle size={16} style={{ color: '#ef4444', flexShrink: 0 }} />
                                                <span>{criticalMsg}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                
                                {idx < EVENT_ORDER.length - 1 && (
                                    <div style={{ display: 'flex', alignItems: 'center', color: '#94a3b8' }}>
                                        <ArrowRight size={24} />
                                    </div>
                                )}
                            </React.Fragment>
                        );
                    })}
                </div>
            </div>
        );
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '300px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                    <RefreshCw className="animate-spin" size={32} style={{ color: '#3b82f6' }} />
                    <span style={{ color: '#64748b', fontWeight: 600 }}>Loading plan pipeline data...</span>
                </div>
            </div>
        );
    }

    return (
        <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Filter Bar */}
            <div style={{ 
                backgroundColor: '#ffffff', 
                padding: '1rem 1.5rem', 
                borderRadius: '12px', 
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                border: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                gap: '1.5rem',
                flexWrap: 'wrap'
            }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b' }}>Variant Filter</label>
                    <select 
                        value={selectedVariant}
                        onChange={e => setSelectedVariant(e.target.value)}
                        style={{ padding: '0.4rem 0.8rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.9rem' }}
                    >
                        <option value="All">All Variants</option>
                        <option value="Varient 1">Variant 1</option>
                        <option value="Varient 2">Variant 2</option>
                    </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b' }}>From Shipment Date</label>
                    <input 
                        type="date" 
                        value={fromDate}
                        onChange={e => setFromDate(e.target.value)}
                        style={{ padding: '0.4rem 0.8rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.9rem' }}
                    />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b' }}>To Shipment Date</label>
                    <input 
                        type="date" 
                        value={toDate}
                        onChange={e => setToDate(e.target.value)}
                        style={{ padding: '0.4rem 0.8rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.9rem' }}
                    />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b' }}>Sorting (Shipment Week)</label>
                    <button 
                        onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                        style={{ 
                            padding: '0.4rem 0.8rem', 
                            borderRadius: '6px', 
                            border: '1px solid #cbd5e1', 
                            backgroundColor: '#f8fafc',
                            cursor: 'pointer',
                            fontSize: '0.9rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.4rem'
                        }}
                    >
                        <Filter size={14} />
                        {sortOrder === 'asc' ? 'Oldest to Newest' : 'Newest to Oldest'}
                    </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', marginLeft: 'auto' }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b' }}>Pipeline Data</label>
                    <button 
                        onClick={handleRefresh}
                        disabled={isRefreshing || loading}
                        style={{ 
                            padding: '0.4rem 1.2rem', 
                            border: 'none', 
                            borderRadius: '6px', 
                            fontSize: '0.9rem',
                            backgroundColor: (isRefreshing || loading) ? '#94a3b8' : '#3b82f6',
                            color: '#ffffff',
                            fontWeight: 700,
                            cursor: (isRefreshing || loading) ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            boxShadow: '0 2px 4px rgba(59, 130, 246, 0.25)',
                            transition: 'all 0.2s ease'
                        }}
                    >
                        <RefreshCw size={14} style={{ animation: (isRefreshing || loading) ? 'spin 1s linear infinite' : 'none' }} />
                        {isRefreshing ? 'Recalculating...' : 'Recalculate & Refresh'}
                    </button>
                </div>
            </div>

            {/* Overall Stage Completed Summary Cards */}
            <div style={{ marginBottom: '1rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                {overallSummaryCards.map(card => (
                    <div key={card.title} style={{ 
                        backgroundColor: card.bgColor, 
                        borderRadius: '10px', 
                        padding: '0.9rem 1rem', 
                        border: `1px solid ${card.borderColor}`,
                        boxShadow: '0 2px 5px rgba(0,0,0,0.04)',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between'
                    }}>
                        <div>
                            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: card.titleColor, textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                                {card.title}
                            </div>
                            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: card.numColor, display: 'flex', alignItems: 'baseline', gap: '0.4rem' }}>
                                {card.total.toLocaleString()}
                                <span style={{ fontSize: '0.7rem', fontWeight: 600, color: card.subTextColor }}>Total Completed</span>
                            </div>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '0.5rem', marginTop: '0.5rem', borderTop: `1px solid ${card.borderColor}`, fontSize: '0.78rem' }}>
                            <div>
                                <span style={{ color: card.titleColor, opacity: 0.85 }}>Variant 1: </span>
                                <strong style={{ color: card.numColor }}>{card.v1.toLocaleString()}</strong>
                            </div>
                            <div>
                                <span style={{ color: card.titleColor, opacity: 0.85 }}>Variant 2: </span>
                                <strong style={{ color: card.numColor }}>{card.v2.toLocaleString()}</strong>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Completed in all green Accordion */}
            {completedWeeks.length > 0 && (
                <div style={{ marginBottom: '1rem', border: '1px solid #bbf7d0', borderRadius: '12px', backgroundColor: '#f0fdf4', overflow: 'hidden' }}>
                    <button 
                        onClick={() => setIsCompletedSectionOpen(!isCompletedSectionOpen)}
                        style={{ 
                            width: '100%', 
                            padding: '0.9rem 1.5rem', 
                            backgroundColor: '#dcfce7', 
                            border: 'none', 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'space-between',
                            cursor: 'pointer',
                            color: '#14532d'
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                            <CheckCircle2 size={20} style={{ color: '#16a34a' }} />
                            <span style={{ fontSize: '1rem', fontWeight: 800 }}>
                                Completed in all green ({completedWeeks.length} {completedWeeks.length === 1 ? 'Week' : 'Weeks'} Completed)
                            </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', fontWeight: 700, color: '#15803d' }}>
                            <span>{isCompletedSectionOpen ? 'Hide Completed Weeks' : 'Show Completed Weeks'}</span>
                            <ChevronDown size={18} style={{ transform: isCompletedSectionOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease' }} />
                        </div>
                    </button>
                    
                    {isCompletedSectionOpen && (
                        <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '2rem', backgroundColor: '#f8fafc', borderTop: '1px solid #bbf7d0' }}>
                            {completedWeeks.map(([weekStr, rows, pct]) => renderWeekCardBlock(weekStr, rows, pct))}
                        </div>
                    )}
                </div>
            )}

            {/* Pipeline Visualization (Active / In-Progress Weeks) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                {Object.keys(groupedByWeek).length === 0 ? (
                    <div style={{ textAlign: 'center', color: '#94a3b8', padding: '2rem' }}>No data matches the selected filters.</div>
                ) : activeWeeks.length === 0 && completedWeeks.length > 0 ? (
                    <div style={{ textAlign: 'center', color: '#15803d', padding: '2rem', backgroundColor: '#f0fdf4', borderRadius: '12px', border: '1px solid #bbf7d0', fontWeight: 600 }}>
                        🎉 All shipment weeks are 100% completed and listed under "Completed in all green" above!
                    </div>
                ) : (
                    activeWeeks.map(([weekStr, rows, pct]) => renderWeekCardBlock(weekStr, rows, pct))
                )}
            </div>
        </div>
    );
};

export default SymbPipelineView;
