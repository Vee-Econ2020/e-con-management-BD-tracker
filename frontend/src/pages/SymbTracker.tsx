import { useEffect, useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Plot from 'react-plotly.js';
import { ArrowLeft, RefreshCw, X, Table, Activity } from 'lucide-react';
import '../index.css';

interface SymbRecord {
    _id?: any;
    'Record Id'?: string;
    'Account Name (Opportunities Name)'?: string;
    'Committed Due date'?: string;
    'Customer Request date'?: string;
    'SO Number'?: string;
    'SO NUMBER'?: string;
    'Product Status'?: string;
    'Regular-Product Stage'?: string;
    'n-reg_stage'?: string;
    Status?: string;
    Quantity?: number | string;
    who?: string;
    week_diff?: number;
    new_flag_algo?: string;
    'recovery stage'?: string;
    file_date?: string;
    created_at?: string;
    [key: string]: any;
}

interface FlagMappingRule {
    'Regular Stage'?: string;
    blue?: string | null;
    green?: string | null;
    yellow?: string | null;
    red?: string | null;
}

interface ProductionProgressRecord {
    'Customer Name'?: string;
    'Product Name'?: string;
    'UPD (85% efficiency)'?: number | string;
    'Day'?: string;
    'Daily Production'?: number | string;
    'completed'?: number | string;
    'Data category'?: string;
    [key: string]: any;
}

// Helper to parse dates deterministically (26-Jun-2026, 16-07-2026, 2026-06-26)
function parseDayDate(dayStr: any): Date | null {
    if (!dayStr) return null;
    const str = String(dayStr).trim();
    if (!str) return null;

    // 1. Try ISO format YYYY-MM-DD or YYYY/MM/DD
    const isoMatch = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
    if (isoMatch) {
        const year = parseInt(isoMatch[1], 10);
        const month = parseInt(isoMatch[2], 10) - 1;
        const day = parseInt(isoMatch[3], 10);
        return new Date(year, month, day);
    }

    // 2. Try DD-MMM-YYYY or DD-MM-YYYY (e.g. 01-Jul-2026, 01-JUL-2026, 01-07-2026, 16-07-2026)
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

    // 3. Fallback
    const d = new Date(str);
    return isNaN(d.getTime()) ? null : d;
}

// Format date as 26-JUN-2026
function formatDayPrettyUpper(dateObj: Date): string {
    const day = String(dateObj.getDate()).padStart(2, '0');
    const month = dateObj.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
    const year = dateObj.getFullYear();
    return `${day}-${month}-${year}`;
}

// ----------------------------------------------------------------------
// Reusable Production Progress Cumulative Chart Component for V1 & V2
// ----------------------------------------------------------------------
function ProductionProgressChart({ records, versionTitle }: { records: ProductionProgressRecord[]; versionTitle: 'V1' | 'V2' }) {
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    // Filter records where Customer Name contains V1 or V2 (case insensitive)
    const filtered = useMemo(() => {
        return records.filter(r => {
            const cust = String(r['Customer Name'] || '').toLowerCase();
            return cust.includes(versionTitle.toLowerCase());
        });
    }, [records, versionTitle]);

    // Compute cumulative line traces grouped by Data category aligned on a UNIFIED master timeline
    const { traces, annotations, sortedPrettyDates, allDateObjs, maxY } = useMemo(() => {
        // 1. Build a master list of all unique dates across all filtered records sorted chronologically
        const dateMap = new Map<string, { dateStr: string; dateObj: Date; timestamp: number }>();

        filtered.forEach(r => {
            const dayStr = String(r['Day'] || '');
            const dObj = parseDayDate(dayStr);
            if (dObj) {
                const formatted = formatDayPrettyUpper(dObj);
                if (!dateMap.has(formatted)) {
                    dateMap.set(formatted, { dateStr: formatted, dateObj: dObj, timestamp: dObj.getTime() });
                }
            }
        });

        // Master chronological date list sorted by timestamp
        const allDateObjs = Array.from(dateMap.values()).sort((a, b) => a.timestamp - b.timestamp);
        const allDateStrs = allDateObjs.map(d => d.dateStr);

        // 2. Collect distinct Data category values
        const categories = Array.from(
            new Set(filtered.map(r => String(r['Data category'] || '').trim()).filter(Boolean))
        );

        const colorPalette = ['#1e40af', '#0284c7', '#ea580c', '#16a34a', '#8b5cf6', '#d97706'];

        const traceList: any[] = [];
        const annotationList: any[] = [];
        let maxY = 0;

        categories.forEach((cat, idx) => {
            const catRows = filtered.filter(r => String(r['Data category'] || '').trim() === cat);

            // Map daily completed quantities for this category
            const catDayCompletedMap = new Map<string, number>();
            catRows.forEach(r => {
                const dayStr = String(r['Day'] || '');
                const dObj = parseDayDate(dayStr);
                if (dObj) {
                    const formatted = formatDayPrettyUpper(dObj);
                    const completed = Number(r['completed']) || 0;
                    catDayCompletedMap.set(formatted, (catDayCompletedMap.get(formatted) || 0) + completed);
                }
            });

            let runningSum = 0;
            const traceX: string[] = [];
            const traceY: number[] = [];
            const traceText: string[] = [];
            const traceMarkerSizes: number[] = [];

            // Compute running sum using only days that have data for this category
            allDateObjs.forEach(dItem => {
                if (catDayCompletedMap.has(dItem.dateStr)) {
                    const dailyQty = catDayCompletedMap.get(dItem.dateStr) || 0;
                    runningSum += dailyQty;

                    traceX.push(dItem.dateStr);
                    traceY.push(runningSum);
                    
                    if (dailyQty > 0) {
                        traceText.push(`${runningSum}`);
                        traceMarkerSizes.push(8);
                    } else {
                        traceText.push('');
                        traceMarkerSizes.push(0);
                    }
                }
            });

            if (traceX.length === 0) return;

            const color = colorPalette[idx % colorPalette.length];
            if (runningSum > maxY) maxY = runningSum;

            traceList.push({
                x: traceX,
                y: traceY,
                name: cat,
                mode: 'lines+markers+text',
                text: traceText,
                // Alternate top/bottom placement per category so labels from
                // nearby lines never stack on top of one another.
                textposition: idx % 2 === 0 ? 'top center' : 'bottom center',
                textfont: { size: 16, color: '#0f172a', weight: 'bold' },
                marker: {
                    size: traceMarkerSizes,
                    color: color
                },
                line: { shape: 'spline', width: 3, color: color },
                connectgaps: true,
                hoverinfo: 'x+name+y'
            });

            // Add end-of-line category label annotation where the line STOPS
            const lastX = traceX[traceX.length - 1];
            const lastY = traceY[traceY.length - 1];
            annotationList.push({
                x: lastX,
                y: lastY,
                text: `<b>${cat}</b>`,
                xanchor: 'left',
                yanchor: 'middle',
                showarrow: false,
                font: { size: 16, color: color, weight: 'bold' },
                xshift: 10
            });
        });

        return { traces: traceList, annotations: annotationList, sortedPrettyDates: allDateStrs, allDateObjs, maxY };
    }, [filtered]);

    // Auto-scroll to show past 10 days and next 3 days relative to today
    useEffect(() => {
        if (!scrollContainerRef.current || allDateObjs.length === 0) return;

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const past10 = new Date(today);
        past10.setDate(today.getDate() - 10);

        // Find index of date closest to past 10 days
        let targetIdx = 0;
        let minDiff = Infinity;

        allDateObjs.forEach((dItem, idx) => {
            const diff = Math.abs(dItem.dateObj.getTime() - past10.getTime());
            if (diff < minDiff) {
                minDiff = diff;
                targetIdx = idx;
            }
        });

        const total = allDateObjs.length;
        if (total > 0 && scrollContainerRef.current) {
            const container = scrollContainerRef.current;
            const scrollWidth = container.scrollWidth;
            const clientWidth = container.clientWidth;
            const maxScroll = scrollWidth - clientWidth;

            if (maxScroll > 0) {
                const targetRatio = targetIdx / total;
                container.scrollLeft = Math.min(maxScroll, Math.max(0, targetRatio * scrollWidth));
            }
        }
    }, [allDateObjs]);

    // Calculate dynamic container width (approx 85px per date so ~13-14 days fit on screen)
    const chartWidth = Math.max(1200, sortedPrettyDates.length * 85);

    // Compute 3 summary card totals for AVLN PCBA, Active Alignment, and Finished Goods
    const summaryCards = useMemo(() => {
        const totals: { [key: string]: number } = {
            'AVLN PCBA': 0,
            'Active alignment': 0,
            'Finished goods': 0
        };

        filtered.forEach(r => {
            const catRaw = String(r['Data category'] || '').trim();
            const completed = Number(r['completed']) || 0;

            const catLower = catRaw.toLowerCase();
            if (catLower.includes('avln') || catLower.includes('pcba')) {
                totals['AVLN PCBA'] += completed;
            } else if (catLower.includes('active') || catLower.includes('alignment') || catLower === 'aa') {
                totals['Active alignment'] += completed;
            } else if (catLower.includes('finished') || catLower.includes('goods') || catLower === 'fg') {
                totals['Finished goods'] += completed;
            }
        });

        return totals;
    }, [filtered]);

    return (
        <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '0 0 12px 12px',
            border: '1px solid #e2e8f0',
            borderTop: 'none',
            padding: '1.5rem',
            boxShadow: '0 4px 15px rgba(0,0,0,0.05)',
            marginBottom: '3rem'
        }}>
            <div style={{ marginBottom: '1rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.75rem' }}>
                <h3 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, color: '#1e293b' }}>
                    {versionTitle} Production Progress Cumulative Chart
                </h3>
                <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
                    Filtered for {versionTitle} Customer orders • Cumulative sum of completed units (Column F) by Data category
                </span>
            </div>

            {/* 3 Metric Data Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.25rem', marginBottom: '1.5rem', marginTop: '0.5rem' }}>
                <div style={{
                    backgroundColor: '#f0f9ff',
                    border: '1px solid #bae6fd',
                    borderRadius: '10px',
                    padding: '1.25rem 1.5rem',
                    display: 'flex',
                    flexDirection: 'column',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.02)'
                }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0369a1', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        Final AVLN PCBA Cumulative
                    </span>
                    <span style={{ fontSize: '2.4rem', fontWeight: 900, color: '#0284c7', marginTop: '0.25rem', lineHeight: 1.1 }}>
                        {summaryCards['AVLN PCBA'].toLocaleString()}
                    </span>
                    <span style={{ fontSize: '0.78rem', color: '#0284c7', fontWeight: 600, marginTop: '0.35rem' }}>
                        Total Completed Units
                    </span>
                </div>

                <div style={{
                    backgroundColor: '#eff6ff',
                    border: '1px solid #bfdbfe',
                    borderRadius: '10px',
                    padding: '1.25rem 1.5rem',
                    display: 'flex',
                    flexDirection: 'column',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.02)'
                }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1d4ed8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        Current Total Active Alignment (AA)
                    </span>
                    <span style={{ fontSize: '2.4rem', fontWeight: 900, color: '#1e40af', marginTop: '0.25rem', lineHeight: 1.1 }}>
                        {summaryCards['Active alignment'].toLocaleString()}
                    </span>
                    <span style={{ fontSize: '0.78rem', color: '#1e40af', fontWeight: 600, marginTop: '0.35rem' }}>
                        Total Completed Units
                    </span>
                </div>

                <div style={{
                    backgroundColor: '#fff7ed',
                    border: '1px solid #fed7aa',
                    borderRadius: '10px',
                    padding: '1.25rem 1.5rem',
                    display: 'flex',
                    flexDirection: 'column',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.02)'
                }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#c2410c', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        Total Finished Goods (FG)
                    </span>
                    <span style={{ fontSize: '2.4rem', fontWeight: 900, color: '#ea580c', marginTop: '0.25rem', lineHeight: 1.1 }}>
                        {summaryCards['Finished goods'].toLocaleString()}
                    </span>
                    <span style={{ fontSize: '0.78rem', color: '#ea580c', fontWeight: 600, marginTop: '0.35rem' }}>
                        Total Completed Units
                    </span>
                </div>
            </div>

            {traces.length === 0 ? (
                <div style={{ padding: '4rem', textAlign: 'center', color: '#64748b' }}>
                    No {versionTitle} Production Progress data found. Upload a Production Progress CSV in Admin Data Upload under SYMB References tab to view charts!
                </div>
            ) : (
                <div ref={scrollContainerRef} style={{ width: '100%', overflowX: 'auto', paddingBottom: '0.5rem' }}>
                    <div style={{ width: `${chartWidth}px`, height: 'clamp(520px, 62vh, 700px)' }}>
                        <Plot
                            data={traces}
                            layout={{
                                autosize: true,
                                margin: { t: 50, b: 130, l: 80, r: 180 },
                                xaxis: {
                                    title: { text: 'Day', font: { size: 16, color: '#1e293b' } },
                                    type: 'category',
                                    categoryorder: 'array',
                                    categoryarray: sortedPrettyDates,
                                    tickfont: { size: 13, color: '#0f172a' },
                                    tickangle: -45,
                                    automargin: true
                                },
                                yaxis: {
                                    title: { text: 'Cumulative Completed', font: { size: 16, color: '#1e293b' } },
                                    tickfont: { size: 14, color: '#0f172a' },
                                    gridcolor: '#f1f5f9',
                                    // Extra headroom above/below the data so top/bottom text
                                    // labels never get clipped or overlap the axes.
                                    range: [-(maxY * 0.12 || 5), maxY * 1.18 || 10]
                                },
                                legend: {
                                    orientation: 'h',
                                    x: 0,
                                    y: 1.12,
                                    font: { size: 16, color: '#0f172a' }
                                },
                                annotations: annotations,
                                plot_bgcolor: '#ffffff',
                                paper_bgcolor: '#ffffff'
                            }}
                            useResizeHandler={true}
                            style={{ width: '100%', height: '100%' }}
                            config={{ displayModeBar: false }}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}

// ----------------------------------------------------------------------
// Planned vs Completed Cumulative Chart for a Single Category
// ----------------------------------------------------------------------
function CategoryPlannedVsCompletedChart({
    records,
    versionTitle,
    categoryName
}: {
    records: ProductionProgressRecord[];
    versionTitle: 'V1' | 'V2';
    categoryName: string;
}) {
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    const filtered = useMemo(() => {
        return records.filter(r => {
            const cust = String(r['Customer Name'] || '').toLowerCase();
            const cat = String(r['Data category'] || '').toLowerCase();
            const targetCat = categoryName.toLowerCase();

            const isCustMatch = cust.includes(versionTitle.toLowerCase());
            let isCatMatch = false;

            if (targetCat.includes('active') || targetCat.includes('alignment')) {
                isCatMatch = cat.includes('active') || cat.includes('alignment') || cat === 'aa';
            } else if (targetCat.includes('avln') || targetCat.includes('pcba')) {
                isCatMatch = cat.includes('avln') || cat.includes('pcba');
            } else if (targetCat.includes('finished') || targetCat.includes('goods')) {
                isCatMatch = cat.includes('finished') || cat.includes('goods') || cat === 'fg';
            } else {
                isCatMatch = cat.includes(targetCat);
            }

            return isCustMatch && isCatMatch;
        });
    }, [records, versionTitle, categoryName]);

    const { traces, annotations, sortedPrettyDates, allDateObjs, totalPlanned, totalCompleted } = useMemo(() => {
        const dateMap = new Map<string, { dateStr: string; dateObj: Date; timestamp: number }>();

        filtered.forEach(r => {
            const dayStr = String(r['Day'] || '');
            const dObj = parseDayDate(dayStr);
            if (dObj) {
                const formatted = formatDayPrettyUpper(dObj);
                if (!dateMap.has(formatted)) {
                    dateMap.set(formatted, { dateStr: formatted, dateObj: dObj, timestamp: dObj.getTime() });
                }
            }
        });

        const allDateObjs = Array.from(dateMap.values()).sort((a, b) => a.timestamp - b.timestamp);
        const allDateStrs = allDateObjs.map(d => d.dateStr);

        const dayPlannedMap = new Map<string, number>();
        const dayCompletedMap = new Map<string, number>();

        filtered.forEach(r => {
            const dayStr = String(r['Day'] || '');
            const dObj = parseDayDate(dayStr);
            if (dObj) {
                const formatted = formatDayPrettyUpper(dObj);
                const planned = Number(r['Daily Production']) || 0;
                const completed = Number(r['completed']) || 0;

                dayPlannedMap.set(formatted, (dayPlannedMap.get(formatted) || 0) + planned);
                dayCompletedMap.set(formatted, (dayCompletedMap.get(formatted) || 0) + completed);
            }
        });

        let cumPlanned = 0;
        let cumCompleted = 0;

        const traceX: string[] = [];
        const traceYPlanned: number[] = [];
        const traceYCompleted: number[] = [];

        const traceTextPlanned: string[] = [];
        const traceTextCompleted: string[] = [];

        const markerSizesPlanned: number[] = [];
        const markerSizesCompleted: number[] = [];

        allDateObjs.forEach(dItem => {
            const pVal = dayPlannedMap.get(dItem.dateStr) || 0;
            const cVal = dayCompletedMap.get(dItem.dateStr) || 0;

            if (dayPlannedMap.has(dItem.dateStr) || dayCompletedMap.has(dItem.dateStr)) {
                cumPlanned += pVal;
                cumCompleted += cVal;

                traceX.push(dItem.dateStr);
                traceYPlanned.push(cumPlanned);
                traceYCompleted.push(cumCompleted);

                if (pVal > 0) {
                    traceTextPlanned.push(`${cumPlanned}`);
                    markerSizesPlanned.push(8);
                } else {
                    traceTextPlanned.push('');
                    markerSizesPlanned.push(0);
                }

                if (cVal > 0) {
                    traceTextCompleted.push(`${cumCompleted}`);
                    markerSizesCompleted.push(8);
                } else {
                    traceTextCompleted.push('');
                    markerSizesCompleted.push(0);
                }
            }
        });

        const traceList: any[] = [];
        const annotationList: any[] = [];

        if (traceX.length > 0) {
            traceList.push({
                x: traceX,
                y: traceYPlanned,
                name: 'Planned Cumulative',
                mode: 'lines+markers+text',
                text: traceTextPlanned,
                textposition: 'top center',
                textfont: { size: 15, color: '#3b82f6', weight: 'bold' },
                marker: { size: markerSizesPlanned, color: '#3b82f6' },
                line: { shape: 'spline', width: 3, color: '#3b82f6', dash: 'dash' },
                connectgaps: true,
                hoverinfo: 'x+name+y'
            });

            traceList.push({
                x: traceX,
                y: traceYCompleted,
                name: 'Completed Cumulative',
                mode: 'lines+markers+text',
                text: traceTextCompleted,
                // Placed below its own point (Planned stays above) so the two
                // cumulative labels never sit on top of each other, even when
                // Planned and Completed values are nearly identical.
                textposition: 'bottom center',
                textfont: { size: 15, color: '#16a34a', weight: 'bold' },
                marker: { size: markerSizesCompleted, color: '#16a34a' },
                line: { shape: 'spline', width: 3, color: '#16a34a' },
                connectgaps: true,
                hoverinfo: 'x+name+y'
            });

            const lastX = traceX[traceX.length - 1];
            const lastYPlanned = traceYPlanned[traceYPlanned.length - 1];
            const lastYCompleted = traceYCompleted[traceYCompleted.length - 1];

            annotationList.push({
                x: lastX,
                y: lastYPlanned,
                text: `<b>Planned (${lastYPlanned})</b>`,
                xanchor: 'left',
                yanchor: 'middle',
                showarrow: false,
                font: { size: 14, color: '#3b82f6', weight: 'bold' },
                xshift: 10
            });

            annotationList.push({
                x: lastX,
                y: lastYCompleted,
                text: `<b>Completed (${lastYCompleted})</b>`,
                xanchor: 'left',
                yanchor: 'middle',
                showarrow: false,
                font: { size: 14, color: '#16a34a', weight: 'bold' },
                xshift: 10
            });
        }

        return {
            traces: traceList,
            annotations: annotationList,
            sortedPrettyDates: allDateStrs,
            allDateObjs,
            totalPlanned: cumPlanned,
            totalCompleted: cumCompleted
        };
    }, [filtered, categoryName]);

    useEffect(() => {
        if (!scrollContainerRef.current || allDateObjs.length === 0) return;
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const past10 = new Date(today);
        past10.setDate(today.getDate() - 10);

        let targetIdx = 0;
        let minDiff = Infinity;

        allDateObjs.forEach((dItem, idx) => {
            const diff = Math.abs(dItem.dateObj.getTime() - past10.getTime());
            if (diff < minDiff) {
                minDiff = diff;
                targetIdx = idx;
            }
        });

        const total = allDateObjs.length;
        if (total > 0 && scrollContainerRef.current) {
            const container = scrollContainerRef.current;
            const scrollWidth = container.scrollWidth;
            const clientWidth = container.clientWidth;
            const maxScroll = scrollWidth - clientWidth;
            if (maxScroll > 0) {
                const targetRatio = targetIdx / total;
                container.scrollLeft = Math.min(maxScroll, Math.max(0, targetRatio * scrollWidth));
            }
        }
    }, [allDateObjs]);

    const chartWidth = Math.max(1200, sortedPrettyDates.length * 85);
    const completionPct = totalPlanned > 0 ? ((totalCompleted / totalPlanned) * 100).toFixed(1) : '100.0';

    return (
        <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            padding: '1.5rem',
            boxShadow: '0 4px 15px rgba(0,0,0,0.05)',
            marginBottom: '2.5rem'
        }}>
            <div style={{ marginBottom: '1rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.75rem' }}>
                <h3 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 800, color: '#1e293b' }}>
                    {versionTitle} Planned vs Completed — {categoryName}
                </h3>
                <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
                    Cumulative Daily Production (Planned) vs Cumulative Completed for {categoryName}
                </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.25rem', marginBottom: '1.5rem' }}>
                <div style={{
                    backgroundColor: '#eff6ff',
                    border: '1px solid #bfdbfe',
                    borderRadius: '10px',
                    padding: '1.1rem 1.4rem'
                }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#1d4ed8', textTransform: 'uppercase' }}>
                        Total Planned
                    </span>
                    <span style={{ fontSize: '2.2rem', fontWeight: 900, color: '#3b82f6', marginTop: '0.2rem', display: 'block' }}>
                        {totalPlanned.toLocaleString()}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: '#3b82f6', fontWeight: 600 }}>
                        Cumulative Daily Production Goal
                    </span>
                </div>

                <div style={{
                    backgroundColor: '#f0fdf4',
                    border: '1px solid #bbf7d0',
                    borderRadius: '10px',
                    padding: '1.1rem 1.4rem'
                }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#15803d', textTransform: 'uppercase' }}>
                        Total Completed
                    </span>
                    <span style={{ fontSize: '2.2rem', fontWeight: 900, color: '#16a34a', marginTop: '0.2rem', display: 'block' }}>
                        {totalCompleted.toLocaleString()}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: '#16a34a', fontWeight: 600 }}>
                        Cumulative Actual Output
                    </span>
                </div>

                <div style={{
                    backgroundColor: '#faf5ff',
                    border: '1px solid #e9d5ff',
                    borderRadius: '10px',
                    padding: '1.1rem 1.4rem'
                }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#7e22ce', textTransform: 'uppercase' }}>
                        Completion Rate
                    </span>
                    <span style={{ fontSize: '2.2rem', fontWeight: 900, color: '#9333ea', marginTop: '0.2rem', display: 'block' }}>
                        {completionPct}%
                    </span>
                    <span style={{ fontSize: '0.75rem', color: '#9333ea', fontWeight: 600 }}>
                        Completed / Planned
                    </span>
                </div>
            </div>

            {traces.length === 0 ? (
                <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
                    No {categoryName} production records found for {versionTitle}.
                </div>
            ) : (
                <div ref={scrollContainerRef} style={{ width: '100%', overflowX: 'auto', paddingBottom: '0.5rem' }}>
                    <div style={{ width: `${chartWidth}px`, height: 'clamp(480px, 60vh, 680px)' }}>
                        <Plot
                            data={traces}
                            layout={{
                                autosize: true,
                                margin: { t: 40, b: 130, l: 80, r: 180 },
                                xaxis: {
                                    title: { text: 'Day', font: { size: 15, color: '#1e293b' } },
                                    type: 'category',
                                    categoryorder: 'array',
                                    categoryarray: sortedPrettyDates,
                                    tickfont: { size: 13, color: '#0f172a' },
                                    tickangle: -45,
                                    automargin: true
                                },
                                yaxis: {
                                    title: { text: 'Units', font: { size: 15, color: '#1e293b' } },
                                    tickfont: { size: 14, color: '#0f172a' },
                                    gridcolor: '#f1f5f9',
                                    // Extra headroom so the top (Planned) and bottom (Completed)
                                    // labels always have clear space and never get clipped.
                                    range: [
                                        -(Math.max(totalPlanned, totalCompleted) * 0.12 || 5),
                                        Math.max(totalPlanned, totalCompleted) * 1.15 || 10
                                    ]
                                },
                                legend: { orientation: 'h', x: 0, y: 1.12, font: { size: 15, color: '#0f172a' } },
                                annotations: annotations,
                                plot_bgcolor: '#ffffff',
                                paper_bgcolor: '#ffffff'
                            }}
                            useResizeHandler={true}
                            style={{ width: '100%', height: '100%' }}
                            config={{ displayModeBar: false }}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}

// ----------------------------------------------------------------------
// Non-cumulative Daily Active Alignment Planned vs Completed & Avg UPD Chart
// ----------------------------------------------------------------------
function ActiveAlignmentDailyChart({
    records,
    versionTitle
}: {
    records: ProductionProgressRecord[];
    versionTitle: 'V1' | 'V2';
}) {
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    const filtered = useMemo(() => {
        return records.filter(r => {
            const cust = String(r['Customer Name'] || '').toLowerCase();
            const cat = String(r['Data category'] || '').toLowerCase();
            return cust.includes(versionTitle.toLowerCase()) && (cat.includes('active') || cat.includes('alignment') || cat === 'aa');
        });
    }, [records, versionTitle]);

    const { traces, annotations, sortedPrettyDates, allDateObjs, avgUPD, peakDaily, activeDaysCount, maxDailyValue } = useMemo(() => {
        const dateMap = new Map<string, { dateStr: string; dateObj: Date; timestamp: number }>();

        filtered.forEach(r => {
            const dayStr = String(r['Day'] || '');
            const dObj = parseDayDate(dayStr);
            if (dObj) {
                const formatted = formatDayPrettyUpper(dObj);
                if (!dateMap.has(formatted)) {
                    dateMap.set(formatted, { dateStr: formatted, dateObj: dObj, timestamp: dObj.getTime() });
                }
            }
        });

        const allDateObjs = Array.from(dateMap.values()).sort((a, b) => a.timestamp - b.timestamp);
        const allDateStrs = allDateObjs.map(d => d.dateStr);

        const dayPlannedMap = new Map<string, number>();
        const dayCompletedMap = new Map<string, number>();

        let totalCompletedSum = 0;
        let activeDaysCount = 0;
        let peakDaily = 0;

        filtered.forEach(r => {
            const dayStr = String(r['Day'] || '');
            const dObj = parseDayDate(dayStr);
            if (dObj) {
                const formatted = formatDayPrettyUpper(dObj);
                const planned = Number(r['Daily Production']) || 0;
                const completed = Number(r['completed']) || 0;

                dayPlannedMap.set(formatted, (dayPlannedMap.get(formatted) || 0) + planned);
                dayCompletedMap.set(formatted, (dayCompletedMap.get(formatted) || 0) + completed);
            }
        });

        const traceX: string[] = [];
        const traceDailyPlanned: number[] = [];
        const traceDailyCompleted: number[] = [];

        const traceTextPlanned: string[] = [];
        const traceTextCompleted: string[] = [];

        allDateObjs.forEach(dItem => {
            const pVal = dayPlannedMap.get(dItem.dateStr) || 0;
            const cVal = dayCompletedMap.get(dItem.dateStr) || 0;

            if (dayPlannedMap.has(dItem.dateStr) || dayCompletedMap.has(dItem.dateStr)) {
                traceX.push(dItem.dateStr);
                traceDailyPlanned.push(pVal);
                traceDailyCompleted.push(cVal);

                if (cVal > 0) {
                    totalCompletedSum += cVal;
                    activeDaysCount += 1;
                    if (cVal > peakDaily) peakDaily = cVal;
                }

                traceTextPlanned.push(pVal > 0 ? `${pVal}` : '');
                traceTextCompleted.push(cVal > 0 ? `${cVal}` : '');
            }
        });

        const avgUPD = activeDaysCount > 0 ? Math.round(totalCompletedSum / activeDaysCount) : 0;
        const maxDailyValue = Math.max(0, ...traceDailyPlanned, ...traceDailyCompleted);

        const traceList: any[] = [];
        const annotationList: any[] = [];

        if (traceX.length > 0) {
            traceList.push({
                x: traceX,
                y: traceDailyPlanned,
                name: 'Daily Planned',
                mode: 'lines+markers+text',
                text: traceTextPlanned,
                textposition: 'top center',
                textfont: { size: 14, color: '#6366f1', weight: 'bold' },
                marker: { size: 7, color: '#6366f1' },
                line: { shape: 'spline', width: 2.5, color: '#6366f1', dash: 'dash' },
                connectgaps: true,
                hoverinfo: 'x+name+y'
            });

            traceList.push({
                x: traceX,
                y: traceDailyCompleted,
                name: 'Daily Completed',
                mode: 'lines+markers+text',
                text: traceTextCompleted,
                // Placed below its own point (Daily Planned stays above) so the
                // two labels never stack on top of each other.
                textposition: 'bottom center',
                textfont: { size: 14, color: '#059669', weight: 'bold' },
                marker: { size: 8, color: '#059669' },
                line: { shape: 'spline', width: 3, color: '#059669' },
                connectgaps: true,
                hoverinfo: 'x+name+y'
            });

            traceList.push({
                x: traceX,
                y: Array(traceX.length).fill(avgUPD),
                name: `Average UPD (${avgUPD})`,
                mode: 'lines',
                line: { width: 2.5, color: '#dc2626', dash: 'dashdot' },
                hoverinfo: 'name+y'
            });

            const lastX = traceX[traceX.length - 1];
            annotationList.push({
                x: lastX,
                y: avgUPD,
                text: `<b>Avg UPD: ${avgUPD}</b>`,
                xanchor: 'left',
                yanchor: 'middle',
                showarrow: false,
                font: { size: 14, color: '#dc2626', weight: 'bold' },
                xshift: 10
            });
        }

        return {
            traces: traceList,
            annotations: annotationList,
            sortedPrettyDates: allDateStrs,
            allDateObjs,
            avgUPD,
            peakDaily,
            activeDaysCount,
            maxDailyValue
        };
    }, [filtered]);

    useEffect(() => {
        if (!scrollContainerRef.current || allDateObjs.length === 0) return;
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const past10 = new Date(today);
        past10.setDate(today.getDate() - 10);

        let targetIdx = 0;
        let minDiff = Infinity;

        allDateObjs.forEach((dItem, idx) => {
            const diff = Math.abs(dItem.dateObj.getTime() - past10.getTime());
            if (diff < minDiff) {
                minDiff = diff;
                targetIdx = idx;
            }
        });

        const total = allDateObjs.length;
        if (total > 0 && scrollContainerRef.current) {
            const container = scrollContainerRef.current;
            const scrollWidth = container.scrollWidth;
            const clientWidth = container.clientWidth;
            const maxScroll = scrollWidth - clientWidth;
            if (maxScroll > 0) {
                const targetRatio = targetIdx / total;
                container.scrollLeft = Math.min(maxScroll, Math.max(0, targetRatio * scrollWidth));
            }
        }
    }, [allDateObjs]);

    const chartWidth = Math.max(1200, sortedPrettyDates.length * 85);

    return (
        <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            padding: '1.5rem',
            boxShadow: '0 4px 15px rgba(0,0,0,0.05)',
            marginBottom: '3rem'
        }}>
            <div style={{ marginBottom: '1rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.75rem' }}>
                <h3 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 800, color: '#1e293b' }}>
                    {versionTitle} Daily Active Alignment (AA) — Planned vs Completed & Average UPD
                </h3>
                <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
                    Non-cumulative daily production comparing Daily Planned vs Daily Completed with static Average UPD line
                </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.25rem', marginBottom: '1.5rem' }}>
                <div style={{
                    backgroundColor: '#fef2f2',
                    border: '1px solid #fecaca',
                    borderRadius: '10px',
                    padding: '1.1rem 1.4rem'
                }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#991b1b', textTransform: 'uppercase' }}>
                        Average UPD (Active Alignment)
                    </span>
                    <span style={{ fontSize: '2.2rem', fontWeight: 900, color: '#dc2626', marginTop: '0.2rem', display: 'block' }}>
                        {avgUPD.toLocaleString()}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: '#dc2626', fontWeight: 600 }}>
                        Mean Completed Units per Active Day
                    </span>
                </div>

                <div style={{
                    backgroundColor: '#ecfdf5',
                    border: '1px solid #a7f3d0',
                    borderRadius: '10px',
                    padding: '1.1rem 1.4rem'
                }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#065f46', textTransform: 'uppercase' }}>
                        Peak Single-Day Output
                    </span>
                    <span style={{ fontSize: '2.2rem', fontWeight: 900, color: '#059669', marginTop: '0.2rem', display: 'block' }}>
                        {peakDaily.toLocaleString()}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: '#059669', fontWeight: 600 }}>
                        Maximum Completed in a Single Day
                    </span>
                </div>

                <div style={{
                    backgroundColor: '#f5f3ff',
                    border: '1px solid #ddd6fe',
                    borderRadius: '10px',
                    padding: '1.1rem 1.4rem'
                }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#5b21b6', textTransform: 'uppercase' }}>
                        Active Production Days
                    </span>
                    <span style={{ fontSize: '2.2rem', fontWeight: 900, color: '#7c3aed', marginTop: '0.2rem', display: 'block' }}>
                        {activeDaysCount} Days
                    </span>
                    <span style={{ fontSize: '0.75rem', color: '#7c3aed', fontWeight: 600 }}>
                        Days with Recorded Completed Units
                    </span>
                </div>
            </div>

            {traces.length === 0 ? (
                <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
                    No Active Alignment daily production records found for {versionTitle}.
                </div>
            ) : (
                <div ref={scrollContainerRef} style={{ width: '100%', overflowX: 'auto', paddingBottom: '0.5rem' }}>
                    <div style={{ width: `${chartWidth}px`, height: 'clamp(480px, 60vh, 680px)' }}>
                        <Plot
                            data={traces}
                            layout={{
                                autosize: true,
                                margin: { t: 40, b: 130, l: 80, r: 180 },
                                xaxis: {
                                    title: { text: 'Day', font: { size: 15, color: '#1e293b' } },
                                    type: 'category',
                                    categoryorder: 'array',
                                    categoryarray: sortedPrettyDates,
                                    tickfont: { size: 13, color: '#0f172a' },
                                    tickangle: -45,
                                    automargin: true
                                },
                                yaxis: {
                                    title: { text: 'Daily Units', font: { size: 15, color: '#1e293b' } },
                                    tickfont: { size: 14, color: '#0f172a' },
                                    gridcolor: '#f1f5f9',
                                    // Extra headroom so the top (Planned) and bottom (Completed)
                                    // labels always have clear space and never get clipped.
                                    range: [-(maxDailyValue * 0.18 || 5), maxDailyValue * 1.2 || 10]
                                },
                                legend: { orientation: 'h', x: 0, y: 1.12, font: { size: 15, color: '#0f172a' } },
                                annotations: annotations,
                                plot_bgcolor: '#ffffff',
                                paper_bgcolor: '#ffffff'
                            }}
                            useResizeHandler={true}
                            style={{ width: '100%', height: '100%' }}
                            config={{ displayModeBar: false }}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}

// ----------------------------------------------------------------------
// Main Dashboard Component
// ----------------------------------------------------------------------
export default function SymbTracker() {
    const navigate = useNavigate();
    const [records, setRecords] = useState<SymbRecord[]>([]);
    const [flagRules, setFlagRules] = useState<FlagMappingRule[]>([]);
    const [productionRecords, setProductionRecords] = useState<ProductionProgressRecord[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [fileDate, setFileDate] = useState<string>('');
    const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
    const [selectedFlag, setSelectedFlag] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
    const [activeSubTab, setActiveSubTab] = useState<'detailed' | 'v1_progress' | 'v2_progress'>('detailed');

    const fetchSymbData = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/admin/symb-tracker/data');
            if (res.ok) {
                const data = await res.json();
                const recs: SymbRecord[] = data.records || [];
                setRecords(recs);
                setFlagRules(data.flags || []);

                if (recs.length > 0 && recs[0].file_date) {
                    setFileDate(recs[0].file_date);
                }
            }

            // Fetch production progress data
            const prodRes = await fetch('/api/admin/symb-production-progress/data');
            if (prodRes.ok) {
                const prodData = await prodRes.json();
                setProductionRecords(prodData || []);
            }
        } catch (err) {
            console.error('Error fetching SYMB data:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSymbData();
    }, []);

    // Build lookup for flag rules by stage name
    const flagRulesMap = useMemo(() => {
        const map: Record<string, { red: string; green: string; yellow: string; blue: string }> = {};
        flagRules.forEach(rule => {
            if (rule['Regular Stage']) {
                const stageName = rule['Regular Stage'].trim();
                map[stageName] = {
                    red: rule.red || '-',
                    green: rule.green || '-',
                    yellow: rule.yellow || '-',
                    blue: rule.blue || '-'
                };
            }
        });
        return map;
    }, [flagRules]);

    // Format date string nicely (e.g. "04 January 2027")
    const formatDatePretty = (dateStr?: string) => {
        if (!dateStr) return '-';
        try {
            const d = new Date(dateStr);
            if (isNaN(d.getTime())) return dateStr;
            return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
        } catch {
            return dateStr;
        }
    };

    // Helper to get Month Year label from Committed Due date (e.g. "July 2026")
    const getMonthYearKey = (dateStr?: string) => {
        if (!dateStr) return 'Unspecified';
        try {
            const d = new Date(dateStr);
            if (isNaN(d.getTime())) return 'Unspecified';
            return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        } catch {
            return 'Unspecified';
        }
    };

    // Helper to get sortable year-month object
    const getSortableMonth = (dateStr?: string) => {
        if (!dateStr) return { key: 'Unspecified', year: 9999, monthIdx: 99, label: 'Unspecified' };
        try {
            const d = new Date(dateStr);
            if (isNaN(d.getTime())) return { key: 'Unspecified', year: 9999, monthIdx: 99, label: 'Unspecified' };
            const year = d.getFullYear();
            const monthIdx = d.getMonth();
            const label = d.toLocaleDateString('en-US', { month: 'long' });
            return {
                key: `${label} ${year}`,
                year,
                monthIdx,
                label: `${label}\n${year}`
            };
        } catch {
            return { key: 'Unspecified', year: 9999, monthIdx: 99, label: 'Unspecified' };
        }
    };

    // Compute chart data grouped by Month & Flag
    const { chartMonths, flagData, monthTotals } = useMemo(() => {
        const monthMap = new Map<string, { year: number; monthIdx: number; key: string; displayLabel: string }>();

        records.forEach(rec => {
            const cdd = rec['Committed Due date'];
            const info = getSortableMonth(cdd);
            if (!monthMap.has(info.key)) {
                monthMap.set(info.key, {
                    year: info.year,
                    monthIdx: info.monthIdx,
                    key: info.key,
                    displayLabel: info.key
                });
            }
        });

        const sortedMonths = Array.from(monthMap.values()).sort((a, b) => {
            if (a.year !== b.year) return a.year - b.year;
            return a.monthIdx - b.monthIdx;
        });

        const monthKeys = sortedMonths.map(m => m.key);

        // Group unique SO numbers by month and flag
        const monthFlagSoSets: Record<string, Record<string, Set<string>>> = {};
        const monthAllSoSets: Record<string, Set<string>> = {};

        monthKeys.forEach(m => {
            monthFlagSoSets[m] = {
                green: new Set(),
                red: new Set(),
                yellow: new Set(),
                blue: new Set()
            };
            monthAllSoSets[m] = new Set();
        });

        records.forEach(rec => {
            const mKey = getMonthYearKey(rec['Committed Due date']);
            const flag = (rec.new_flag_algo || 'green').toLowerCase();
            const soNum = (rec['SO Number'] || rec['SO NUMBER'] || rec['SO_Number'] || rec['Record Id'] || '').trim();

            if (!soNum) return;

            if (!monthFlagSoSets[mKey]) {
                monthFlagSoSets[mKey] = {
                    green: new Set(),
                    red: new Set(),
                    yellow: new Set(),
                    blue: new Set()
                };
                monthAllSoSets[mKey] = new Set();
            }

            if (!monthFlagSoSets[mKey][flag]) {
                monthFlagSoSets[mKey][flag] = new Set();
            }

            monthFlagSoSets[mKey][flag].add(soNum);
            monthAllSoSets[mKey].add(soNum);
        });

        const counts: Record<string, Record<string, number>> = {};
        const totals: Record<string, number> = {};

        monthKeys.forEach(m => {
            counts[m] = {
                green: monthFlagSoSets[m]?.green.size || 0,
                red: monthFlagSoSets[m]?.red.size || 0,
                yellow: monthFlagSoSets[m]?.yellow.size || 0,
                blue: monthFlagSoSets[m]?.blue.size || 0,
            };
            totals[m] = monthAllSoSets[m]?.size || 0;
        });

        return {
            chartMonths: monthKeys,
            flagData: counts,
            monthTotals: totals
        };
    }, [records]);

    // Plotly traces configuration
    const plotlyTraces = useMemo(() => {
        const flagsList: Array<{ name: string; key: string; color: string }> = [
            { name: 'green', key: 'green', color: '#52b788' },
            { name: 'red', key: 'red', color: '#e63946' },
            { name: 'yellow', key: 'yellow', color: '#f5ad42' },
            { name: 'blue', key: 'blue', color: '#3b82f6' }
        ];

        return flagsList.map(flag => {
            const yValues = chartMonths.map(m => flagData[m]?.[flag.key] || 0);
            const textLabels = yValues.map(val => val > 0 ? `${val}` : '');

            return {
                x: chartMonths,
                y: yValues,
                name: flag.name,
                type: 'bar' as const,
                marker: { color: flag.color },
                text: textLabels,
                textposition: 'inside' as const,
                insidetextfont: { color: 'white', size: 22 },
                hoverinfo: 'x+y+name' as const
            };
        });
    }, [chartMonths, flagData]);

    // Total annotations above stacked bars
    const totalAnnotations = useMemo(() => {
        return chartMonths.map(m => ({
            x: m,
            y: monthTotals[m] || 0,
            text: `<b>${monthTotals[m] || 0}</b>`,
            xanchor: 'center' as const,
            yanchor: 'bottom' as const,
            showarrow: false,
            font: { size: 22, color: '#1e293b' }
        }));
    }, [chartMonths, monthTotals]);

    // Filtered records for table view
    const filteredRecords = useMemo(() => {
        return records.filter(rec => {
            if (selectedMonth) {
                const recMonth = getMonthYearKey(rec['Committed Due date']);
                if (recMonth !== selectedMonth) return false;
            }

            if (selectedFlag) {
                const recFlag = (rec.new_flag_algo || 'green').toLowerCase();
                if (recFlag !== selectedFlag.toLowerCase()) return false;
            }

            if (searchTerm.trim()) {
                const term = searchTerm.toLowerCase();
                const soNum = (rec['SO Number'] || rec['SO NUMBER'] || '').toLowerCase();
                const stage = (rec['n-reg_stage'] || rec['Regular-Product Stage'] || '').toLowerCase();
                const who = (rec.who || '').toLowerCase();

                if (!soNum.includes(term) && !stage.includes(term) && !who.includes(term)) {
                    return false;
                }
            }

            return true;
        });
    }, [records, selectedMonth, selectedFlag, searchTerm]);

    // Total quantity sum
    const totalQuantity = useMemo(() => {
        return filteredRecords.reduce((sum, r) => {
            const qty = Number(r.Quantity) || 0;
            return sum + qty;
        }, 0);
    }, [filteredRecords]);

    const handlePlotClick = (data: any) => {
        if (data && data.points && data.points.length > 0) {
            const point = data.points[0];
            const month = point.x;
            const flag = point.data.name;
            setSelectedMonth(month);
            setSelectedFlag(flag);
            setIsModalOpen(true);
        }
    };

    const todayStr = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

    return (
        <div style={{
            minHeight: '100vh',
            backgroundColor: '#f8fafc',
            color: '#0f172a',
            fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
            padding: '1.5rem 2rem'
        }}>
            {/* Top Navigation & Header */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: '#ffffff',
                padding: '1.2rem 2rem',
                borderRadius: '12px',
                boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
                marginBottom: '1.5rem',
                borderLeft: '8px solid #f5ad42'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <button
                        onClick={() => navigate('/')}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.4rem',
                            backgroundColor: '#f1f5f9',
                            color: '#475569',
                            border: '1px solid #cbd5e1',
                            padding: '0.5rem 1rem',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontWeight: 600,
                            fontSize: '0.9rem'
                        }}
                    >
                        <ArrowLeft size={16} /> Home
                    </button>
                    <div>
                        <h1 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 800, color: '#1e293b' }}>
                            Current Flag Status for Symbotic orders
                        </h1>
                        <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
                            SYMB Sales Orders Tracking & Production Progress Dashboard
                        </span>
                    </div>
                </div>

                {/* Right End Date Pills */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{
                        backgroundColor: '#fef3c7',
                        color: '#92400e',
                        border: '1px solid #fcd34d',
                        padding: '0.4rem 0.9rem',
                        borderRadius: '20px',
                        fontSize: '0.85rem',
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem'
                    }}>
                        📅 Today: {todayStr}
                    </div>

                    {fileDate && (
                        <div style={{
                            backgroundColor: '#e0f2fe',
                            color: '#0369a1',
                            border: '1px solid #7dd3fc',
                            padding: '0.4rem 0.9rem',
                            borderRadius: '20px',
                            fontSize: '0.85rem',
                            fontWeight: 700
                        }}>
                            📁 File Date: {fileDate}
                        </div>
                    )}

                    <button
                        onClick={fetchSymbData}
                        style={{
                            backgroundColor: '#f1f5f9',
                            color: '#0f172a',
                            border: '1px solid #cbd5e1',
                            borderRadius: '50%',
                            width: '36px',
                            height: '36px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer'
                        }}
                        title="Refresh Data"
                    >
                        <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {loading ? (
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '400px',
                    backgroundColor: '#ffffff',
                    borderRadius: '12px',
                    boxShadow: '0 4px 6px rgba(0,0,0,0.05)'
                }}>
                    <RefreshCw size={36} className="animate-spin" style={{ color: '#f5ad42', marginBottom: '1rem' }} />
                    <span style={{ fontSize: '1.1rem', fontWeight: 600, color: '#475569' }}>
                        Loading SYMB Tracker Dashboard Data...
                    </span>
                </div>
            ) : (
                <>
                    {/* Main Stacked Bar Chart Card */}
                    <div style={{
                        backgroundColor: '#ffffff',
                        borderRadius: '12px',
                        padding: '1.5rem',
                        boxShadow: '0 4px 15px rgba(0,0,0,0.05)',
                        marginBottom: '2rem',
                        border: '1px solid #e2e8f0'
                    }}>
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: '1rem',
                            paddingBottom: '0.75rem',
                            borderBottom: '1px solid #f1f5f9'
                        }}>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700, color: '#1e293b' }}>
                                    Current Flag Status for Symbotic orders
                                </h3>
                                <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
                                    Click any bar segment to filter detailed records
                                </span>
                            </div>

                            {/* Active Selection Indicator & Clear Button */}
                            {(selectedMonth || selectedFlag) && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                                    <span style={{
                                        backgroundColor: '#eff6ff',
                                        color: '#1d4ed8',
                                        padding: '0.4rem 0.8rem',
                                        borderRadius: '6px',
                                        fontSize: '0.85rem',
                                        fontWeight: 600,
                                        border: '1px solid #bfdbfe'
                                    }}>
                                        Selected: {selectedMonth || 'All Months'} {selectedFlag ? `(${selectedFlag.toUpperCase()})` : ''}
                                    </span>
                                    <button
                                        onClick={() => { setSelectedMonth(null); setSelectedFlag(null); }}
                                        style={{
                                            backgroundColor: '#fef2f2',
                                            color: '#ef4444',
                                            border: '1px solid #fca5a5',
                                            padding: '0.35rem 0.75rem',
                                            borderRadius: '6px',
                                            cursor: 'pointer',
                                            fontWeight: 600,
                                            fontSize: '0.85rem',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.3rem'
                                        }}
                                    >
                                        <X size={14} /> Clear Selection
                                    </button>

                                    <button
                                        onClick={() => setIsModalOpen(true)}
                                        style={{
                                            backgroundColor: '#f5ad42',
                                            color: '#000000',
                                            border: 'none',
                                            padding: '0.4rem 1rem',
                                            borderRadius: '6px',
                                            cursor: 'pointer',
                                            fontWeight: 700,
                                            fontSize: '0.85rem',
                                            boxShadow: '0 2px 5px rgba(245,173,66,0.3)'
                                        }}
                                    >
                                        🔍 View Detailed Data ({filteredRecords.length})
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Plotly Stacked Bar Chart */}
                        <div style={{ width: '100%', height: '540px' }}>
                            <Plot
                                data={plotlyTraces}
                                layout={{
                                    barmode: 'stack',
                                    autosize: true,
                                    margin: { t: 50, b: 80, l: 80, r: 40 },
                                    xaxis: {
                                        title: { text: 'Month', font: { size: 18, color: '#1e293b' } },
                                        type: 'category',
                                        tickfont: { size: 16, color: '#0f172a' }
                                    },
                                    yaxis: {
                                        title: { text: 'Count of SO Number', font: { size: 18, color: '#1e293b' } },
                                        tickfont: { size: 16, color: '#0f172a' },
                                        gridcolor: '#e2e8f0'
                                    },
                                    legend: {
                                        orientation: 'h',
                                        x: 0,
                                        y: 1.15,
                                        font: { size: 18, color: '#0f172a' }
                                    },
                                    annotations: totalAnnotations,
                                    hovermode: 'closest',
                                    plot_bgcolor: '#ffffff',
                                    paper_bgcolor: '#ffffff'
                                }}
                                useResizeHandler={true}
                                style={{ width: '100%', height: '100%' }}
                                config={{ displayModeBar: false }}
                                onClick={handlePlotClick}
                            />
                        </div>
                    </div>

                    {/* Sub-Tab Navigation Bar */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        marginBottom: '0',
                        backgroundColor: '#f1f5f9',
                        padding: '0.5rem 0.5rem 0 0.5rem',
                        borderRadius: '12px 12px 0 0',
                        border: '1px solid #e2e8f0',
                        borderBottom: 'none'
                    }}>
                        <button
                            onClick={() => setActiveSubTab('detailed')}
                            style={{
                                padding: '0.75rem 1.5rem',
                                fontSize: '0.95rem',
                                fontWeight: 700,
                                border: 'none',
                                borderBottom: activeSubTab === 'detailed' ? '3px solid #f5ad42' : '3px solid transparent',
                                backgroundColor: activeSubTab === 'detailed' ? '#ffffff' : 'transparent',
                                color: activeSubTab === 'detailed' ? '#1e293b' : '#64748b',
                                cursor: 'pointer',
                                borderRadius: '8px 8px 0 0',
                                transition: 'all 0.2s ease',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem'
                            }}
                        >
                            <Table size={18} style={{ color: activeSubTab === 'detailed' ? '#f5ad42' : '#64748b' }} />
                            Detailed Sales Orders Table
                        </button>

                        <button
                            onClick={() => setActiveSubTab('v1_progress')}
                            style={{
                                padding: '0.75rem 1.5rem',
                                fontSize: '0.95rem',
                                fontWeight: 700,
                                border: 'none',
                                borderBottom: activeSubTab === 'v1_progress' ? '3px solid #f5ad42' : '3px solid transparent',
                                backgroundColor: activeSubTab === 'v1_progress' ? '#ffffff' : 'transparent',
                                color: activeSubTab === 'v1_progress' ? '#1e293b' : '#64748b',
                                cursor: 'pointer',
                                borderRadius: '8px 8px 0 0',
                                transition: 'all 0.2s ease',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem'
                            }}
                        >
                            <Activity size={18} style={{ color: activeSubTab === 'v1_progress' ? '#f5ad42' : '#64748b' }} />
                            ⚡ V1 Progress
                        </button>

                        <button
                            onClick={() => setActiveSubTab('v2_progress')}
                            style={{
                                padding: '0.75rem 1.5rem',
                                fontSize: '0.95rem',
                                fontWeight: 700,
                                border: 'none',
                                borderBottom: activeSubTab === 'v2_progress' ? '3px solid #f5ad42' : '3px solid transparent',
                                backgroundColor: activeSubTab === 'v2_progress' ? '#ffffff' : 'transparent',
                                color: activeSubTab === 'v2_progress' ? '#1e293b' : '#64748b',
                                cursor: 'pointer',
                                borderRadius: '8px 8px 0 0',
                                transition: 'all 0.2s ease',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem'
                            }}
                        >
                            <Activity size={18} style={{ color: activeSubTab === 'v2_progress' ? '#f5ad42' : '#64748b' }} />
                            ⚡ V2 Progress
                        </button>
                    </div>

                    {/* Sub-Tab 1: Detailed Sales Orders Table */}
                    {activeSubTab === 'detailed' && (
                        <>
                            <div style={{
                                backgroundColor: '#ffffff',
                                padding: '1.25rem 1.5rem',
                                boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
                                border: '1px solid #e2e8f0',
                                borderTop: 'none',
                                borderBottom: 'none',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    <Table size={20} style={{ color: '#f5ad42' }} />
                                    <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: '#1e293b' }}>
                                        Detailed Sales Orders Table
                                    </h3>
                                    <span style={{
                                        backgroundColor: '#f1f5f9',
                                        color: '#475569',
                                        padding: '0.2rem 0.6rem',
                                        borderRadius: '12px',
                                        fontSize: '0.8rem',
                                        fontWeight: 700
                                    }}>
                                        {filteredRecords.length} records
                                    </span>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                    <div style={{ position: 'relative' }}>
                                        <input
                                            type="text"
                                            placeholder="Search SO Number, Stage, Who..."
                                            value={searchTerm}
                                            onChange={e => setSearchTerm(e.target.value)}
                                            style={{
                                                padding: '0.45rem 1rem',
                                                borderRadius: '6px',
                                                border: '1px solid #cbd5e1',
                                                fontSize: '0.85rem',
                                                width: '240px',
                                                outline: 'none'
                                            }}
                                        />
                                        {searchTerm && (
                                            <button
                                                onClick={() => setSearchTerm('')}
                                                style={{
                                                    position: 'absolute',
                                                    right: '8px',
                                                    top: '50%',
                                                    transform: 'translateY(-50%)',
                                                    background: 'none',
                                                    border: 'none',
                                                    cursor: 'pointer',
                                                    color: '#94a3b8'
                                                }}
                                            >
                                                <X size={14} />
                                            </button>
                                        )}
                                    </div>

                                    <div style={{ display: 'flex', gap: '0.3rem' }}>
                                        {['All', 'green', 'red', 'yellow', 'blue'].map(flag => {
                                            const isActive = (flag === 'All' && !selectedFlag) || (selectedFlag && selectedFlag.toLowerCase() === flag.toLowerCase());
                                            return (
                                                <button
                                                    key={flag}
                                                    onClick={() => setSelectedFlag(flag === 'All' ? null : flag)}
                                                    style={{
                                                        padding: '0.35rem 0.7rem',
                                                        borderRadius: '6px',
                                                        fontSize: '0.8rem',
                                                        fontWeight: 700,
                                                        cursor: 'pointer',
                                                        border: isActive ? '2px solid #000' : '1px solid #e2e8f0',
                                                        backgroundColor: flag === 'green' ? '#dcfce7' : flag === 'red' ? '#fee2e2' : flag === 'yellow' ? '#fef3c7' : flag === 'blue' ? '#dbeafe' : '#f1f5f9',
                                                        color: flag === 'green' ? '#166534' : flag === 'red' ? '#991b1b' : flag === 'yellow' ? '#92400e' : flag === 'blue' ? '#1e40af' : '#334155'
                                                    }}
                                                >
                                                    {flag.toUpperCase()}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>

                            <div style={{
                                backgroundColor: '#ffffff',
                                borderRadius: '0 0 12px 12px',
                                border: '1px solid #e2e8f0',
                                boxShadow: '0 4px 15px rgba(0,0,0,0.05)',
                                overflowX: 'auto',
                                marginBottom: '3rem'
                            }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                                    <thead>
                                        <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0', color: '#475569' }}>
                                            <th style={{ padding: '0.85rem 1rem', fontWeight: 700 }}>SO Number</th>
                                            <th style={{ padding: '0.85rem 1rem', fontWeight: 700 }}>Customer Request date</th>
                                            <th style={{ padding: '0.85rem 1rem', fontWeight: 700 }}>Committed Due date</th>
                                            <th style={{ padding: '0.85rem 1rem', fontWeight: 700, textAlign: 'right' }}>Quantity</th>
                                            <th style={{ padding: '0.85rem 1rem', fontWeight: 700 }}>Regular-Product Stage</th>
                                            <th style={{ padding: '0.85rem 1rem', fontWeight: 700 }}>who</th>
                                            <th style={{ padding: '0.85rem 1rem', fontWeight: 700, textAlign: 'right' }}>week_diff</th>
                                            <th style={{ padding: '0.85rem 1rem', fontWeight: 700, textAlign: 'center' }}>new_flag_algo</th>
                                            <th style={{ padding: '0.85rem 1rem', fontWeight: 700 }}>red</th>
                                            <th style={{ padding: '0.85rem 1rem', fontWeight: 700 }}>green</th>
                                            <th style={{ padding: '0.85rem 1rem', fontWeight: 700 }}>recovery stage</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredRecords.map((row, idx) => {
                                            const stage = row['n-reg_stage'] || row['Regular-Product Stage'] || '';
                                            const rules = flagRulesMap[stage.trim()] || { red: '-', green: '-' };
                                            const flagColor = (row.new_flag_algo || 'green').toLowerCase();
                                            const soNumber = row['SO Number'] || row['SO NUMBER'] || row['SO_Number'] || '-';

                                            return (
                                                <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: idx % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                                                    <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#1e293b' }}>{soNumber}</td>
                                                    <td style={{ padding: '0.75rem 1rem', color: '#334155' }}>{formatDatePretty(row['Customer Request date'])}</td>
                                                    <td style={{ padding: '0.75rem 1rem', color: '#334155' }}>{formatDatePretty(row['Committed Due date'])}</td>
                                                    <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 600, color: '#0f172a' }}>{(Number(row.Quantity) || 0).toLocaleString()}</td>
                                                    <td style={{ padding: '0.75rem 1rem', color: '#334155' }}>{stage || '-'}</td>
                                                    <td style={{ padding: '0.75rem 1rem', color: '#475569' }}>{row.who || '-'}</td>
                                                    <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 600, color: '#334155' }}>{row.week_diff !== undefined && row.week_diff !== null ? row.week_diff : '-'}</td>
                                                    <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                                                        <span style={{
                                                            display: 'inline-block',
                                                            padding: '0.25rem 0.65rem',
                                                            borderRadius: '4px',
                                                            fontWeight: 700,
                                                            fontSize: '0.75rem',
                                                            backgroundColor: flagColor === 'green' ? '#52b788' : flagColor === 'red' ? '#e63946' : flagColor === 'yellow' ? '#f5ad42' : '#3b82f6',
                                                            color: '#ffffff'
                                                        }}>
                                                            {flagColor}
                                                        </span>
                                                    </td>
                                                    <td style={{ padding: '0.75rem 1rem', color: '#991b1b', backgroundColor: '#fee2e2', fontWeight: 600, fontSize: '0.8rem' }}>{rules.red}</td>
                                                    <td style={{ padding: '0.75rem 1rem', color: '#166534', backgroundColor: '#dcfce7', fontWeight: 600, fontSize: '0.8rem' }}>{rules.green}</td>
                                                    <td style={{ padding: '0.75rem 1rem', color: '#334155', fontWeight: 500 }}>{row['recovery stage'] || '-'}</td>
                                                </tr>
                                            );
                                        })}
                                        {filteredRecords.length === 0 && (
                                            <tr>
                                                <td colSpan={11} style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
                                                    No matching Sales Orders found for the selected filters.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                    {filteredRecords.length > 0 && (
                                        <tfoot>
                                            <tr style={{ backgroundColor: '#f1f5f9', borderTop: '2px solid #cbd5e1', fontWeight: 800, color: '#0f172a' }}>
                                                <td style={{ padding: '0.9rem 1rem' }}>Total</td>
                                                <td colSpan={2}></td>
                                                <td style={{ padding: '0.9rem 1rem', textAlign: 'right', fontSize: '0.95rem' }}>{totalQuantity.toLocaleString()}</td>
                                                <td colSpan={7}></td>
                                            </tr>
                                        </tfoot>
                                    )}
                                </table>
                            </div>
                        </>
                    )}

                    {/* Sub-Tab 2: V1 Progress Charts */}
                    {activeSubTab === 'v1_progress' && (
                        <>
                            {/* Main Overview Cumulative Progress Chart */}
                            <ProductionProgressChart records={productionRecords} versionTitle="V1" />

                            {/* 3 Planned vs Completed Category Cumulative Charts */}
                            <CategoryPlannedVsCompletedChart records={productionRecords} versionTitle="V1" categoryName="Active alignment" />
                            <CategoryPlannedVsCompletedChart records={productionRecords} versionTitle="V1" categoryName="AVLN PCBA" />
                            <CategoryPlannedVsCompletedChart records={productionRecords} versionTitle="V1" categoryName="Finished goods" />

                            {/* 4th Chart: Non-cumulative Daily Active Alignment with Avg UPD Line */}
                            <ActiveAlignmentDailyChart records={productionRecords} versionTitle="V1" />
                        </>
                    )}

                    {/* Sub-Tab 3: V2 Progress Charts */}
                    {activeSubTab === 'v2_progress' && (
                        <>
                            {/* Main Overview Cumulative Progress Chart */}
                            <ProductionProgressChart records={productionRecords} versionTitle="V2" />

                            {/* 3 Planned vs Completed Category Cumulative Charts */}
                            <CategoryPlannedVsCompletedChart records={productionRecords} versionTitle="V2" categoryName="Active alignment" />
                            <CategoryPlannedVsCompletedChart records={productionRecords} versionTitle="V2" categoryName="AVLN PCBA" />
                            <CategoryPlannedVsCompletedChart records={productionRecords} versionTitle="V2" categoryName="Finished goods" />

                            {/* 4th Chart: Non-cumulative Daily Active Alignment with Avg UPD Line */}
                            <ActiveAlignmentDailyChart records={productionRecords} versionTitle="V2" />
                        </>
                    )}
                </>
            )}

            {/* Modal for "View Detailed Data" */}
            {isModalOpen && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(15, 23, 42, 0.75)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 9999,
                    padding: '2rem'
                }}>
                    <div style={{
                        backgroundColor: '#ffffff',
                        borderRadius: '16px',
                        width: '95vw',
                        maxWidth: '95vw',
                        maxHeight: '92vh',
                        display: 'flex',
                        flexDirection: 'column',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                        overflow: 'hidden'
                    }}>
                        <div style={{
                            padding: '1.25rem 1.75rem',
                            backgroundColor: '#1e293b',
                            color: '#ffffff',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                        }}>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700, color: '#f5ad42' }}>
                                    Detailed Sales Orders Data
                                </h3>
                                <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
                                    Showing {filteredRecords.length} records for {selectedMonth || 'All Months'} {selectedFlag ? `(${selectedFlag.toUpperCase()})` : ''}
                                </span>
                            </div>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                style={{
                                    backgroundColor: 'rgba(255,255,255,0.1)',
                                    color: '#ffffff',
                                    border: 'none',
                                    borderRadius: '50%',
                                    width: '36px',
                                    height: '36px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer'
                                }}
                            >
                                <X size={20} />
                            </button>
                        </div>
                        <div style={{ padding: '1rem', overflowY: 'auto', flex: 1 }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.82rem' }}>
                                <thead>
                                    <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0', color: '#475569' }}>
                                        <th style={{ padding: '0.6rem 0.5rem', fontWeight: 700, whiteSpace: 'nowrap' }}>SO Number</th>
                                        <th style={{ padding: '0.6rem 0.5rem', fontWeight: 700, whiteSpace: 'nowrap' }}>Customer Request date</th>
                                        <th style={{ padding: '0.6rem 0.5rem', fontWeight: 700, whiteSpace: 'nowrap' }}>Committed Due date</th>
                                        <th style={{ padding: '0.6rem 0.5rem', fontWeight: 700, textAlign: 'right', whiteSpace: 'nowrap' }}>Quantity</th>
                                        <th style={{ padding: '0.6rem 0.5rem', fontWeight: 700, whiteSpace: 'nowrap' }}>Regular-Product Stage</th>
                                        <th style={{ padding: '0.6rem 0.5rem', fontWeight: 700, whiteSpace: 'nowrap' }}>who</th>
                                        <th style={{ padding: '0.6rem 0.5rem', fontWeight: 700, textAlign: 'right', whiteSpace: 'nowrap' }}>week_diff</th>
                                        <th style={{ padding: '0.6rem 0.5rem', fontWeight: 700, textAlign: 'center', whiteSpace: 'nowrap' }}>new_flag_algo</th>
                                        <th style={{ padding: '0.6rem 0.5rem', fontWeight: 700, whiteSpace: 'nowrap' }}>red</th>
                                        <th style={{ padding: '0.6rem 0.5rem', fontWeight: 700, whiteSpace: 'nowrap' }}>green</th>
                                        <th style={{ padding: '0.6rem 0.5rem', fontWeight: 700, whiteSpace: 'nowrap' }}>recovery stage</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredRecords.map((row, idx) => {
                                        const stage = row['n-reg_stage'] || row['Regular-Product Stage'] || '';
                                        const rules = flagRulesMap[stage.trim()] || { red: '-', green: '-' };
                                        const flagColor = (row.new_flag_algo || 'green').toLowerCase();

                                        return (
                                            <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: idx % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                                                <td style={{ padding: '0.5rem 0.5rem', fontWeight: 600, whiteSpace: 'nowrap' }}>{row['SO Number'] || row['SO NUMBER'] || '-'}</td>
                                                <td style={{ padding: '0.5rem 0.5rem', whiteSpace: 'nowrap' }}>{formatDatePretty(row['Customer Request date'])}</td>
                                                <td style={{ padding: '0.5rem 0.5rem', whiteSpace: 'nowrap' }}>{formatDatePretty(row['Committed Due date'])}</td>
                                                <td style={{ padding: '0.5rem 0.5rem', textAlign: 'right', fontWeight: 600 }}>{(Number(row.Quantity) || 0).toLocaleString()}</td>
                                                <td style={{ padding: '0.5rem 0.5rem' }}>{stage || '-'}</td>
                                                <td style={{ padding: '0.5rem 0.5rem', whiteSpace: 'nowrap' }}>{row.who || '-'}</td>
                                                <td style={{ padding: '0.5rem 0.5rem', textAlign: 'right', fontWeight: 600 }}>{row.week_diff !== undefined && row.week_diff !== null ? row.week_diff : '-'}</td>
                                                <td style={{ padding: '0.5rem 0.5rem', textAlign: 'center' }}>
                                                    <span style={{
                                                        display: 'inline-block',
                                                        padding: '0.15rem 0.5rem',
                                                        borderRadius: '4px',
                                                        fontWeight: 700,
                                                        fontSize: '0.75rem',
                                                        backgroundColor: flagColor === 'green' ? '#52b788' : flagColor === 'red' ? '#e63946' : flagColor === 'yellow' ? '#f5ad42' : '#3b82f6',
                                                        color: '#ffffff'
                                                    }}>
                                                        {flagColor}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '0.5rem 0.5rem', color: '#991b1b', backgroundColor: '#fee2e2', fontWeight: 600, fontSize: '0.78rem' }}>{rules.red}</td>
                                                <td style={{ padding: '0.5rem 0.5rem', color: '#166534', backgroundColor: '#dcfce7', fontWeight: 600, fontSize: '0.78rem' }}>{rules.green}</td>
                                                <td style={{ padding: '0.5rem 0.5rem', whiteSpace: 'nowrap' }}>{row['recovery stage'] || '-'}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                                <tfoot>
                                    <tr style={{ backgroundColor: '#f1f5f9', borderTop: '2px solid #cbd5e1', fontWeight: 800 }}>
                                        <td style={{ padding: '0.9rem 1rem' }}>Total</td>
                                        <td colSpan={2}></td>
                                        <td style={{ padding: '0.9rem 1rem', textAlign: 'right', fontSize: '0.95rem' }}>{totalQuantity.toLocaleString()}</td>
                                        <td colSpan={7}></td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
