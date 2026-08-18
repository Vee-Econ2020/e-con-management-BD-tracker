import React, { useState, useEffect, useMemo } from 'react';
import Plot from 'react-plotly.js';
import { Save, History, Edit2, FileText, RefreshCw, Layers, BarChart2, TrendingUp, Trash2, X, ShieldAlert, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface EditHistoryEntry {
    value: any;
    old_value?: any;
    new_value?: any;
    edited_by?: string;
    timestamp: string;
    edit: number;
}

interface EditHistory {
    planned_qty?: EditHistoryEntry[];
    completed?: EditHistoryEntry[];
    plan_date?: EditHistoryEntry[];
}

interface TrackerRecord {
    _id: string;
    variant: string;
    event_type: string;
    plan_date: string;
    planned_qty: number;
    completed: number;
    acc_comp_date: string | null;
    created_by?: string;
    created_at?: string;
    edit_history?: EditHistory;
}

const EVENT_TABS = ['ALL', 'PCBA Ready', 'Active alignment', 'Production/Assembly', 'FQC', 'Finished goods', 'Invoice Date', 'Shipment Date', 'customer place'];

function parseDayDate(dayStr: any): Date | null {
    if (!dayStr) return null;
    const str = String(dayStr).trim();
    if (!str) return null;

    const isoMatch = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
    if (isoMatch) {
        const year = parseInt(isoMatch[1], 10);
        const month = parseInt(isoMatch[2], 10) - 1;
        const day = parseInt(isoMatch[3], 10);
        return new Date(year, month, day);
    }

    const match = str.match(/^(\d{1,2})[-/\s]+([A-Za-z0-9]+)[-/\s]+(\d{2,4})/);
    if (match) {
        const day = parseInt(match[1], 10);
        let monthStr = match[2].toLowerCase();
        let year = parseInt(match[3], 10);
        if (year < 100) year += 2000;

        const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
        let monthIdx = months.findIndex(m => monthStr.startsWith(m));
        if (monthIdx === -1) {
            monthIdx = parseInt(monthStr, 10) - 1;
        }

        if (!isNaN(day) && monthIdx >= 0 && monthIdx < 12 && !isNaN(year)) {
            return new Date(year, monthIdx, day);
        }
    }

    const d = new Date(str);
    return isNaN(d.getTime()) ? null : d;
}

function getLockStatus(nowDate: Date = new Date(), backendState?: any) {
    if (backendState && backendState.is_temp_unlocked) {
        const totalSecondsRem = Math.max(0, backendState.temp_remaining_seconds);
        const mins = Math.floor(totalSecondsRem / 60);
        const secs = totalSecondsRem % 60;
        return {
            isEditAllowed: true,
            isTempUnlocked: true,
            tempRemainingSeconds: totalSecondsRem,
            unlockedBy: backendState.unlocked_by,
            hrs: 0,
            mins,
            secs,
            lockTimeStr: '14:00 (2:00 PM)',
            unlockTimeStr: '00:01 AM'
        };
    }

    const hours = nowDate.getHours();
    const minutes = nowDate.getMinutes();
    const seconds = nowDate.getSeconds();

    const currentTotalSec = hours * 3600 + minutes * 60 + seconds;
    
    // 00:01 AM (60 seconds) to 14:00 (14 * 3600 = 50400 seconds)
    const startSec = 60;
    const endSec = 14 * 3600;

    const isEditAllowed = currentTotalSec >= startSec && currentTotalSec <= endSec;

    let targetDate = new Date(nowDate);

    if (isEditAllowed) {
        targetDate.setHours(14, 0, 0, 0);
    } else {
        if (currentTotalSec > endSec) {
            targetDate.setDate(targetDate.getDate() + 1);
            targetDate.setHours(0, 1, 0, 0);
        } else {
            targetDate.setHours(0, 1, 0, 0);
        }
    }

    const diffMs = Math.max(0, targetDate.getTime() - nowDate.getTime());
    const totalSecondsRem = Math.floor(diffMs / 1000);
    const hrs = Math.floor(totalSecondsRem / 3600);
    const mins = Math.floor((totalSecondsRem % 3600) / 60);
    const secs = totalSecondsRem % 60;

    return {
        isEditAllowed,
        isTempUnlocked: false,
        tempRemainingSeconds: 0,
        unlockedBy: null,
        hrs,
        mins,
        secs,
        lockTimeStr: '14:00 (2:00 PM)',
        unlockTimeStr: '00:01 AM'
    };
}

function calcMetrics(recs: TrackerRecord[]) {
    let totalPlanned = 0;
    let totalCompleted = 0;

    let plannedAsOfToday = 0;
    let completedAsOfToday = 0;

    const today = new Date();
    const todayTime = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();

    recs.forEach(rec => {
        const p = rec.planned_qty || 0;
        const c = rec.completed || 0;
        totalPlanned += p;
        totalCompleted += c;

        const recDate = parseDayDate(rec.plan_date);
        if (recDate) {
            const recTime = new Date(recDate.getFullYear(), recDate.getMonth(), recDate.getDate()).getTime();
            if (recTime <= todayTime) {
                plannedAsOfToday += p;
                completedAsOfToday += c;
            }
        }
    });

    const netDiff = totalCompleted - totalPlanned;
    const totalRemaining = netDiff < 0 ? Math.abs(netDiff) : 0;
    const totalExcess = netDiff > 0 ? netDiff : 0;

    const diffAsOfToday = completedAsOfToday - plannedAsOfToday;
    const percentAsOfToday = plannedAsOfToday > 0 ? ((diffAsOfToday / plannedAsOfToday) * 100).toFixed(1) : '0.0';
    const isAheadAsOfToday = diffAsOfToday >= 0;

    return {
        totalPlanned,
        totalCompleted,
        totalRemaining,
        totalExcess,
        plannedAsOfToday,
        completedAsOfToday,
        diffAsOfToday,
        percentAsOfToday,
        isAheadAsOfToday
    };
}

interface MetricCardsStackProps {
    title: string;
    metrics: ReturnType<typeof calcMetrics>;
    records: TrackerRecord[];
    selectedEventTab: string;
}

const MetricCardsStack = ({ title, metrics, records, selectedEventTab }: MetricCardsStackProps) => {
    const [showDetail, setShowDetail] = useState(false);
    const [chartMode, setChartMode] = useState<'actuals' | 'cumulative'>('cumulative');
    const [showHistoryLines, setShowHistoryLines] = useState(false);

    // Compute stage breakdown metrics for ALL tab
    const stageMetrics = useMemo(() => {
        if (selectedEventTab !== 'ALL') return [];
        const STAGES = [
            { key: 'PCBA Ready', label: 'PCBA Ready', color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
            { key: 'Active alignment', label: 'Total AA Done', color: '#d97706', bg: '#fffbe5', border: '#fde68a' },
            { key: 'Production/Assembly', label: 'Production / Assembly', color: '#0d9488', bg: '#f0fdfa', border: '#99f6e4' },
            { key: 'FQC', label: 'FQC', color: '#4f46e5', bg: '#eef2ff', border: '#c7d2fe' },
            { key: 'Finished goods', label: 'Finished Goods', color: '#059669', bg: '#ecfdf5', border: '#a7f3d0' },
            { key: 'Invoice Date', label: 'Invoiced', color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe' },
            { key: 'Shipment Date', label: 'Shipped', color: '#db2777', bg: '#fdf2f8', border: '#fbcfe8' },
            { key: 'customer place', label: 'Customer Place', color: '#0284c7', bg: '#f0f9ff', border: '#bae6fd' }
        ];

        return STAGES.map(stg => {
            const stgRecords = records.filter(r => r.event_type === stg.key);
            let planned = 0;
            let completed = 0;
            stgRecords.forEach(r => {
                planned += r.planned_qty || 0;
                completed += r.completed || 0;
            });
            const remaining = planned > completed ? planned - completed : 0;
            return {
                ...stg,
                planned,
                completed,
                remaining
            };
        });
    }, [records, selectedEventTab]);

    // Compute edit statistics for this stack
    const editStats = useMemo(() => {
        let planDateEdits = 0;
        let plannedQtyEdits = 0;
        let completedEdits = 0;

        records.forEach(r => {
            planDateEdits += r.edit_history?.plan_date?.length || 0;
            plannedQtyEdits += r.edit_history?.planned_qty?.length || 0;
            completedEdits += r.edit_history?.completed?.length || 0;
        });

        return { planDateEdits, plannedQtyEdits, completedEdits };
    }, [records]);

    // Prepare chart data & traces for single event tab (Planned vs Completed + Past Edits)
    const { singleTabTraces, singleTabMaxY } = useMemo(() => {
        const sorted = [...records].sort((a, b) => {
            const dA = parseDayDate(a.plan_date);
            const dB = parseDayDate(b.plan_date);
            return (dA ? dA.getTime() : 0) - (dB ? dB.getTime() : 0);
        });

        const xDates = sorted.map(r => r.plan_date);
        const rawPlanned = sorted.map(r => r.planned_qty || 0);
        const rawCompleted = sorted.map(r => r.completed || 0);

        let yPlanned: number[] = [];
        let yCompleted: number[] = [];

        if (chartMode === 'cumulative') {
            let pSum = 0;
            yPlanned = rawPlanned.map(v => { pSum += v; return pSum; });
            let cSum = 0;
            yCompleted = rawCompleted.map(v => { cSum += v; return cSum; });
        } else {
            yPlanned = rawPlanned;
            yCompleted = rawCompleted;
        }

        let allY: number[] = [...yPlanned, ...yCompleted];

        const pastTraces: any[] = [];

        let maxPlannedEdits = 0;
        sorted.forEach(r => {
            const pLen = r.edit_history?.planned_qty?.length || 0;
            if (pLen > maxPlannedEdits) maxPlannedEdits = pLen;
        });

        for (let rev = 0; rev < maxPlannedEdits; rev++) {
            const revPoints: { dateStr: string; dateObj: Date | null; val: number; timestamp: string }[] = [];
            let hasAnyEditAtRev = false;

            sorted.forEach(r => {
                const pHist = r.edit_history?.planned_qty;
                if (pHist && pHist[rev] !== undefined) {
                    hasAnyEditAtRev = true;
                    const pastVal = pHist[rev].value || 0;
                    const dObj = parseDayDate(r.plan_date);
                    revPoints.push({ dateStr: r.plan_date, dateObj: dObj, val: pastVal, timestamp: pHist[rev].timestamp });
                } else {
                    const dObj = parseDayDate(r.plan_date);
                    revPoints.push({ dateStr: r.plan_date, dateObj: dObj, val: r.planned_qty || 0, timestamp: '' });
                }
            });

            if (hasAnyEditAtRev) {
                revPoints.sort((a, b) => (a.dateObj ? a.dateObj.getTime() : 0) - (b.dateObj ? b.dateObj.getTime() : 0));

                const xDates = revPoints.map(p => p.dateStr);
                const rawY = revPoints.map(p => p.val);

                let finalY: number[] = [];
                if (chartMode === 'cumulative') {
                    let sum = 0;
                    finalY = rawY.map(v => { sum += v; return sum; });
                } else {
                    finalY = rawY;
                }

                allY.push(...finalY);

                const hoverTexts = revPoints.map((p, i) => {
                    const ts = p.timestamp ? ` (Edited ${new Date(p.timestamp).toLocaleString()})` : '';
                    return `Prev Planned (Rev ${rev + 1}): ${finalY[i]} on ${p.dateStr}${ts}`;
                });

                pastTraces.push({
                    x: xDates,
                    y: finalY,
                    name: `Past Planned (Rev ${rev + 1})`,
                    mode: 'lines+markers' as any,
                    hoverinfo: 'text' as any,
                    hovertext: hoverTexts,
                    line: { shape: 'spline', width: 2, color: '#94a3b8', dash: 'dot' },
                    marker: { size: 6, color: '#64748b', symbol: 'circle' },
                    showlegend: false
                });
            }
        }

        let maxCompletedEdits = 0;
        sorted.forEach(r => {
            const cLen = r.edit_history?.completed?.length || 0;
            if (cLen > maxCompletedEdits) maxCompletedEdits = cLen;
        });

        for (let rev = 0; rev < maxCompletedEdits; rev++) {
            const revPoints: { dateStr: string; dateObj: Date | null; val: number; timestamp: string }[] = [];
            let hasAnyEditAtRev = false;

            sorted.forEach(r => {
                const cHist = r.edit_history?.completed;
                if (cHist && cHist[rev] !== undefined) {
                    hasAnyEditAtRev = true;
                    const pastVal = cHist[rev].value || 0;
                    const dObj = parseDayDate(r.plan_date);
                    revPoints.push({ dateStr: r.plan_date, dateObj: dObj, val: pastVal, timestamp: cHist[rev].timestamp });
                } else {
                    const dObj = parseDayDate(r.plan_date);
                    revPoints.push({ dateStr: r.plan_date, dateObj: dObj, val: r.completed || 0, timestamp: '' });
                }
            });

            if (hasAnyEditAtRev) {
                revPoints.sort((a, b) => (a.dateObj ? a.dateObj.getTime() : 0) - (b.dateObj ? b.dateObj.getTime() : 0));

                const xDates = revPoints.map(p => p.dateStr);
                const rawY = revPoints.map(p => p.val);

                let finalY: number[] = [];
                if (chartMode === 'cumulative') {
                    let sum = 0;
                    finalY = rawY.map(v => { sum += v; return sum; });
                } else {
                    finalY = rawY;
                }

                allY.push(...finalY);

                const hoverTexts = revPoints.map((p, i) => {
                    const ts = p.timestamp ? ` (Edited ${new Date(p.timestamp).toLocaleString()})` : '';
                    return `Prev Completed (Rev ${rev + 1}): ${finalY[i]} on ${p.dateStr}${ts}`;
                });

                pastTraces.push({
                    x: xDates,
                    y: finalY,
                    name: `Past Completed (Rev ${rev + 1})`,
                    mode: 'lines+markers' as any,
                    hoverinfo: 'text' as any,
                    hovertext: hoverTexts,
                    line: { shape: 'spline', width: 2, color: '#cbd5e1', dash: 'dot' },
                    marker: { size: 6, color: '#94a3b8', symbol: 'circle-open' },
                    showlegend: false
                });
            }
        }

        const mainTraces = [
            {
                x: xDates,
                y: yPlanned,
                name: chartMode === 'cumulative' ? 'Cum. Planned Target' : 'Planned Qty',
                mode: 'lines+markers+text' as any,
                text: yPlanned.map(v => String(v)),
                textposition: 'top center',
                textfont: { size: 14, color: '#1e40af', weight: 'bold' } as any,
                line: { shape: 'spline', width: 3.5, color: '#3b82f6' },
                marker: { size: 8, color: '#3b82f6' }
            },
            {
                x: xDates,
                y: yCompleted,
                name: chartMode === 'cumulative' ? 'Cum. Completed' : 'Completed Qty',
                mode: 'lines+markers+text' as any,
                text: yCompleted.map(v => String(v)),
                textposition: 'bottom center',
                textfont: { size: 14, color: '#166534', weight: 'bold' } as any,
                line: { shape: 'spline', width: 3.5, color: '#10b981' },
                marker: { size: 8, color: '#10b981' }
            }
        ];

        const traces = showHistoryLines ? [...pastTraces, ...mainTraces] : mainTraces;

        const maxVal = Math.max(0, ...allY);
        const maxY = maxVal + Math.max(1, Math.ceil(maxVal * 0.15));

        return { singleTabTraces: traces, singleTabMaxY: maxY };
    }, [records, chartMode, showHistoryLines]);

    // Prepare chart data & traces for ALL tab (Completed Qty per Event Type + Past Edits)
    const { allTabChartTraces, allTabMaxY } = useMemo(() => {
        if (selectedEventTab !== 'ALL') return { allTabChartTraces: [], allTabMaxY: 10 };

        const dateMap = new Map<string, { dateStr: string; timestamp: number }>();
        records.forEach(r => {
            const dObj = parseDayDate(r.plan_date);
            if (dObj) {
                if (!dateMap.has(r.plan_date)) {
                    dateMap.set(r.plan_date, { dateStr: r.plan_date, timestamp: dObj.getTime() });
                }
            }
        });

        const today = new Date();
        const todayTime = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999).getTime();

        const sortedDates = Array.from(dateMap.values())
            .filter(d => d.timestamp <= todayTime)
            .sort((a, b) => a.timestamp - b.timestamp);
        const xDates = sortedDates.map(d => d.dateStr);

        const eventTypes = ['PCBA Ready', 'Active alignment', 'Production/Assembly', 'FQC', 'Finished goods', 'Invoice Date', 'Shipment Date', 'customer place'];
        const colorMap: Record<string, string> = {
            'PCBA Ready': '#3b82f6',
            'Active alignment': '#f59e0b',
            'Production/Assembly': '#14b8a6',
            'FQC': '#6366f1',
            'Finished goods': '#10b981',
            'Invoice Date': '#8b5cf6',
            'Shipment Date': '#ec4899',
            'customer place': '#06b6d4'
        };

        const traces: any[] = [];
        let allY: number[] = [];

        eventTypes.forEach(evt => {
            const evtRows = records.filter(r => r.event_type === evt);
            if (evtRows.length === 0) return;

            const dateToCompleted = new Map<string, number>();
            evtRows.forEach(r => {
                dateToCompleted.set(r.plan_date, r.completed || 0);
            });

            const rawYVals = xDates.map(d => dateToCompleted.get(d) ?? 0);
            
            let finalYVals: number[] = [];
            if (chartMode === 'cumulative') {
                let sum = 0;
                finalYVals = rawYVals.map(v => { sum += v; return sum; });
            } else {
                finalYVals = rawYVals;
            }

            allY.push(...finalYVals);

            let lastShownIdx = -999;
            let repeatCount = 0;

            const textVals = finalYVals.map((val, idx) => {
                if (val <= 0) return '';
                
                const prevVal = idx > 0 ? finalYVals[idx - 1] : null;
                if (val === prevVal) {
                    repeatCount++;
                } else {
                    repeatCount = 1;
                }
                
                const isLast = idx === finalYVals.length - 1;
                if (repeatCount > 3 && !isLast) {
                    return '';
                }

                const currTs = sortedDates[idx]?.timestamp || 0;
                const lastTs = lastShownIdx >= 0 ? sortedDates[lastShownIdx]?.timestamp || 0 : 0;
                const daysDiff = (currTs - lastTs) / (1000 * 60 * 60 * 24);

                const isValChanged = idx === 0 || val !== prevVal;
                const isTwoWeeksPassed = daysDiff >= 14;

                if (isLast || isValChanged || isTwoWeeksPassed) {
                    lastShownIdx = idx;
                    return String(val);
                }

                return '';
            });

            const color = colorMap[evt] || '#64748b';

            traces.push({
                x: xDates,
                y: finalYVals,
                name: evt,
                mode: 'lines+markers+text' as any,
                text: textVals,
                textposition: 'top center',
                textfont: { size: 14, color: color, weight: 'bold' } as any,
                line: { shape: 'spline', width: 3, color: color },
                marker: { size: 7, color: color }
            });
        });

        const pastTraces: any[] = [];
        records.forEach(r => {
            const cHist = r.edit_history?.completed;
            if (cHist && cHist.length > 0) {
                cHist.forEach((entry, idx) => {
                    const val = entry.value || 0;
                    allY.push(val);
                    pastTraces.push({
                        x: [r.plan_date],
                        y: [val],
                        name: `${r.event_type} Past Edit #${idx + 1}`,
                        mode: 'markers' as any,
                        hoverinfo: 'text' as any,
                        hovertext: `${r.event_type} Past Edit #${idx + 1}: ${val} (${new Date(entry.timestamp).toLocaleString()})`,
                        marker: { size: 7, color: '#cbd5e1', symbol: 'circle-open', line: { width: 2, color: '#94a3b8' } },
                        showlegend: false
                    });
                });
            }
        });

        const finalTraces = showHistoryLines ? [...pastTraces, ...traces] : traces;

        const maxVal = Math.max(0, ...allY);
        const maxY = maxVal + Math.max(1, Math.ceil(maxVal * 0.15));

        return { allTabChartTraces: finalTraces, allTabMaxY: maxY };
    }, [records, selectedEventTab, chartMode, showHistoryLines]);

    return (
        <div style={{ marginBottom: '1.25rem', backgroundColor: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '0.9rem', fontWeight: '700', color: '#374151', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ backgroundColor: '#3b82f6', color: 'white', padding: '0.2rem 0.7rem', borderRadius: '6px', fontSize: '0.82rem', fontWeight: '700' }}>
                    {title}
                </span>

                <button
                    onClick={() => setShowDetail(!showDetail)}
                    style={{
                        padding: '0.35rem 0.8rem',
                        fontSize: '0.8rem',
                        fontWeight: '600',
                        color: '#2563eb',
                        backgroundColor: '#ffffff',
                        border: '1px solid #bfdbfe',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        transition: 'all 0.15s ease'
                    }}
                >
                    <BarChart2 size={15} /> {showDetail ? 'Hide Detail Graph' : 'View Detail Graph'}
                </button>
            </div>

            {/* Summary Cards: Stage Breakdown for ALL tab, or 4 standard metric cards for single event tab */}
            {selectedEventTab === 'ALL' ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '0.85rem' }}>
                    {stageMetrics.map(stg => (
                        <div 
                            key={stg.key}
                            style={{ 
                                backgroundColor: stg.bg, 
                                padding: '0.85rem 1rem', 
                                borderRadius: '8px', 
                                border: `1px solid ${stg.border}`,
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'space-between',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
                            }}
                        >
                            <div style={{ fontSize: '0.72rem', color: stg.color, fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                                {stg.label}
                            </div>
                            <div style={{ fontSize: '1.35rem', fontWeight: '800', color: '#0f172a', marginTop: '0.2rem' }}>
                                {stg.completed.toLocaleString()} <span style={{ fontSize: '0.75rem', fontWeight: '600', color: stg.color }}>done</span>
                            </div>
                            <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span>Target: <strong>{stg.planned.toLocaleString()}</strong></span>
                                {stg.remaining > 0 ? (
                                    <span style={{ color: '#ca8a04', fontWeight: '600' }}>{stg.remaining.toLocaleString()} rem</span>
                                ) : (
                                    <span style={{ color: '#166534', fontWeight: '600' }}>Completed</span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                    <div style={{ backgroundColor: '#ffffff', padding: '0.9rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                        <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '600', textTransform: 'uppercase' }}>Total Planned</div>
                        <div style={{ fontSize: '1.35rem', fontWeight: '800', color: '#1e293b', marginTop: '0.2rem' }}>
                            {metrics.totalPlanned.toLocaleString()}
                        </div>
                    </div>

                    <div style={{ backgroundColor: '#f0fdf4', padding: '0.9rem', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
                        <div style={{ fontSize: '0.75rem', color: '#166534', fontWeight: '600', textTransform: 'uppercase' }}>Total Completed</div>
                        <div style={{ fontSize: '1.35rem', fontWeight: '800', color: '#15803d', marginTop: '0.2rem' }}>
                            {metrics.totalCompleted.toLocaleString()}
                        </div>
                    </div>

                    <div style={{ backgroundColor: metrics.totalExcess > 0 ? '#eff6ff' : metrics.totalRemaining > 0 ? '#fefce8' : '#f0fdf4', padding: '0.9rem', borderRadius: '8px', border: metrics.totalExcess > 0 ? '1px solid #bfdbfe' : metrics.totalRemaining > 0 ? '1px solid #fef08a' : '1px solid #bbf7d0' }}>
                        <div style={{ fontSize: '0.75rem', color: metrics.totalExcess > 0 ? '#1e40af' : metrics.totalRemaining > 0 ? '#854d0e' : '#166534', fontWeight: '600', textTransform: 'uppercase' }}>Remaining / Excess</div>
                        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'baseline', marginTop: '0.2rem' }}>
                            {metrics.totalRemaining > 0 && (
                                <div>
                                    <span style={{ fontSize: '1.35rem', fontWeight: '800', color: '#a16207' }}>{metrics.totalRemaining.toLocaleString()}</span>
                                    <span style={{ fontSize: '0.7rem', color: '#ca8a04', marginLeft: '0.2rem' }}>rem (deficit)</span>
                                </div>
                            )}
                            {metrics.totalExcess > 0 && (
                                <div>
                                    <span style={{ fontSize: '1.35rem', fontWeight: '800', color: '#2563eb' }}>+{metrics.totalExcess.toLocaleString()}</span>
                                    <span style={{ fontSize: '0.7rem', color: '#3b82f6', marginLeft: '0.2rem' }}>excess</span>
                                </div>
                            )}
                            {metrics.totalRemaining === 0 && metrics.totalExcess === 0 && (
                                <div>
                                    <span style={{ fontSize: '1.35rem', fontWeight: '800', color: '#15803d' }}>0</span>
                                    <span style={{ fontSize: '0.7rem', color: '#166534', marginLeft: '0.2rem' }}>on point</span>
                                </div>
                            )}
                        </div>
                    </div>

                    <div style={{ 
                        backgroundColor: metrics.isAheadAsOfToday ? '#f0fdf4' : '#fef2f2', 
                        padding: '0.9rem', 
                        borderRadius: '8px', 
                        border: metrics.isAheadAsOfToday ? '1px solid #bbf7d0' : '1px solid #fecaca' 
                    }}>
                        <div style={{ fontSize: '0.75rem', color: metrics.isAheadAsOfToday ? '#166534' : '#991b1b', fontWeight: '600', textTransform: 'uppercase' }}>
                            Pacing Status (As of Today)
                        </div>
                        <div style={{ fontSize: '1.1rem', fontWeight: '800', color: metrics.isAheadAsOfToday ? '#15803d' : '#dc2626', marginTop: '0.2rem' }}>
                            {metrics.isAheadAsOfToday ? `Ahead by ${metrics.diffAsOfToday.toLocaleString()} (+${metrics.percentAsOfToday}%)` : `Behind by ${Math.abs(metrics.diffAsOfToday).toLocaleString()} (${metrics.percentAsOfToday}%)`}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: '#6b7280', marginTop: '0.25rem' }}>
                            Target: <strong>{metrics.plannedAsOfToday.toLocaleString()}</strong> | Done: <strong>{metrics.completedAsOfToday.toLocaleString()}</strong>
                        </div>
                    </div>
                </div>
            )}

            {/* Expandable Detail Graph & Edit Stats Sub-Card */}
            {showDetail && (
                <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px dashed #cbd5e1', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ backgroundColor: '#ffffff', padding: '0.9rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                        <div style={{ fontSize: '0.82rem', fontWeight: '700', color: '#334155', marginBottom: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                            <TrendingUp size={15} color="#3b82f6" /> Change Frequency Statistics ({title})
                        </div>
                        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                            <div style={{ backgroundColor: '#f1f5f9', padding: '0.5rem 0.8rem', borderRadius: '6px', fontSize: '0.8rem', color: '#475569' }}>
                                Plan Date Changed: <strong style={{ color: '#0f172a' }}>{editStats.planDateEdits} times</strong>
                            </div>
                            <div style={{ backgroundColor: '#f1f5f9', padding: '0.5rem 0.8rem', borderRadius: '6px', fontSize: '0.8rem', color: '#475569' }}>
                                Planned Qty Changed: <strong style={{ color: '#0f172a' }}>{editStats.plannedQtyEdits} times</strong>
                            </div>
                            <div style={{ backgroundColor: '#f1f5f9', padding: '0.5rem 0.8rem', borderRadius: '6px', fontSize: '0.8rem', color: '#475569' }}>
                                Completed Qty Changed: <strong style={{ color: '#0f172a' }}>{editStats.completedEdits} times</strong>
                            </div>
                        </div>
                    </div>

                    <div style={{ backgroundColor: '#ffffff', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                            <div style={{ fontSize: '0.85rem', fontWeight: '700', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <BarChart2 size={16} color="#3b82f6" />
                                {selectedEventTab === 'ALL' 
                                    ? `Completed Quantity Trend Across Event Types (${title})`
                                    : `Planned Target vs Actual Completed Trend (${title} - ${selectedEventTab})`
                                }
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <label style={{ fontSize: '0.78rem', color: '#475569', display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer', fontWeight: '600' }}>
                                    <input 
                                        type="checkbox"
                                        checked={showHistoryLines}
                                        onChange={e => setShowHistoryLines(e.target.checked)}
                                        style={{ cursor: 'pointer' }}
                                    />
                                    Show Past Edit Revision Lines
                                </label>

                                <div style={{ display: 'flex', gap: '0.2rem', backgroundColor: '#f1f5f9', padding: '0.15rem', borderRadius: '6px' }}>
                                    <button
                                        onClick={() => setChartMode('actuals')}
                                        style={{
                                            padding: '0.25rem 0.65rem',
                                            fontSize: '0.75rem',
                                            fontWeight: chartMode === 'actuals' ? '700' : '500',
                                            border: 'none',
                                            borderRadius: '4px',
                                            backgroundColor: chartMode === 'actuals' ? '#ffffff' : 'transparent',
                                            color: chartMode === 'actuals' ? '#1e293b' : '#64748b',
                                            boxShadow: chartMode === 'actuals' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        Actuals
                                    </button>
                                    <button
                                        onClick={() => setChartMode('cumulative')}
                                        style={{
                                            padding: '0.25rem 0.65rem',
                                            fontSize: '0.75rem',
                                            fontWeight: chartMode === 'cumulative' ? '700' : '500',
                                            border: 'none',
                                            borderRadius: '4px',
                                            backgroundColor: chartMode === 'cumulative' ? '#3b82f6' : 'transparent',
                                            color: chartMode === 'cumulative' ? '#ffffff' : '#64748b',
                                            boxShadow: chartMode === 'cumulative' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        Cumulative
                                    </button>
                                </div>
                            </div>
                        </div>

                        {selectedEventTab === 'ALL' ? (
                            <div style={{ overflowX: 'auto' }}>
                                <Plot
                                    data={allTabChartTraces}
                                    layout={{
                                        autosize: true,
                                        title: { text: '', font: { size: 13, color: '#1e293b', weight: 'bold' } },
                                        margin: { l: 50, r: 40, t: 30, b: 80 },
                                        xaxis: { title: { text: 'Plan Date' }, showgrid: true, gridcolor: '#f1f5f9' },
                                        yaxis: { title: { text: chartMode === 'cumulative' ? 'Cumulative Completed Qty' : 'Actual Completed Qty' }, showgrid: true, gridcolor: '#f1f5f9', range: [0, allTabMaxY] },
                                        legend: { orientation: 'h', y: -0.25, x: 0, xanchor: 'left', yanchor: 'top' },
                                        hovermode: 'x unified'
                                    }}
                                    style={{ width: '100%', height: '360px' }}
                                    config={{ responsive: true, displayModeBar: false }}
                                />
                            </div>
                        ) : (
                            <div style={{ overflowX: 'auto' }}>
                                <Plot
                                    data={singleTabTraces}
                                    layout={{
                                        autosize: true,
                                        title: { text: '', font: { size: 13, color: '#1e293b', weight: 'bold' } },
                                        margin: { l: 50, r: 40, t: 30, b: 80 },
                                        xaxis: { title: { text: 'Plan Date' }, showgrid: true, gridcolor: '#f1f5f9' },
                                        yaxis: { title: { text: chartMode === 'cumulative' ? 'Cumulative Quantity' : 'Actual Quantity' }, showgrid: true, gridcolor: '#f1f5f9', range: [0, singleTabMaxY] },
                                        legend: { orientation: 'h', y: -0.25, x: 0, xanchor: 'left', yanchor: 'top' },
                                        hovermode: 'x unified'
                                    }}
                                    style={{ width: '100%', height: '360px' }}
                                    config={{ responsive: true, displayModeBar: false }}
                                />
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default function SymbTrackerUpdate() {
    const { user } = useAuth();
    const [records, setRecords] = useState<TrackerRecord[]>([]);
    const [loading, setLoading] = useState(false);
    const [expandedHistoryIds, setExpandedHistoryIds] = useState<Record<string, boolean>>({});

    const toggleRowHistory = (id: string) => {
        setExpandedHistoryIds(prev => ({
            ...prev,
            [id]: !prev[id]
        }));
    };

    // Data Update Time Lock State & Live Timer
    const [backendLockState, setBackendLockState] = useState<any>(null);
    const [lockInfo, setLockInfo] = useState(() => getLockStatus(new Date(), null));

    useEffect(() => {
        const fetchBackendLockStatus = async () => {
            try {
                const res = await fetch('/api/access/data-lock-status');
                if (res.ok) {
                    const data = await res.json();
                    setBackendLockState(data);
                }
            } catch (e) {
                console.error("Error fetching lock status", e);
            }
        };

        fetchBackendLockStatus();
        const interval = setInterval(fetchBackendLockStatus, 10000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        const timer = setInterval(() => {
            setLockInfo(getLockStatus(new Date(), backendLockState));
        }, 1000);
        return () => clearInterval(timer);
    }, [backendLockState]);

    const hasPermission = (evt: string) => {
        if (!user) return false;
        if (user.role === 'Admin') return true;
        if (user.symb_permissions?.includes('ALL')) return true;
        return user.symb_permissions?.includes(evt);
    };
    
    // Bulk Form State
    const [variant, setVariant] = useState('1');
    const [eventType, setEventType] = useState('PCBA Ready');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [upd, setUpd] = useState('');
    const [bulkLoading, setBulkLoading] = useState(false);
    const [bulkMsg, setBulkMsg] = useState('');

    // Filtering State
    const [selectedEventTab, setSelectedEventTab] = useState<string>('ALL');
    const [columnFilters, setColumnFilters] = useState({
        variant: '',
        event_type: '',
        plan_date_from: '',
        plan_date_to: '',
        planned_qty: '',
        completed: '',
        acc_comp_date: '',
        created_by: ''
    });

    // Sorting State
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

    // Editing State
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState({ plan_date: '', planned_qty: 0, completed: 0 });

    // Delete Modal State
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [targetDeleteIds, setTargetDeleteIds] = useState<string[]>([]);
    const [adminId, setAdminId] = useState('Admin');
    const [adminPassword, setAdminPassword] = useState('');
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [deleteError, setDeleteError] = useState('');

    const handleOpenDeleteModal = (ids: string[]) => {
        if (ids.length === 0) return;
        setTargetDeleteIds(ids);
        setAdminPassword('');
        setDeleteError('');
        setDeleteModalOpen(true);
    };

    const handleConfirmDelete = async () => {
        setDeleteLoading(true);
        setDeleteError('');
        try {
            const res = await fetch('/api/admin/symb-updated-tracker/delete-bulk', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    admin_id: adminId,
                    admin_password: adminPassword,
                    record_ids: targetDeleteIds
                })
            });
            const data = await res.json();
            if (res.ok) {
                setDeleteModalOpen(false);
                fetchRecords();
            } else {
                setDeleteError(data.detail || 'Failed to verify admin credentials');
            }
        } catch (err: any) {
            setDeleteError(err.message || 'Server connection error');
        }
        setDeleteLoading(false);
    };

    const fetchRecords = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/admin/symb-updated-tracker');
            const data = await res.json();
            setRecords(data);
        } catch (err) {
            console.error(err);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchRecords();
    }, []);

    const filteredRecords = useMemo(() => {
        const res = records.filter(rec => {
            if (selectedEventTab !== 'ALL' && rec.event_type !== selectedEventTab) {
                return false;
            }
            if (columnFilters.variant && !String(rec.variant || '').toLowerCase().includes(columnFilters.variant.toLowerCase())) {
                return false;
            }
            if (columnFilters.event_type && !String(rec.event_type || '').toLowerCase().includes(columnFilters.event_type.toLowerCase())) {
                return false;
            }

            // Date Range & Exact Date Filtering for Plan Date
            if (columnFilters.plan_date_from || columnFilters.plan_date_to) {
                const recDate = parseDayDate(rec.plan_date);
                if (!recDate) return false;
                const recTime = new Date(recDate.getFullYear(), recDate.getMonth(), recDate.getDate()).getTime();

                if (columnFilters.plan_date_from) {
                    const fromDate = new Date(columnFilters.plan_date_from);
                    const fromTime = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate()).getTime();
                    if (recTime < fromTime) return false;
                }

                if (columnFilters.plan_date_to) {
                    const toDate = new Date(columnFilters.plan_date_to);
                    const toTime = new Date(toDate.getFullYear(), toDate.getMonth(), toDate.getDate()).getTime();
                    if (recTime > toTime) return false;
                }
            }

            if (columnFilters.planned_qty && !String(rec.planned_qty || '').toLowerCase().includes(columnFilters.planned_qty.toLowerCase())) {
                return false;
            }
            if (columnFilters.completed && !String(rec.completed || '').toLowerCase().includes(columnFilters.completed.toLowerCase())) {
                return false;
            }
            if (columnFilters.acc_comp_date) {
                const dateStr = rec.acc_comp_date ? new Date(rec.acc_comp_date).toLocaleString().toLowerCase() : '-';
                if (!dateStr.includes(columnFilters.acc_comp_date.toLowerCase())) {
                    return false;
                }
            }
            if (columnFilters.created_by) {
                const cbStr = rec.created_by ? rec.created_by.toLowerCase() : 'system';
                if (!cbStr.includes(columnFilters.created_by.toLowerCase())) {
                    return false;
                }
            }
            return true;
        });

        // Chronological Sort by Plan Date
        return res.sort((a: TrackerRecord, b: TrackerRecord) => {
            const dA = parseDayDate(a.plan_date);
            const dB = parseDayDate(b.plan_date);
            const timeA = dA ? dA.getTime() : 0;
            const timeB = dB ? dB.getTime() : 0;

            if (timeA !== timeB) {
                return sortOrder === 'asc' ? timeA - timeB : timeB - timeA;
            }

            if (a.variant !== b.variant) return String(a.variant).localeCompare(String(b.variant));
            return a.event_type.localeCompare(b.event_type);
        });
    }, [records, selectedEventTab, columnFilters, sortOrder]);

    const isVariant1 = (v: any) => {
        const s = String(v ?? '').trim().toLowerCase();
        return s === '1' || s === '1.0' || s === 'v1' || s.includes('variant 1') || s.includes('varient 1');
    };

    const isVariant2 = (v: any) => {
        const s = String(v ?? '').trim().toLowerCase();
        return s === '2' || s === '2.0' || s === 'v2' || s.includes('variant 2') || s.includes('varient 2');
    };

    const v1Records = useMemo(() => filteredRecords.filter((r: TrackerRecord) => isVariant1(r.variant)), [filteredRecords]);
    const v2Records = useMemo(() => filteredRecords.filter((r: TrackerRecord) => isVariant2(r.variant)), [filteredRecords]);

    const v1Metrics = useMemo(() => calcMetrics(v1Records), [v1Records]);
    const v2Metrics = useMemo(() => calcMetrics(v2Records), [v2Records]);

    const handleBulkSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!lockInfo.isEditAllowed) {
            setBulkMsg("Error: Data editing is locked for today (Editing permitted between 00:01 and 14:00 only)");
            return;
        }

        if (!hasPermission(eventType)) {
            setBulkMsg("Error: you dont have access to it");
            return;
        }

        setBulkLoading(true);
        setBulkMsg('');
        
        try {
            const authVal = localStorage.getItem('econ_auth');
            let token = '';
            if (authVal) {
                try { token = JSON.parse(authVal).token || ''; } catch(e){}
            }
            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const res = await fetch('/api/admin/symb-updated-tracker/bulk', {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    variant,
                    event_type: eventType,
                    start_date: startDate,
                    end_date: endDate,
                    upd: parseInt(upd) || 0
                })
            });
            const data = await res.json();
            if (res.ok) {
                setBulkMsg('Plan generated successfully!');
                fetchRecords();
            } else {
                setBulkMsg(`Error: ${data.detail}`);
            }
        } catch (err: any) {
            setBulkMsg(`Error: ${err.message}`);
        }
        setBulkLoading(false);
    };

    const startEditing = (rec: TrackerRecord) => {
        if (!lockInfo.isEditAllowed) {
            alert("Data update is currently locked for today (Locked from 14:01 to 00:00). Next update window opens at 00:01 AM.");
            return;
        }
        setEditingId(rec._id);
        setEditForm({
            plan_date: rec.plan_date,
            planned_qty: rec.planned_qty,
            completed: rec.completed
        });
    };

    const cancelEditing = () => {
        setEditingId(null);
    };

    const saveEditing = async (id: string, original: TrackerRecord) => {
        const changed = 
            editForm.plan_date !== original.plan_date || 
            editForm.planned_qty !== original.planned_qty || 
            editForm.completed !== original.completed;
            
        if (!changed) {
            setEditingId(null);
            return;
        }

        const confirmMsg = `Confirm update?\nThis will be recorded as a new edit if values changed.`;
        if (!window.confirm(confirmMsg)) return;

        try {
            const authVal = localStorage.getItem('econ_auth');
            let token = '';
            if (authVal) {
                try { token = JSON.parse(authVal).token || ''; } catch(e){}
            }
            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const res = await fetch(`/api/admin/symb-updated-tracker/${id}`, {
                method: 'PUT',
                headers,
                body: JSON.stringify(editForm)
            });
            if (res.ok) {
                setEditingId(null);
                fetchRecords();
            } else {
                alert('Failed to save update.');
            }
        } catch (err) {
            console.error(err);
            alert('Failed to save update.');
        }
    };

    const HistoryButton = ({ history = [], isExpanded, onToggle }: { history: EditHistoryEntry[]; isExpanded: boolean; onToggle: () => void }) => {
        if (!history || history.length === 0) return null;
        return (
            <button
                type="button"
                onClick={(e) => {
                    e.stopPropagation();
                    onToggle();
                }}
                style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.2rem',
                    marginLeft: '0.4rem',
                    padding: '0.15rem 0.45rem',
                    borderRadius: '4px',
                    border: isExpanded ? '1px solid #3b82f6' : '1px solid #d1d5db',
                    backgroundColor: isExpanded ? '#eff6ff' : '#ffffff',
                    color: isExpanded ? '#2563eb' : '#64748b',
                    fontSize: '0.72rem',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    boxShadow: isExpanded ? '0 1px 2px rgba(59,130,246,0.15)' : 'none'
                }}
                title={isExpanded ? 'Click to collapse history sub-table' : 'Click to reveal history sub-table'}
            >
                <History size={13} />
                <span>{history.length}</span>
                {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
        );
    };

    const RecordHistorySubTable = ({ rec, onClose }: { rec: TrackerRecord; onClose: () => void }) => {
        const planDateEdits = (rec.edit_history?.plan_date || []).map(h => ({ ...h, fieldLabel: 'Plan Date', badgeBg: '#dbeafe', badgeColor: '#1e40af' }));
        const plannedQtyEdits = (rec.edit_history?.planned_qty || []).map(h => ({ ...h, fieldLabel: 'Planned Qty', badgeBg: '#dcfce7', badgeColor: '#166534' }));
        const completedEdits = (rec.edit_history?.completed || []).map(h => ({ ...h, fieldLabel: 'Completed', badgeBg: '#f3e8ff', badgeColor: '#6b21a8' }));

        const allEdits = [...planDateEdits, ...plannedQtyEdits, ...completedEdits];
        allEdits.sort((a, b) => {
            const timeA = new Date(a.timestamp).getTime();
            const timeB = new Date(b.timestamp).getTime();
            if (timeA !== timeB) return timeA - timeB;
            return (a.edit || 0) - (b.edit || 0);
        });

        if (allEdits.length === 0) {
            return (
                <div style={{ padding: '0.75rem', fontSize: '0.8rem', color: '#64748b', fontStyle: 'italic' }}>
                    No edit history recorded yet.
                </div>
            );
        }

        return (
            <div style={{
                backgroundColor: '#ffffff',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03)',
                padding: '0.85rem 1.1rem',
                margin: '0.3rem 0'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', paddingBottom: '0.5rem', borderBottom: '1px solid #f1f5f9' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div style={{ backgroundColor: '#eff6ff', color: '#2563eb', padding: '0.35rem', borderRadius: '6px', display: 'flex' }}>
                            <History size={16} />
                        </div>
                        <div>
                            <span style={{ fontWeight: '700', fontSize: '0.88rem', color: '#0f172a' }}>
                                Edit History Sub-Table
                            </span>
                            <span style={{ fontSize: '0.75rem', color: '#64748b', marginLeft: '0.5rem' }}>
                                Variant: <strong>{rec.variant}</strong> | Event: <strong>{rec.event_type}</strong> | Plan Date: <strong>{rec.plan_date}</strong> ({allEdits.length} change{allEdits.length > 1 ? 's' : ''})
                            </span>
                        </div>
                    </div>
                    <button 
                        type="button"
                        onClick={onClose}
                        style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '0.25rem', 
                            backgroundColor: '#f1f5f9', 
                            border: '1px solid #e2e8f0', 
                            padding: '0.3rem 0.6rem', 
                            borderRadius: '5px', 
                            fontSize: '0.75rem', 
                            color: '#475569', 
                            cursor: 'pointer',
                            fontWeight: '600'
                        }}
                    >
                        <X size={14} /> Close
                    </button>
                </div>

                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', textAlign: 'left' }}>
                        <thead style={{ backgroundColor: '#f8fafc' }}>
                            <tr>
                                <th style={{ padding: '0.55rem 0.75rem', borderBottom: '2px solid #e2e8f0', color: '#475569', fontWeight: '700' }}>Edit #</th>
                                <th style={{ padding: '0.55rem 0.75rem', borderBottom: '2px solid #e2e8f0', color: '#475569', fontWeight: '700' }}>Field Modified</th>
                                <th style={{ padding: '0.55rem 0.75rem', borderBottom: '2px solid #e2e8f0', color: '#475569', fontWeight: '700' }}>Previous Value</th>
                                <th style={{ padding: '0.55rem 0.75rem', borderBottom: '2px solid #e2e8f0', color: '#475569', fontWeight: '700' }}>New Value</th>
                                <th style={{ padding: '0.55rem 0.75rem', borderBottom: '2px solid #e2e8f0', color: '#475569', fontWeight: '700' }}>Edited By</th>
                                <th style={{ padding: '0.55rem 0.75rem', borderBottom: '2px solid #e2e8f0', color: '#475569', fontWeight: '700' }}>Date & Time</th>
                            </tr>
                        </thead>
                        <tbody>
                            {allEdits.map((h, i) => {
                                const isOldDef = h.old_value !== undefined;
                                const prevVal = isOldDef ? String(h.old_value) : '-';
                                const newVal = isOldDef ? String(h.new_value ?? h.value) : String(h.value);
                                const editorName = h.edited_by ? h.edited_by.split('@')[0] : 'System';
                                const formattedTime = new Date(h.timestamp).toLocaleString();

                                return (
                                    <tr key={i} style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: i % 2 === 0 ? '#ffffff' : '#fafafa' }}>
                                        <td style={{ padding: '0.5rem 0.75rem', fontWeight: '700', color: '#64748b' }}>
                                            #{h.edit}
                                        </td>
                                        <td style={{ padding: '0.5rem 0.75rem' }}>
                                            <span style={{ 
                                                backgroundColor: h.badgeBg, 
                                                color: h.badgeColor, 
                                                padding: '0.2rem 0.55rem', 
                                                borderRadius: '12px', 
                                                fontSize: '0.73rem', 
                                                fontWeight: '700',
                                                display: 'inline-block'
                                            }}>
                                                {h.fieldLabel}
                                            </span>
                                        </td>
                                        <td style={{ padding: '0.5rem 0.75rem', color: '#64748b', fontStyle: prevVal === '-' ? 'italic' : 'normal' }}>
                                            {prevVal}
                                        </td>
                                        <td style={{ padding: '0.5rem 0.75rem', fontWeight: '700', color: '#2563eb' }}>
                                            {newVal}
                                        </td>
                                        <td style={{ padding: '0.5rem 0.75rem', color: '#334155' }} title={h.edited_by || ''}>
                                            <strong>{editorName}</strong>
                                        </td>
                                        <td style={{ padding: '0.5rem 0.75rem', color: '#64748b', fontSize: '0.78rem' }}>
                                            {formattedTime}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', padding: '1rem 0' }}>
            {/* Top Header Card: Data Update Time Lock Banner */}
            <div style={{ 
                backgroundColor: lockInfo.isTempUnlocked ? '#fff7ed' : (lockInfo.isEditAllowed ? '#f0fdf4' : '#fef2f2'),
                border: lockInfo.isTempUnlocked ? '1px solid #fdba74' : (lockInfo.isEditAllowed ? '1px solid #bbf7d0' : '1px solid #fecaca'),
                borderRadius: '10px',
                padding: '1.25rem 1.5rem',
                boxShadow: '0 4px 12px rgba(0,0,0,0.04)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '1rem',
                background: lockInfo.isTempUnlocked
                    ? 'linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)'
                    : (lockInfo.isEditAllowed 
                        ? 'linear-gradient(135deg, #f0fdf4 0%, #eff6ff 100%)' 
                        : 'linear-gradient(135deg, #fef2f2 0%, #fff7ed 100%)')
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '50%',
                        backgroundColor: lockInfo.isTempUnlocked ? '#ffedd5' : (lockInfo.isEditAllowed ? '#dcfce7' : '#fee2e2'),
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: lockInfo.isTempUnlocked ? '#c2410c' : (lockInfo.isEditAllowed ? '#166534' : '#991b1b'),
                        border: lockInfo.isTempUnlocked ? '1px solid #fdba74' : (lockInfo.isEditAllowed ? '1px solid #86efac' : '1px solid #fca5a5')
                    }}>
                        {lockInfo.isTempUnlocked ? <Clock size={24} /> : (lockInfo.isEditAllowed ? <Clock size={24} /> : <ShieldAlert size={24} />)}
                    </div>

                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '1.1rem', fontWeight: '800', color: '#1e293b' }}>
                                Data Update Lock Status
                            </span>
                            <span style={{
                                padding: '0.25rem 0.75rem',
                                borderRadius: '20px',
                                fontSize: '0.78rem',
                                fontWeight: '700',
                                backgroundColor: lockInfo.isTempUnlocked ? '#ea580c' : (lockInfo.isEditAllowed ? '#10b981' : '#ef4444'),
                                color: '#ffffff',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.3rem'
                            }}>
                                {lockInfo.isTempUnlocked ? '⚡ TEMPORARILY UNLOCKED (10 MINS)' : (lockInfo.isEditAllowed ? '🔓 EDIT ACCESS ACTIVE (00:01 - 14:00)' : '🔒 DATA EDITING LOCKED (14:01 - 00:00)')}
                            </span>
                        </div>

                        <div style={{ fontSize: '0.88rem', color: '#475569', marginTop: '0.3rem', fontWeight: '500' }}>
                            {lockInfo.isTempUnlocked ? (
                                <>
                                    Temporarily unlocked by <strong>{lockInfo.unlockedBy || 'Admin'}</strong>. Data editing is currently permitted for all users.
                                </>
                            ) : lockInfo.isEditAllowed ? (
                                <>
                                    People can edit data between <strong>00:01 AM</strong> and <strong>14:00 (2:00 PM)</strong>. 
                                    Edit access locks at <strong>{lockInfo.lockTimeStr}</strong>.
                                </>
                            ) : (
                                <>
                                    Data editing is locked every day from <strong>14:01 to 00:00</strong> midnight. 
                                    Next update window opens at <strong>{lockInfo.unlockTimeStr}</strong>.
                                </>
                            )}
                        </div>
                    </div>
                </div>

                <div style={{
                    backgroundColor: '#ffffff',
                    padding: '0.6rem 1.1rem',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.03)',
                    textAlign: 'right'
                }}>
                    <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: '700', textTransform: 'uppercase' }}>
                        {lockInfo.isTempUnlocked ? '10-Min Unlock Expires In' : (lockInfo.isEditAllowed ? 'Edit Access Locks In' : 'Edit Access Reopens In')}
                    </div>
                    <div style={{ fontSize: '1.25rem', fontWeight: '800', color: lockInfo.isTempUnlocked ? '#ea580c' : (lockInfo.isEditAllowed ? '#059669' : '#dc2626'), fontFamily: 'monospace' }}>
                        {lockInfo.isTempUnlocked 
                            ? `${String(lockInfo.mins).padStart(2, '0')}:${String(lockInfo.secs).padStart(2, '0')}`
                            : `${String(lockInfo.hrs).padStart(2, '0')}:${String(lockInfo.mins).padStart(2, '0')}:${String(lockInfo.secs).padStart(2, '0')}`
                        }
                    </div>
                </div>
            </div>

            {/* Action Tools: Bulk Plan Generator & Data Update */}
            <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', padding: '1.5rem', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', opacity: lockInfo.isEditAllowed ? 1 : 0.8 }}>
                <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.2rem', color: '#1f2937', display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'space-between' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Layers size={20} color="#3b82f6" /> Bulk Plan Generator
                    </span>
                    {!lockInfo.isEditAllowed && (
                        <span style={{ fontSize: '0.75rem', backgroundColor: '#fef2f2', color: '#dc2626', padding: '0.2rem 0.6rem', borderRadius: '4px', border: '1px solid #fecaca', fontWeight: '600' }}>
                            🔒 Locked (14:01 - 00:00)
                        </span>
                    )}
                </h3>
                <form onSubmit={handleBulkSubmit} style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'flex-end' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                        <label style={{ fontSize: '0.85rem', fontWeight: '600', color: '#4b5563' }}>Variant</label>
                        <select disabled={!lockInfo.isEditAllowed} value={variant} onChange={e => setVariant(e.target.value)} style={{ padding: '0.6rem', borderRadius: '4px', border: '1px solid #d1d5db' }}>
                            <option value="1">Variant 1</option>
                            <option value="2">Variant 2</option>
                        </select>
                    </div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                        <label style={{ fontSize: '0.85rem', fontWeight: '600', color: '#4b5563' }}>Event Type</label>
                        <select disabled={!lockInfo.isEditAllowed} value={eventType} onChange={e => setEventType(e.target.value)} style={{ padding: '0.6rem', borderRadius: '4px', border: '1px solid #d1d5db' }}>
                            {['PCBA Ready', 'Active alignment', 'Production/Assembly', 'FQC', 'Finished goods', 'Invoice Date', 'Shipment Date', 'customer place'].map(evt => (
                                <option key={evt} value={evt} disabled={!hasPermission(evt)}>
                                    {evt} {!hasPermission(evt) && '(No Access)'}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                        <label style={{ fontSize: '0.85rem', fontWeight: '600', color: '#4b5563' }}>Start Date</label>
                        <input disabled={!lockInfo.isEditAllowed} type="date" required value={startDate} onChange={e => setStartDate(e.target.value)} style={{ padding: '0.6rem', borderRadius: '4px', border: '1px solid #d1d5db' }} />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                        <label style={{ fontSize: '0.85rem', fontWeight: '600', color: '#4b5563' }}>End Date</label>
                        <input disabled={!lockInfo.isEditAllowed} type="date" required value={endDate} onChange={e => setEndDate(e.target.value)} style={{ padding: '0.6rem', borderRadius: '4px', border: '1px solid #d1d5db' }} />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                        <label style={{ fontSize: '0.85rem', fontWeight: '600', color: '#4b5563' }}>UPD (Planned Qty)</label>
                        <input disabled={!lockInfo.isEditAllowed} type="number" required min="0" value={upd} onChange={e => setUpd(e.target.value)} style={{ padding: '0.6rem', borderRadius: '4px', border: '1px solid #d1d5db', width: '120px' }} />
                    </div>

                    <button 
                        type="submit" 
                        disabled={bulkLoading || !lockInfo.isEditAllowed}
                        style={{ padding: '0.6rem 1.5rem', backgroundColor: lockInfo.isEditAllowed ? '#3b82f6' : '#94a3b8', color: 'white', border: 'none', borderRadius: '4px', fontWeight: '600', cursor: (bulkLoading || !lockInfo.isEditAllowed) ? 'not-allowed' : 'pointer' }}
                    >
                        {bulkLoading ? 'Generating...' : !lockInfo.isEditAllowed ? 'Locked (14:01 - 00:00)' : 'Generate Plan'}
                    </button>
                    {bulkMsg && <span style={{ color: bulkMsg.includes('Error') ? '#ef4444' : '#10b981', fontSize: '0.9rem', fontWeight: '500' }}>{bulkMsg}</span>}
                </form>
            </div>



            {/* Tracker Table Section */}
            <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', padding: '1.5rem', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', overflowX: 'auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#1f2937', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <FileText size={20} color="#3b82f6" /> Tracker Records
                    </h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                        <select 
                            value={sortOrder} 
                            onChange={e => setSortOrder(e.target.value as 'asc' | 'desc')}
                            style={{ 
                                padding: '0.4rem 0.65rem', 
                                borderRadius: '6px', 
                                border: '1px solid #d1d5db', 
                                fontSize: '0.8rem', 
                                fontWeight: '600', 
                                backgroundColor: '#ffffff',
                                color: '#374151',
                                cursor: 'pointer' 
                            }}
                        >
                            <option value="asc">📅 Sort: Oldest to Newest</option>
                            <option value="desc">📅 Sort: Newest to Oldest</option>
                        </select>
                        {user?.role === 'Admin' && (
                            <button 
                                onClick={() => handleOpenDeleteModal(filteredRecords.map((r: TrackerRecord) => r._id))}
                                disabled={filteredRecords.length === 0}
                                style={{ 
                                    backgroundColor: '#ef4444', 
                                    color: 'white', 
                                    border: 'none', 
                                    padding: '0.4rem 0.85rem', 
                                    borderRadius: '6px', 
                                    fontSize: '0.8rem', 
                                    fontWeight: '600', 
                                    cursor: filteredRecords.length === 0 ? 'not-allowed' : 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.4rem',
                                    opacity: filteredRecords.length === 0 ? 0.5 : 1,
                                    transition: 'all 0.15s ease'
                                }}
                            >
                                <Trash2 size={15} /> Delete Filtered Rows ({filteredRecords.length})
                            </button>
                        )}
                        <button onClick={fetchRecords} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
                            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Refresh
                        </button>
                    </div>
                </div>

                {/* Event Type Sub-Tabs */}
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem', borderBottom: '1px solid #e5e7eb', paddingBottom: '0.75rem' }}>
                    {EVENT_TABS.map(tab => (
                        <button
                            key={tab}
                            onClick={() => setSelectedEventTab(tab)}
                            style={{
                                padding: '0.4rem 0.9rem',
                                fontSize: '0.85rem',
                                fontWeight: selectedEventTab === tab ? '700' : '500',
                                border: 'none',
                                borderRadius: '6px',
                                backgroundColor: selectedEventTab === tab ? '#3b82f6' : '#f3f4f6',
                                color: selectedEventTab === tab ? '#ffffff' : '#4b5563',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease'
                            }}
                        >
                            {tab}
                        </button>
                    ))}
                </div>

                {/* Summary Metric Cards - Stack 1: Variant 1 & Stack 2: Variant 2 */}
                <MetricCardsStack title="Variant 1 Summary" metrics={v1Metrics} records={v1Records} selectedEventTab={selectedEventTab} />
                <MetricCardsStack title="Variant 2 Summary" metrics={v2Metrics} records={v2Records} selectedEventTab={selectedEventTab} />

                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                    <thead style={{ backgroundColor: '#f3f4f6' }}>
                        <tr>
                            <th style={{ padding: '0.75rem', borderBottom: '1px solid #e5e7eb', color: '#4b5563', fontWeight: '600' }}>Variant</th>
                            <th style={{ padding: '0.75rem', borderBottom: '1px solid #e5e7eb', color: '#4b5563', fontWeight: '600' }}>Event Type</th>
                            <th 
                                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')} 
                                style={{ padding: '0.75rem', borderBottom: '1px solid #e5e7eb', color: '#1e293b', fontWeight: '700', cursor: 'pointer', userSelect: 'none' }}
                                title="Click to toggle Oldest vs Newest sorting"
                            >
                                Plan Date {sortOrder === 'asc' ? '↑ (Oldest)' : '↓ (Newest)'}
                            </th>
                            <th style={{ padding: '0.75rem', borderBottom: '1px solid #e5e7eb', color: '#4b5563', fontWeight: '600' }}>Planned Qty</th>
                            <th style={{ padding: '0.75rem', borderBottom: '1px solid #e5e7eb', color: '#4b5563', fontWeight: '600' }}>Completed</th>
                            <th style={{ padding: '0.75rem', borderBottom: '1px solid #e5e7eb', color: '#4b5563', fontWeight: '600' }}>Remaining</th>
                            <th style={{ padding: '0.75rem', borderBottom: '1px solid #e5e7eb', color: '#4b5563', fontWeight: '600' }}>Excess</th>
                            <th style={{ padding: '0.75rem', borderBottom: '1px solid #e5e7eb', color: '#4b5563', fontWeight: '600' }}>Actual Comp. Date</th>
                            <th style={{ padding: '0.75rem', borderBottom: '1px solid #e5e7eb', color: '#4b5563', fontWeight: '600' }}>Created By</th>
                            <th style={{ padding: '0.75rem', borderBottom: '1px solid #e5e7eb', color: '#4b5563', fontWeight: '600', textAlign: 'right' }}>Actions</th>
                        </tr>
                        {/* Column Filter Inputs */}
                        <tr style={{ backgroundColor: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                            <th style={{ padding: '0.4rem 0.75rem' }}>
                                <input 
                                    type="text" 
                                    placeholder="Filter..." 
                                    value={columnFilters.variant} 
                                    onChange={e => setColumnFilters({...columnFilters, variant: e.target.value})} 
                                    style={{ width: '100%', padding: '0.25rem 0.4rem', fontSize: '0.78rem', borderRadius: '4px', border: '1px solid #d1d5db' }} 
                                />
                            </th>
                            <th style={{ padding: '0.4rem 0.75rem' }}>
                                <input 
                                    type="text" 
                                    placeholder="Filter..." 
                                    value={columnFilters.event_type} 
                                    onChange={e => setColumnFilters({...columnFilters, event_type: e.target.value})} 
                                    style={{ width: '100%', padding: '0.25rem 0.4rem', fontSize: '0.78rem', borderRadius: '4px', border: '1px solid #d1d5db' }} 
                                />
                            </th>
                            <th style={{ padding: '0.4rem 0.75rem', minWidth: '170px' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                                    <div style={{ display: 'flex', gap: '0.2rem', alignItems: 'center' }}>
                                        <span style={{ fontSize: '0.65rem', color: '#6b7280', width: '32px' }}>From:</span>
                                        <input 
                                            type="date" 
                                            value={columnFilters.plan_date_from} 
                                            onChange={e => setColumnFilters({...columnFilters, plan_date_from: e.target.value})} 
                                            style={{ flex: 1, padding: '0.15rem 0.3rem', fontSize: '0.72rem', borderRadius: '4px', border: '1px solid #d1d5db' }} 
                                        />
                                    </div>
                                    <div style={{ display: 'flex', gap: '0.2rem', alignItems: 'center' }}>
                                        <span style={{ fontSize: '0.65rem', color: '#6b7280', width: '32px' }}>To:</span>
                                        <input 
                                            type="date" 
                                            value={columnFilters.plan_date_to} 
                                            onChange={e => setColumnFilters({...columnFilters, plan_date_to: e.target.value})} 
                                            style={{ flex: 1, padding: '0.15rem 0.3rem', fontSize: '0.72rem', borderRadius: '4px', border: '1px solid #d1d5db' }} 
                                        />
                                    </div>
                                </div>
                            </th>
                            <th style={{ padding: '0.4rem 0.75rem' }}>
                                <input 
                                    type="text" 
                                    placeholder="Filter..." 
                                    value={columnFilters.planned_qty} 
                                    onChange={e => setColumnFilters({...columnFilters, planned_qty: e.target.value})} 
                                    style={{ width: '100%', padding: '0.25rem 0.4rem', fontSize: '0.78rem', borderRadius: '4px', border: '1px solid #d1d5db' }} 
                                />
                            </th>
                            <th style={{ padding: '0.4rem 0.75rem' }}>
                                <input 
                                    type="text" 
                                    placeholder="Filter..." 
                                    value={columnFilters.completed} 
                                    onChange={e => setColumnFilters({...columnFilters, completed: e.target.value})} 
                                    style={{ width: '100%', padding: '0.25rem 0.4rem', fontSize: '0.78rem', borderRadius: '4px', border: '1px solid #d1d5db' }} 
                                />
                            </th>
                            <th style={{ padding: '0.4rem 0.75rem' }}></th>
                            <th style={{ padding: '0.4rem 0.75rem' }}></th>
                            <th style={{ padding: '0.4rem 0.75rem' }}>
                                <input 
                                    type="text" 
                                    placeholder="Filter comp date..." 
                                    value={columnFilters.acc_comp_date} 
                                    onChange={e => setColumnFilters({...columnFilters, acc_comp_date: e.target.value})} 
                                    style={{ width: '100%', padding: '0.25rem 0.4rem', fontSize: '0.78rem', borderRadius: '4px', border: '1px solid #d1d5db' }} 
                                />
                            </th>
                            <th style={{ padding: '0.4rem 0.75rem' }}>
                                <input 
                                    type="text" 
                                    placeholder="Filter creator..." 
                                    value={columnFilters.created_by} 
                                    onChange={e => setColumnFilters({...columnFilters, created_by: e.target.value})} 
                                    style={{ width: '100%', padding: '0.25rem 0.4rem', fontSize: '0.78rem', borderRadius: '4px', border: '1px solid #d1d5db' }} 
                                />
                            </th>
                            <th style={{ padding: '0.4rem 0.75rem', textAlign: 'right' }}>
                                {(columnFilters.variant || columnFilters.event_type || columnFilters.plan_date_from || columnFilters.plan_date_to || columnFilters.planned_qty || columnFilters.completed || columnFilters.acc_comp_date || columnFilters.created_by) && (
                                    <button 
                                        onClick={() => setColumnFilters({ variant: '', event_type: '', plan_date_from: '', plan_date_to: '', planned_qty: '', completed: '', acc_comp_date: '', created_by: '' })}
                                        style={{ fontSize: '0.72rem', color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', fontWeight: '600' }}
                                    >
                                        Clear
                                    </button>
                                )}
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredRecords.map((rec: TrackerRecord) => {
                            const isEditing = editingId === rec._id;
                            const remaining = Math.max(0, (rec.planned_qty || 0) - (rec.completed || 0));
                            const excess = Math.max(0, (rec.completed || 0) - (rec.planned_qty || 0));

                            const today = new Date();
                            const todayTime = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
                            const recDate = parseDayDate(rec.plan_date);
                            const isFutureDate = recDate ? (new Date(recDate.getFullYear(), recDate.getMonth(), recDate.getDate()).getTime() > todayTime) : false;

                            const pDateHist = rec.edit_history?.plan_date || [];
                            const pQtyHist = rec.edit_history?.planned_qty || [];
                            const compHist = rec.edit_history?.completed || [];
                            const totalEditsCount = pDateHist.length + pQtyHist.length + compHist.length;
                            const isExpanded = !!expandedHistoryIds[rec._id];

                            return (
                                <React.Fragment key={rec._id}>
                                    <tr style={{ borderBottom: isExpanded ? 'none' : '1px solid #e5e7eb', backgroundColor: isEditing ? '#eff6ff' : (isExpanded ? '#f8fafc' : 'transparent') }}>
                                        <td style={{ padding: '0.75rem' }}>{rec.variant}</td>
                                        <td style={{ padding: '0.75rem' }}>{rec.event_type}</td>
                                        
                                        <td style={{ padding: '0.75rem' }}>
                                            {isEditing ? (
                                                <input type="text" value={editForm.plan_date} onChange={e => setEditForm({...editForm, plan_date: e.target.value})} style={{ width: '100px', padding: '0.3rem' }} />
                                            ) : (
                                                <div style={{ display: 'flex', alignItems: 'center' }}>
                                                    {rec.plan_date} 
                                                    <HistoryButton 
                                                        history={pDateHist} 
                                                        isExpanded={isExpanded} 
                                                        onToggle={() => toggleRowHistory(rec._id)} 
                                                    />
                                                </div>
                                            )}
                                        </td>

                                        <td style={{ padding: '0.75rem' }}>
                                            {isEditing ? (
                                                <input type="number" value={editForm.planned_qty} onChange={e => setEditForm({...editForm, planned_qty: parseInt(e.target.value) || 0})} style={{ width: '80px', padding: '0.3rem' }} />
                                            ) : (
                                                <div style={{ display: 'flex', alignItems: 'center' }}>
                                                    {rec.planned_qty} 
                                                    <HistoryButton 
                                                        history={pQtyHist} 
                                                        isExpanded={isExpanded} 
                                                        onToggle={() => toggleRowHistory(rec._id)} 
                                                    />
                                                </div>
                                            )}
                                        </td>

                                        <td style={{ padding: '0.75rem' }}>
                                            {isEditing ? (
                                                <input 
                                                    type="number" 
                                                    disabled={isFutureDate}
                                                    value={editForm.completed} 
                                                    onChange={e => setEditForm({...editForm, completed: parseInt(e.target.value) || 0})} 
                                                    style={{ 
                                                        width: '80px', 
                                                        padding: '0.3rem',
                                                        backgroundColor: isFutureDate ? '#f3f4f6' : '#ffffff',
                                                        color: isFutureDate ? '#9ca3af' : '#1f2937',
                                                        cursor: isFutureDate ? 'not-allowed' : 'auto'
                                                    }} 
                                                    title={isFutureDate ? 'Completed quantity cannot be updated for future dates' : ''}
                                                />
                                            ) : (
                                                <div style={{ display: 'flex', alignItems: 'center' }}>
                                                    <span style={{ color: rec.completed >= rec.planned_qty && rec.planned_qty > 0 ? '#10b981' : '#1f2937', fontWeight: '500' }}>
                                                        {rec.completed}
                                                    </span>
                                                    <HistoryButton 
                                                        history={compHist} 
                                                        isExpanded={isExpanded} 
                                                        onToggle={() => toggleRowHistory(rec._id)} 
                                                    />
                                                </div>
                                            )}
                                        </td>

                                        {/* Remaining Column */}
                                        <td style={{ padding: '0.75rem', color: remaining > 0 ? '#d97706' : '#9ca3af', fontWeight: remaining > 0 ? '600' : '400' }}>
                                            {remaining.toLocaleString()}
                                        </td>

                                        {/* Excess Column */}
                                        <td style={{ padding: '0.75rem', color: excess > 0 ? '#2563eb' : '#9ca3af', fontWeight: excess > 0 ? '600' : '400' }}>
                                            {excess > 0 ? `+${excess.toLocaleString()}` : '0'}
                                        </td>

                                        <td style={{ padding: '0.75rem', color: '#6b7280', fontSize: '0.8rem' }}>
                                            {rec.acc_comp_date ? new Date(rec.acc_comp_date).toLocaleString() : '-'}
                                        </td>

                                        {/* Created By & Date Column */}
                                        <td style={{ padding: '0.75rem', color: '#4b5563', fontSize: '0.8rem' }}>
                                            {rec.created_by ? `${rec.created_by.split('@')[0]} (${rec.created_at ? new Date(rec.created_at).toLocaleDateString() : '-'})` : 'System'}
                                        </td>

                                        <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                                            {isEditing ? (
                                                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                                                    <button onClick={() => saveEditing(rec._id, rec)} style={{ backgroundColor: '#10b981', color: 'white', border: 'none', padding: '0.3rem 0.6rem', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                                                        <Save size={14} /> Save
                                                    </button>
                                                    <button onClick={cancelEditing} style={{ backgroundColor: '#e5e7eb', color: '#4b5563', border: 'none', padding: '0.3rem 0.6rem', borderRadius: '4px', cursor: 'pointer' }}>
                                                        Cancel
                                                    </button>
                                                </div>
                                            ) : (
                                                <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end', alignItems: 'center' }}>
                                                    {totalEditsCount > 0 && (
                                                        <button 
                                                            type="button"
                                                            onClick={() => toggleRowHistory(rec._id)} 
                                                            style={{ 
                                                                backgroundColor: isExpanded ? '#eff6ff' : '#ffffff', 
                                                                border: isExpanded ? '1px solid #3b82f6' : '1px solid #d1d5db', 
                                                                color: isExpanded ? '#2563eb' : '#4b5563', 
                                                                padding: '0.3rem 0.55rem', 
                                                                borderRadius: '4px', 
                                                                cursor: 'pointer', 
                                                                display: 'flex', 
                                                                alignItems: 'center', 
                                                                gap: '0.25rem',
                                                                fontSize: '0.78rem',
                                                                fontWeight: '600'
                                                            }}
                                                            title="Toggle history sub-table"
                                                        >
                                                            <History size={13} /> History ({totalEditsCount}) {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                                        </button>
                                                    )}
                                                    {hasPermission(rec.event_type) ? (
                                                        <button onClick={() => startEditing(rec)} style={{ backgroundColor: 'transparent', border: '1px solid #d1d5db', color: '#4b5563', padding: '0.3rem 0.6rem', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                                                            <Edit2 size={14} /> Edit
                                                        </button>
                                                    ) : (
                                                        <span style={{ fontSize: '0.75rem', color: '#ef4444', fontStyle: 'italic', marginRight: '0.5rem' }}>
                                                            you dont have access to it
                                                        </span>
                                                    )}
                                                    {user?.role === 'Admin' && (
                                                        <button onClick={() => handleOpenDeleteModal([rec._id])} title="Delete record (Admin)" style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', padding: '0.3rem 0.5rem', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                                                            <Trash2 size={14} />
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                    {isExpanded && (
                                        <tr key={`${rec._id}-history`} style={{ borderBottom: '1px solid #e5e7eb', backgroundColor: '#f8fafc' }}>
                                            <td colSpan={10} style={{ padding: '0.4rem 1rem 1rem 1rem' }}>
                                                <RecordHistorySubTable rec={rec} onClose={() => toggleRowHistory(rec._id)} />
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            );
                        })}
                        {filteredRecords.length === 0 && !loading && (
                            <tr>
                                <td colSpan={10} style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>
                                    No records match the selected sub-tab or column filters.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Admin Verification Modal for Delete Confirmation */}
            {deleteModalOpen && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(15, 23, 42, 0.65)',
                    backdropFilter: 'blur(3px)',
                    zIndex: 9999,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '1rem'
                }}>
                    <div style={{
                        backgroundColor: '#ffffff',
                        borderRadius: '12px',
                        boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)',
                        maxWidth: '420px',
                        width: '100%',
                        overflow: 'hidden',
                        border: '1px solid #e2e8f0'
                    }}>
                        <div style={{ backgroundColor: '#fef2f2', padding: '1.25rem', borderBottom: '1px solid #fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                <div style={{ backgroundColor: '#fee2e2', padding: '0.5rem', borderRadius: '50%', display: 'flex' }}>
                                    <ShieldAlert size={22} color="#dc2626" />
                                </div>
                                <div>
                                    <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: '700', color: '#991b1b' }}>Admin Verification Required</h4>
                                    <span style={{ fontSize: '0.75rem', color: '#b91c1c' }}>Confirm deletion of {targetDeleteIds.length} record(s)</span>
                                </div>
                            </div>
                            <button onClick={() => setDeleteModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#991b1b' }}>
                                <X size={18} />
                            </button>
                        </div>

                        <form onSubmit={e => { e.preventDefault(); handleConfirmDelete(); }} style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <p style={{ margin: 0, fontSize: '0.82rem', color: '#475569', lineHeight: '1.4' }}>
                                Please enter Admin credentials to permanently delete the selected <strong>{targetDeleteIds.length} record(s)</strong> from the database. Deleted records will be permanently removed so new plans can be generated for these dates.
                            </p>

                            {deleteError && (
                                <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', padding: '0.6rem', borderRadius: '6px', fontSize: '0.8rem', fontWeight: '600' }}>
                                    ⚠️ {deleteError}
                                </div>
                            )}

                            <div>
                                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '600', color: '#334155', marginBottom: '0.3rem' }}>Admin ID</label>
                                <input 
                                    type="text" 
                                    required 
                                    value={adminId} 
                                    onChange={e => setAdminId(e.target.value)} 
                                    style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }} 
                                    placeholder="Admin ID"
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '600', color: '#334155', marginBottom: '0.3rem' }}>Admin Password</label>
                                <input 
                                    type="password" 
                                    required 
                                    value={adminPassword} 
                                    onChange={e => setAdminPassword(e.target.value)} 
                                    style={{ width: '100%', padding: '0.55rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }} 
                                    placeholder="Enter password"
                                />
                            </div>

                            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                                <button
                                    type="button"
                                    onClick={() => setDeleteModalOpen(false)}
                                    style={{ padding: '0.55rem 1rem', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', color: '#475569', fontSize: '0.82rem', fontWeight: '600', cursor: 'pointer' }}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={deleteLoading}
                                    style={{ padding: '0.55rem 1.25rem', borderRadius: '6px', border: 'none', backgroundColor: '#dc2626', color: '#ffffff', fontSize: '0.82rem', fontWeight: '600', cursor: deleteLoading ? 'not-allowed' : 'pointer' }}
                                >
                                    {deleteLoading ? 'Verifying...' : 'Verify & Delete'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

