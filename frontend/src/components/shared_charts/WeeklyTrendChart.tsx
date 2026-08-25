import { useEffect, useState, useRef } from 'react';
import Plot from 'react-plotly.js';
import Plotly from 'plotly.js-dist-min';

interface TrendChartProps {
    data: any;
    title: string;
    hideTargets?: boolean;
}

const formatMoney = (val?: number) => {
    if (!val || isNaN(val)) return '$0';
    if (val >= 1e6) return `$${(val / 1e6).toFixed(2)}M`;
    if (val >= 1e3) return `$${Math.round(val / 1e3)}K`;
    return `$${Math.round(val)}`;
};

export function WeeklyTrendChart({ data, title, hideTargets = false }: TrendChartProps) {
    const plotRef = useRef<any>(null);
    const [figData, setFigData] = useState<any[]>([]);
    const [figLayout, setFigLayout] = useState<any>({});
    const [figFrames, setFigFrames] = useState<any[]>([]);

    useEffect(() => {
        if (!data) return;

        const weeks = data.weeks || [];
        const po_achieved = data.po_achieved || [];
        const po_pipeline = data.po_pipeline || [];
        const stretch_target = data.stretch_target || 0;
        const styles = data.styles || {
            Stretch: { color: '#9d45eb', name: 'Target' },
            PO: { color: '#2563eb', name: 'Weekly Invoiced Amount' },
            Total: { color: '#10b981', name: 'Invoiced Amount' }
        };
        const annotations = data.annotations || [];

        const xNumeric = weeks.map((_: any, i: number) => i);
        const isInvoice = data.is_invoice || false;

        const validPoAchieved = po_achieved.filter((v: any) => typeof v === 'number' && !isNaN(v));
        const validPoPipeline = po_pipeline.filter((v: any) => typeof v === 'number' && !isNaN(v));

        const maxAchieved = validPoAchieved.length ? Math.max(...validPoAchieved) : 0;
        const maxPipeline = validPoPipeline.length ? Math.max(...validPoPipeline) : 0;

        // ── Stacked Subplots for Invoiced Amount Slides ─────────────────────
        if (isInvoice) {
            const avgWeekly = data.avg_weekly || (po_achieved.length ? po_achieved.reduce((a: number, b: number) => a + b, 0) / po_achieved.length : 0);
            const reqWeekly = data.required_weekly_avg || 0;

            const initialDataInvoice = [
                // Subplot 1 (Top): Cumulative Invoiced Amount (Green line)
                {
                    x: xNumeric,
                    y: po_pipeline,
                    mode: 'lines+markers',
                    marker: { size: 8, color: '#10b981' },
                    line: { color: '#10b981', width: 4 },
                    name: 'Cumulative Invoiced Amount',
                    type: 'scatter',
                    xaxis: 'x',
                    yaxis: 'y'
                },
                // Subplot 2 (Bottom): Weekly Invoiced Amount (Blue line)
                {
                    x: xNumeric,
                    y: po_achieved,
                    mode: 'lines+markers',
                    marker: { size: 8, color: '#2563eb' },
                    line: { color: '#2563eb', width: 4 },
                    name: 'Weekly Invoiced Amount',
                    type: 'scatter',
                    xaxis: 'x2',
                    yaxis: 'y2'
                },
                // Subplot 2 (Bottom): 8-Week Average Line (Orange Dotted line)
                {
                    x: xNumeric,
                    y: Array(weeks.length).fill(avgWeekly),
                    mode: 'lines',
                    line: { color: '#ea580c', width: 3, dash: 'dot' },
                    name: `8-Week Average (${formatMoney(avgWeekly)}/wk)`,
                    type: 'scatter',
                    xaxis: 'x2',
                    yaxis: 'y2'
                },
                // Subplot 2 (Bottom): Required Weekly Average Line (Purple Dashed line)
                {
                    x: xNumeric,
                    y: Array(weeks.length).fill(reqWeekly),
                    mode: 'lines',
                    line: { color: '#9d45eb', width: 3, dash: 'dash' },
                    name: `Required Wkly Avg (${formatMoney(reqWeekly)}/wk)`,
                    type: 'scatter',
                    xaxis: 'x2',
                    yaxis: 'y2'
                }
            ];

            setFigData(initialDataInvoice);
            setFigFrames([]);

            setFigLayout({
                autosize: true,
                title: {
                    text: title,
                    font: { size: 24, family: 'Helvetica', weight: 'bold' },
                    x: 0.5, xanchor: 'center'
                },
                grid: { rows: 2, columns: 1, pattern: 'independent' },
                xaxis: {
                    domain: [0, 1],
                    tickmode: 'array', tickvals: xNumeric, ticktext: weeks,
                    showticklabels: false,
                    showgrid: true, gridcolor: 'rgba(200,200,200,0.3)', zeroline: false,
                    range: [-0.5, 7.5],
                    showline: true, linewidth: 3, linecolor: '#d1d5db', mirror: true
                },
                yaxis: {
                    domain: [0.54, 1.0],
                    showticklabels: false, showgrid: true, gridcolor: 'rgba(200,200,200,0.3)', zeroline: false,
                    range: [0, (maxPipeline > 0 ? maxPipeline * 1.25 : 1000000)],
                    showline: true, linewidth: 3, linecolor: '#d1d5db', mirror: true
                },
                xaxis2: {
                    domain: [0, 1],
                    tickmode: 'array', tickvals: xNumeric, ticktext: weeks,
                    showticklabels: true,
                    showgrid: true, gridcolor: 'rgba(200,200,200,0.3)', zeroline: false,
                    range: [-0.5, 7.5],
                    showline: true, linewidth: 3, linecolor: '#d1d5db', mirror: true
                },
                yaxis2: {
                    domain: [0.0, 0.44],
                    showticklabels: false, showgrid: true, gridcolor: 'rgba(200,200,200,0.3)', zeroline: false,
                    range: [0, (maxAchieved > 0 ? Math.max(maxAchieved, avgWeekly) * 1.35 : 1000000)],
                    showline: true, linewidth: 3, linecolor: '#d1d5db', mirror: true
                },
                legend: {
                    x: 0.5, y: -0.15, xanchor: 'center', orientation: 'h',
                    bgcolor: 'rgba(255,255,255,0.9)', bordercolor: 'rgba(0,0,0,0.1)', borderwidth: 1,
                    font: { size: 12, family: 'Helvetica' }
                },
                margin: { l: 60, r: 60, t: 70, b: 80 },
                annotations: [
                    {
                        x: 0.01, y: 0.98, xref: 'paper', yref: 'paper',
                        text: '<b>CUMULATIVE INVOICED AMOUNT</b>',
                        showarrow: false,
                        font: { size: 18, color: '#047857', family: 'Helvetica, Arial, sans-serif' },
                        xanchor: 'left', yanchor: 'top'
                    },
                    {
                        x: 0.5, y: 0.49, xref: 'paper', yref: 'paper',
                        text: `<b>REQUIRED WEEKLY AVG TO INVOICE CLOSED WON PO (${formatMoney(data.closed_won_po_amount)}) BY MAR 31, 2027: <span style="color:#7e22ce; font-size:1.05rem;">${formatMoney(reqWeekly)}/wk</span></b>`,
                        showarrow: false,
                        font: { size: 13, color: '#4c1d95', family: 'Helvetica, Arial, sans-serif' },
                        bgcolor: 'rgba(243, 232, 255, 0.95)',
                        bordercolor: '#c084fc',
                        borderwidth: 1,
                        borderpad: 5,
                        xanchor: 'center', yanchor: 'middle'
                    },
                    {
                        x: 0.01, y: 0.42, xref: 'paper', yref: 'paper',
                        text: '<b>WEEKLY INVOICED AMOUNT</b>',
                        showarrow: false,
                        font: { size: 18, color: '#1d4ed8', family: 'Helvetica, Arial, sans-serif' },
                        xanchor: 'left', yanchor: 'top'
                    },
                    ...annotations
                ],
                font: { family: 'Helvetica, Arial, sans-serif' },
                template: 'plotly_white'
            });

            return;
        }

        // Initial Traces (Standard Weekly / Services mode)
        const initialData = [
            // Target Lines (full, dashed)
            {
                x: xNumeric, y: Array(8).fill(stretch_target), mode: 'lines',
                line: { color: styles.Stretch?.color || '#9d45eb', width: 5, dash: 'dash' },
                name: styles.Stretch?.name || 'Target', type: 'scatter'
            },
            // Animated Lines (start at point 0)
            {
                x: data.enable_animation === false ? xNumeric : [0], y: data.enable_animation === false ? po_achieved : [po_achieved[0] || 0], mode: 'lines+markers',
                marker: { size: 8, color: styles.PO?.color || '#2563eb' },
                line: { color: styles.PO?.color || '#2563eb', width: 5 },
                name: styles.PO?.name || 'Weekly Invoiced Amount', type: 'scatter',
                yaxis: isInvoice ? 'y2' : undefined
            },
            {
                x: data.enable_animation === false ? xNumeric : [0], y: data.enable_animation === false ? po_pipeline : [po_pipeline[0] || 0], mode: 'lines+markers',
                marker: { size: 8, color: styles.Total?.color || '#10b981' },
                line: { color: styles.Total?.color || '#10b981', width: 5 },
                name: styles.Total?.name || 'Invoiced Amount', type: 'scatter'
            }
        ];

        // Frame Generation
        const frames: any[] = [];
        const stepsPerSegment = 8;

        for (let i = 0; i < weeks.length - 1; i++) {
            for (let step = 1; step <= stepsPerSegment; step++) {
                const t = step / stepsPerSegment;
                const currentXTip = i + t;
                const frameX = [...xNumeric.slice(0, i + 1), currentXTip];

                const startPO = po_achieved[i] || 0;
                const endPO = po_achieved[i + 1] || 0;
                const currentPO = startPO + (endPO - startPO) * t;
                const framePO = [...po_achieved.slice(0, i + 1), currentPO];

                const startTotal = po_pipeline[i] || 0;
                const endTotal = po_pipeline[i + 1] || 0;
                const currentTotal = startTotal + (endTotal - startTotal) * t;
                const frameTotal = [...po_pipeline.slice(0, i + 1), currentTotal];

                const frameTraces = [
                    { x: xNumeric, y: Array(8).fill(stretch_target) },
                    { x: frameX, y: framePO, yaxis: isInvoice ? 'y2' : undefined },
                    { x: frameX, y: frameTotal }
                ];

                const currentAnnotations = annotations.filter((ann: any) => {
                    if (ann.type === 'dynamic') {
                        if (step === stepsPerSegment) return ann.week_idx <= i + 1;
                        return ann.week_idx <= i;
                    }
                    return true;
                });

                frames.push({
                    data: frameTraces,
                    layout: { annotations: currentAnnotations },
                    name: `frame_${i}_${step}`
                });
            }
        }

        // Services-only mode: drop the stretch target line trace + target annotations.
        const stretchColor = styles.Stretch?.color;
        const filterTargetAnnotations = (anns: any[]) => anns.filter((ann: any) => {
            if (!hideTargets) return true;
            return ann.font?.color !== stretchColor;
        });

        const finalInitialData = hideTargets ? initialData.slice(1) : initialData;
        const finalFrames = hideTargets
            ? frames.map((f: any) => ({
                ...f,
                data: f.data.slice(1),
                layout: { annotations: filterTargetAnnotations(f.layout?.annotations || []) },
            }))
            : frames;

        setFigData(finalInitialData);
        setFigFrames(finalFrames);

        const initialAnnotationsRaw = data.enable_animation === false ? annotations : annotations.filter((ann: any) => ann.type !== 'dynamic' || ann.week_idx === 0);
        const initialAnnotations = filterTargetAnnotations(initialAnnotationsRaw);

        const yMax = hideTargets ? Math.max(1, maxPipeline) : Math.max(stretch_target * 1.5, maxPipeline);

        setFigLayout({
            autosize: true,
            title: {
                text: title,
                font: { size: 24, family: 'Helvetica', weight: 'bold' },
                x: 0.5, xanchor: 'center'
            },
            xaxis: {
                tickmode: 'array', tickvals: xNumeric, ticktext: weeks,
                showgrid: true, gridcolor: 'rgba(200,200,200,0.3)', zeroline: false,
                range: [-0.5, 7.5],
                showline: true, linewidth: 4, linecolor: '#d1d5db', mirror: true
            },
            yaxis: {
                showticklabels: false, showgrid: true, gridcolor: 'rgba(200,200,200,0.3)', zeroline: false,
                range: [0, yMax * 1.1],
                showline: true, linewidth: 4, linecolor: '#d1d5db', mirror: true
            },
            legend: {
                x: 0.5, y: -0.2, xanchor: 'center', orientation: 'h',
                bgcolor: 'rgba(255,255,255,0.9)', bordercolor: 'rgba(0,0,0,0.1)', borderwidth: 1,
                font: { size: 12, family: 'Helvetica' }
            },
            margin: { l: 70, r: 80, t: 70, b: 100 },
            annotations: initialAnnotations,
            font: { family: 'Helvetica, Arial, sans-serif' },
            template: 'plotly_white'
        });

        const timer = setTimeout(() => {
            try {
                if (data.enable_animation !== false && plotRef.current && finalFrames.length > 0) {
                    // @ts-ignore
                    Plotly.animate(plotRef.current.el, finalFrames, {
                        frame: { duration: 40, redraw: true },
                        transition: { duration: 0 },
                        mode: 'immediate'
                    });
                }
            } catch (animErr) {
                console.error("Animation error ignored:", animErr);
            }
        }, 1000);

        return () => clearTimeout(timer);
    }, [data, title, hideTargets]);

    return (
        <div style={{
            backgroundColor: '#ffffff',
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            padding: '1rem',
            overflow: 'hidden'
        }}>
            {data?.is_invoice && (
                <div style={{
                    backgroundColor: '#f0fdf4',
                    border: '1px solid #bbf7d0',
                    borderRadius: '8px',
                    padding: '0.65rem 1.25rem',
                    marginBottom: '0.5rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '1rem',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#166534', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            8-Week Weekly Avg:
                        </span>
                        <span style={{ fontSize: '1.15rem', fontWeight: 900, color: '#ea580c' }}>
                            {formatMoney(data.avg_weekly)}/wk
                        </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#166534', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            Projected FY End (by Mar 31, 2027):
                        </span>
                        <span style={{ fontSize: '1.3rem', fontWeight: 900, color: '#047857' }}>
                            {formatMoney(data.projected_fy_end)}
                        </span>
                        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#4b5563' }}>
                            ({formatMoney(data.po_pipeline?.[data.po_pipeline?.length - 1])} Invoiced + {formatMoney(data.projected_runrate_addition)} over {data.remaining_weeks || 31} wks @ {formatMoney(data.avg_weekly)}/wk)
                        </span>
                    </div>
                </div>
            )}
            <div style={{ flex: 1, width: '100%' }}>
                <Plot
                    ref={plotRef}
                    data={figData}
                    layout={figLayout}
                    frames={figFrames}
                    config={{ responsive: true, displayModeBar: false, scrollZoom: false }}
                    style={{ width: '100%', height: '100%' }}
                    useResizeHandler={true}
                />
            </div>
            <div style={{ fontFamily: 'Helvetica, Arial, sans-serif', fontWeight: 'bold', fontSize: '1.25rem', marginTop: '0.5rem', textAlign: 'center', color: '#374151' }}>
                8-Week Historical Performance Trend
            </div>
        </div>
    );
}
