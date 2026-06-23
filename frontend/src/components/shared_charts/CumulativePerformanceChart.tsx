import { useEffect, useState, useRef } from 'react';
import Plot from 'react-plotly.js';
import Plotly from 'plotly.js-dist-min';

interface CumulativeChartProps {
    data: any;
    title: string;
    hideTargets?: boolean;
}

export function CumulativePerformanceChart({ data, title, hideTargets = false }: CumulativeChartProps) {
    const plotRef = useRef<any>(null);
    const [figData, setFigData] = useState<any[]>([]);
    const [figLayout, setFigLayout] = useState<any>({});
    const [figFrames, setFigFrames] = useState<any[]>([]);

    useEffect(() => {
        if (!data) return;

        const styles = {
            'Stretch': { color: '#9d45eb', symbol: 'circle', name: 'Stretch Target' },
            'Base': { color: '#466cd3', symbol: 'square', name: 'Base Target' },
            'Won': { color: '#787878', symbol: 'triangle-up', name: 'PO Achieved' },
            'Total': { color: '#f59e0b', symbol: 'diamond', name: 'Cumulative PO Achieved + Pipeline' }
        };

        const xValues = data.quarter_order.map((_: any, i: number) => i);

        // Calculate explicit points for "Won" and "Total" if in QP aggregation mode
        let wonX = [...xValues];
        let wonY = [...data.y_won];
        let totalX = [...xValues];  
        let totalY = [...data.y_total];

        if (data.is_before_april1 && data.current_progress_x !== undefined) {
            const progressX = data.current_progress_x;
            // Build arrays: use actual cumulative data, interpolate to progress line at QP4
            wonX = [];
            wonY = [];
            totalX = [];
            totalY = [];
            
            for (let i = 0; i < xValues.length; i++) {
                if (i === 2) {
                    // At QP4 position, interpolate to the progress line
                    wonX.push(progressX); wonY.push(data.y_won[2]);
                    totalX.push(progressX); totalY.push(data.y_total[2]);
                    continue;
                }
                
                wonX.push(i);
                totalX.push(i);
                wonY.push(data.y_won[i]);
                totalY.push(data.y_total[i]);
            }
        }

        // Initial state (subplots: Left is Base, Right is Stretch)
        const initialData = [
            // Left Chart (Base)
            { x: data.enable_animation === false ? xValues : [0], y: data.enable_animation === false ? data.y_base : [data.y_base[0]], mode: 'lines+markers', marker: { size: 10, symbol: styles['Base'].symbol, color: styles['Base'].color }, line: { color: styles['Base'].color, width: 5 }, name: styles['Base'].name, xaxis: 'x', yaxis: 'y', legendgroup: 'base' },
            { x: data.enable_animation === false ? wonX : [0], y: data.enable_animation === false ? wonY : [wonY[0]], mode: 'lines+markers', marker: { size: 10, symbol: styles['Won'].symbol, color: styles['Won'].color }, line: { color: styles['Won'].color, width: 5 }, name: styles['Won'].name, xaxis: 'x', yaxis: 'y', legendgroup: 'won' },
            { x: data.enable_animation === false ? totalX : [0], y: data.enable_animation === false ? totalY : [totalY[0]], mode: 'lines+markers', marker: { size: 10, symbol: styles['Total'].symbol, color: styles['Total'].color }, line: { color: styles['Total'].color, width: 5 }, name: styles['Total'].name, xaxis: 'x', yaxis: 'y', legendgroup: 'total' },

            // Right Chart (Stretch)
            { x: data.enable_animation === false ? xValues : [0], y: data.enable_animation === false ? data.y_stretch : [data.y_stretch[0]], mode: 'lines+markers', marker: { size: 10, symbol: styles['Stretch'].symbol, color: styles['Stretch'].color }, line: { color: styles['Stretch'].color, width: 5 }, name: styles['Stretch'].name, xaxis: 'x2', yaxis: 'y2', legendgroup: 'stretch' },
            { x: data.enable_animation === false ? wonX : [0], y: data.enable_animation === false ? wonY : [wonY[0]], mode: 'lines+markers', marker: { size: 10, symbol: styles['Won'].symbol, color: styles['Won'].color }, line: { color: styles['Won'].color, width: 5 }, name: styles['Won'].name, xaxis: 'x2', yaxis: 'y2', legendgroup: 'won', showlegend: false },
            { x: data.enable_animation === false ? totalX : [0], y: data.enable_animation === false ? totalY : [totalY[0]], mode: 'lines+markers', marker: { size: 10, symbol: styles['Total'].symbol, color: styles['Total'].color }, line: { color: styles['Total'].color, width: 5 }, name: styles['Total'].name, xaxis: 'x2', yaxis: 'y2', legendgroup: 'total', showlegend: false }
        ];

        // Frame generation
        const frames: any[] = [];
        const stepsPerSegment = 8;

        for (let i = 0; i < data.quarter_order.length - 1; i++) {
            for (let step = 1; step <= stepsPerSegment; step++) {
                const t = step / stepsPerSegment;
                const currentXTip = i + t;
                const frameX = [...xValues.slice(0, i + 1), currentXTip];

                const frameTraces = [
                    // Left Chart
                    { y_data: data.y_base, key: 'Base', xaxis: 'x', yaxis: 'y' },
                    { y_data: data.y_won, key: 'Won', xaxis: 'x', yaxis: 'y' },
                    { y_data: data.y_total, key: 'Total', xaxis: 'x', yaxis: 'y' },
                    // Right Chart
                    { y_data: data.y_stretch, key: 'Stretch', xaxis: 'x2', yaxis: 'y2' },
                    { y_data: data.y_won, key: 'Won', xaxis: 'x2', yaxis: 'y2' },
                    { y_data: data.y_total, key: 'Total', xaxis: 'x2', yaxis: 'y2' }
                ].map(({ y_data, key, xaxis, yaxis }) => {
                    const style = styles[key as keyof typeof styles];
                    const startY = y_data[i];
                    const endY = y_data[i + 1];
                    const currentY = startY + (endY - startY) * t;
                    const frameY = [...y_data.slice(0, i + 1), currentY];

                    return {
                        x: frameX,
                        y: frameY,
                        mode: 'lines+markers',
                        marker: { size: 10, symbol: style.symbol, color: style.color },
                        line: { color: style.color, width: 5 },
                        name: style.name,
                        xaxis, yaxis,
                        type: 'scatter'
                    };
                });

                // Filter annotations
                const currentAnnotations = data.annotations.filter((ann: any) => {
                    if (step === stepsPerSegment) return ann.x <= i + 1;
                    return ann.x <= i;
                }).flatMap((ann: any) => {
                    const color = ann.font?.color;
                    const res: any[] = [];
                    if (color !== styles['Stretch'].color) res.push({ ...ann, xref: 'x', yref: 'y' });
                    if (color !== styles['Base'].color) res.push({ ...ann, xref: 'x2', yref: 'y2' });
                    return res;
                }).concat([
                    { xref: 'paper', yref: 'paper', x: 0.22, y: 1.05, text: '<b>Base Target View</b>', showarrow: false, font: { size: 16 } },
                    { xref: 'paper', yref: 'paper', x: 0.78, y: 1.05, text: '<b>Stretch Target View</b>', showarrow: false, font: { size: 16 } }
                ]);

                frames.push({
                    data: frameTraces,
                    layout: { annotations: currentAnnotations },
                    name: `frame_${i}_${step}`
                });
            }
        }

        // Services-only mode: drop target traces (index 0 = Base, index 3 = Stretch),
        // and drop annotations colored by Stretch/Base + the target view subtitle labels.
        const targetColors = new Set([styles['Stretch'].color, styles['Base'].color]);
        const filterTargetAnnotations = (anns: any[]) => anns.filter((ann: any) => {
            if (hideTargets) {
                if (targetColors.has(ann.font?.color)) return false;
                if (ann.text === '<b>Base Target View</b>' || ann.text === '<b>Stretch Target View</b>') return false;
            }
            return true;
        });
        const filteredInitialData = hideTargets
            ? initialData.filter((_, i) => i !== 0 && i !== 3)
            : initialData;
        const filteredFrames = hideTargets
            ? frames.map((f: any) => ({
                ...f,
                data: f.data.filter((_: any, i: number) => i !== 0 && i !== 3),
                layout: { annotations: filterTargetAnnotations(f.layout?.annotations || []) },
            }))
            : frames;

        setFigData(filteredInitialData);
        setFigFrames(filteredFrames);

        const initialAnnotations = (data.enable_animation === false ? data.annotations : data.annotations.filter((ann: any) => ann.x === 0)).map((ann: any) => {
            // In QP aggregation mode, move Won and Total annotations from QP4 (x=2) to the vertical line
            if (data.is_before_april1 && data.current_progress_x !== undefined && ann.x === 2) {
                const color = ann.font?.color;
                if (color === styles['Won'].color || color === styles['Total'].color) {
                    return { ...ann, x: data.current_progress_x };
                }
            }
            return ann;
        }).flatMap((ann: any) => {
            const color = ann.font?.color;
            const res: any[] = [];
            if (color !== styles['Stretch'].color) res.push({ ...ann, xref: 'x', yref: 'y' });
            if (color !== styles['Base'].color) res.push({ ...ann, xref: 'x2', yref: 'y2' });
            return res;
        }).concat([
            { xref: 'paper', yref: 'paper', x: 0.22, y: 1.08, text: '<b>Base Target View</b>', showarrow: false, font: { size: 16 } },
            { xref: 'paper', yref: 'paper', x: 0.78, y: 1.08, text: '<b>Stretch Target View</b>', showarrow: false, font: { size: 16 } }
        ]);

        const filteredInitialAnnotations = filterTargetAnnotations(initialAnnotations);

        let yMax = 0;
        if (hideTargets) {
            // Services / no-target mode: scale to actuals only (PO Achieved + Cumulative).
            // Including stretch/base would crush the small values into a flat line.
            const actualsPool = [
                ...(data.y_won || []),
                ...(data.y_total || []),
            ].filter((v: any) => typeof v === 'number' && isFinite(v));
            const peak = actualsPool.length ? Math.max(...actualsPool) : 0;
            yMax = (peak > 0 ? peak : 1) * 1.10;
        } else if (data.y_stretch && data.y_total) {
            yMax = Math.max(...data.y_stretch, ...data.y_total) * 1.35;
        }

        setFigLayout({
            autosize: true,
            grid: { rows: 1, columns: 2, pattern: 'independent' },
            xaxis: {
                domain: [0, 0.48],
                title: { text: '' },
                tickmode: 'array', tickvals: xValues, ticktext: data.quarter_order,
                range: [-0.5, 6.5], showgrid: true, gridcolor: 'rgba(200,200,200,0.3)', zeroline: false,
                showline: true, linewidth: 4, linecolor: '#d1d5db', mirror: true
            },
            xaxis2: {
                domain: [0.52, 1],
                title: { text: '' },
                tickmode: 'array', tickvals: xValues, ticktext: data.quarter_order,
                range: [-0.5, 6.5], showgrid: true, gridcolor: 'rgba(200,200,200,0.3)', zeroline: false,
                showline: true, linewidth: 4, linecolor: '#d1d5db', mirror: true
            },
            yaxis: {
                showticklabels: false, title: { text: '' },
                showgrid: true, gridcolor: 'rgba(200,200,200,0.3)', zeroline: false,
                range: [0, yMax],
                showline: true, linewidth: 4, linecolor: '#d1d5db', mirror: true
            },
            yaxis2: {
                showticklabels: false, title: { text: '' },
                showgrid: true, gridcolor: 'rgba(200,200,200,0.3)', zeroline: false,
                range: [0, yMax],
                showline: true, linewidth: 1, linecolor: '#d1d5db', mirror: true
            },
            shapes: [
                {
                    type: 'line', xref: 'x', yref: 'paper',
                    x0: data.current_progress_x ?? data.quarter_order.indexOf(data.current_display_qtr), y0: 0,
                    x1: data.current_progress_x ?? data.quarter_order.indexOf(data.current_display_qtr), y1: 1,
                    line: { color: 'rgba(0,0,0,0.4)', width: 1.5, dash: 'dash' }
                },
                {
                    type: 'line', xref: 'x2', yref: 'paper',
                    x0: data.current_progress_x ?? data.quarter_order.indexOf(data.current_display_qtr), y0: 0,
                    x1: data.current_progress_x ?? data.quarter_order.indexOf(data.current_display_qtr), y1: 1,
                    line: { color: 'rgba(0,0,0,0.4)', width: 1.5, dash: 'dash' }
                }
            ],
            legend: {
                x: 0.5, y: 1.25, xanchor: 'center', orientation: 'h',
                bgcolor: 'rgba(255,255,255,0.9)', bordercolor: 'rgba(0,0,0,0.1)', borderwidth: 1,
                font: { size: 12, family: 'Helvetica' }
            },
            margin: { l: 20, r: 20, t: 100, b: 100 },
            annotations: filteredInitialAnnotations,
            font: { family: 'Helvetica, Arial, sans-serif' }
        });

        const timer = setTimeout(() => {
            if (data.enable_animation !== false && plotRef.current && frames.length > 0) {
                // @ts-ignore
                Plotly.animate(plotRef.current.el, frames, {
                    frame: { duration: 30, redraw: true },
                    transition: { duration: 0 },
                    mode: 'immediate'
                });
            }
        }, 1000);

        return () => clearTimeout(timer);
    }, [data, hideTargets]);

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
            <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
                <h2 style={{ fontSize: '1.75rem', fontWeight: 'bold', color: '#1f2937', margin: 0, fontFamily: 'Helvetica, Arial, sans-serif' }}>
                    {title}
                </h2>
                <div style={{ fontSize: '1rem', color: '#6b7280', marginTop: '0.25rem', fontFamily: 'Helvetica, Arial, sans-serif' }}>
                    Data as of Week {data.week} | Current Quarter: {data.current_display_qtr} | {data.is_before_april1 ? 'QP Aggregation Mode' : 'Normal Cumulative Mode'}
                </div>
            </div>

            <div style={{ height: '65%', width: '100%' }}>
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

            <div style={{ fontFamily: 'Helvetica, Arial, sans-serif', fontWeight: 'bold', fontSize: '1.25rem', marginTop: '1rem', textAlign: 'center', color: '#374151' }}>
                Cumulative Performance Overview (Week {data.week})
            </div>
        </div>
    );
}
