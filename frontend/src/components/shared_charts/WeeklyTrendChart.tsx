import { useEffect, useState, useRef } from 'react';
import Plot from 'react-plotly.js';
import Plotly from 'plotly.js-dist-min';

interface TrendChartProps {
    data: any;
    title: string;
    hideTargets?: boolean;
}

export function WeeklyTrendChart({ data, title, hideTargets = false }: TrendChartProps) {
    const plotRef = useRef<any>(null);
    const [figData, setFigData] = useState<any[]>([]);
    const [figLayout, setFigLayout] = useState<any>({});
    const [figFrames, setFigFrames] = useState<any[]>([]);

    useEffect(() => {
        if (!data) return;

        const { weeks, po_achieved, po_pipeline, stretch_target, styles, annotations } = data;
        const xNumeric = weeks.map((_: any, i: number) => i);

        // Initial Traces
        const initialData = [
            // Target Lines (full, dashed)
            {
                x: xNumeric, y: Array(8).fill(stretch_target), mode: 'lines',
                line: { color: styles.Stretch.color, width: 5, dash: 'dash' },
                name: styles.Stretch.name, type: 'scatter'
            },
            // Animated Lines (start at point 0)
            {
                x: data.enable_animation === false ? xNumeric : [0], y: data.enable_animation === false ? po_achieved : [po_achieved[0]], mode: 'lines+markers',
                marker: { size: 8, color: styles.PO.color },
                line: { color: styles.PO.color, width: 5 },
                name: styles.PO.name, type: 'scatter'
            },
            {
                x: data.enable_animation === false ? xNumeric : [0], y: data.enable_animation === false ? po_pipeline : [po_pipeline[0]], mode: 'lines+markers',
                marker: { size: 8, color: styles.Total.color },
                line: { color: styles.Total.color, width: 5 },
                name: styles.Total.name, type: 'scatter'
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

                const startPO = po_achieved[i];
                const endPO = po_achieved[i + 1];
                const currentPO = startPO + (endPO - startPO) * t;
                const framePO = [...po_achieved.slice(0, i + 1), currentPO];

                const startTotal = po_pipeline[i];
                const endTotal = po_pipeline[i + 1];
                const currentTotal = startTotal + (endTotal - startTotal) * t;
                const frameTotal = [...po_pipeline.slice(0, i + 1), currentTotal];

                const frameTraces = [
                    { x: xNumeric, y: Array(8).fill(stretch_target) },
                    { x: frameX, y: framePO },
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
                range: [0, (hideTargets ? Math.max(1, ...po_pipeline, ...po_achieved) : Math.max(stretch_target * 1.5, ...po_pipeline)) * 1.1],
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
            if (data.enable_animation !== false && plotRef.current && frames.length > 0) {
                // @ts-ignore
                Plotly.animate(plotRef.current.el, frames, {
                    frame: { duration: 40, redraw: true },
                    transition: { duration: 0 },
                    mode: 'immediate'
                });
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
            <div style={{ fontFamily: 'Helvetica, Arial, sans-serif', fontWeight: 'bold', fontSize: '1.25rem', marginTop: '1rem', textAlign: 'center', color: '#374151' }}>
                8-Week Historical Performance Trend
            </div>
        </div>
    );
}
