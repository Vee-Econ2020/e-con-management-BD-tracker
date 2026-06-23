import { useEffect, useState, useRef } from 'react';
import Plot from 'react-plotly.js';
import Plotly from 'plotly.js-dist-min';

interface BacklogChartProps {
    data: any;
    title: string;
}

export function OrderBacklogChart({ data, title }: BacklogChartProps) {
    const plotRef = useRef<any>(null);
    const [figData, setFigData] = useState<any[]>([]);
    const [figLayout, setFigLayout] = useState<any>({});
    const [figFrames, setFigFrames] = useState<any[]>([]);

    useEffect(() => {
        if (!data) return;

        const { weeks, backlog_data, styles, annotations, enable_animation } = data;
        const xNumeric = weeks.map((_: any, i: number) => i);

        // Initial Traces
        // We use a Bar chart instead of lines 
        const initialData = [
            {
                x: enable_animation === false ? xNumeric : [0],
                y: enable_animation === false ? backlog_data : [backlog_data[0]],
                type: 'bar',
                name: styles.Backlog.name,
                marker: { color: styles.Backlog.color }
            }
        ];

        // Frame Generation for Bar chart
        const frames: any[] = [];
        if (enable_animation !== false) {
            for (let i = 0; i < weeks.length; i++) {
                // For bar charts, we can just reveal one bar at a time
                const frameX = xNumeric.slice(0, i + 1);
                const frameY = backlog_data.slice(0, i + 1);

                const currentAnnotations = annotations.filter((ann: any) => {
                    if (ann.type === 'dynamic') {
                        return ann.week_idx <= i;
                    }
                    return true;
                });

                frames.push({
                    data: [{ x: frameX, y: frameY }],
                    layout: { annotations: currentAnnotations },
                    name: `frame_${i}`
                });
            }
        }

        setFigData(initialData);
        setFigFrames(frames);

        // Predefine layout
        const maxValue = Math.max(...backlog_data);

        const initialAnnotations = enable_animation === false
            ? annotations
            : annotations.filter((ann: any) => ann.type !== 'dynamic' || ann.week_idx === 0);

        setFigLayout({
            autosize: true,
            title: {
                text: title,
                font: { size: 40, family: 'Helvetica', weight: 'bold', color: '#4169E1' }, // Royal blue text as per typical slides
                x: 0.5, xanchor: 'center'
            },
            xaxis: {
                tickmode: 'array', tickvals: xNumeric, ticktext: weeks,
                showgrid: true, gridcolor: 'rgba(200,200,200,0.3)', zeroline: false,
                range: [-0.6, weeks.length - 0.4],
                showline: true, linewidth: 2, linecolor: '#d1d5db', mirror: true
            },
            yaxis: {
                showgrid: true, gridcolor: 'rgba(200,200,200,0.3)', zeroline: true,
                range: [Math.min(...backlog_data) * 0.9, maxValue * 1.1],
                showline: true, linewidth: 2, linecolor: '#d1d5db', mirror: true,
                tickformat: '$.3s' // Will format like $35M
            },
            margin: { l: 80, r: 40, t: 80, b: 60 },
            annotations: initialAnnotations,
            font: { family: 'Helvetica, Arial, sans-serif' },
            template: 'plotly_white',
            showlegend: false
        });

        // Trigger animation
        const timer = setTimeout(() => {
            if (enable_animation !== false && plotRef.current && frames.length > 0) {
                // @ts-ignore
                Plotly.animate(plotRef.current.el, frames, {
                    frame: { duration: 300, redraw: true },
                    transition: { duration: 0 },
                    mode: 'immediate'
                });
            }
        }, 1000);

        return () => clearTimeout(timer);
    }, [data, title]);

    return (
        <div style={{
            backgroundColor: '#ffffff',
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            padding: '1rem',
            overflow: 'hidden',
            border: '2px solid #5D9CEC'
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

            {/* e-con logo / footer typical on slides based on images */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', paddingRight: '20px' }}>
                <p style={{ fontSize: '0.8rem', color: '#888' }}>e-con Systems</p>
            </div>
        </div>
    );
}
