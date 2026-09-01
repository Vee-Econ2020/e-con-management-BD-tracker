import { useEffect, useState, useRef } from 'react';
import Plot from 'react-plotly.js';
import Plotly from 'plotly.js-dist-min';

interface BacklogChartProps {
    data: any;
    title: string;
}

function getBacklogTarget(data: any, title: string): number {
    if (data?.backlog_target && data.backlog_target > 0) {
        return data.backlog_target;
    }

    const titleUpper = (title || '').toUpperCase();
    const regionUpper = (data?.region || '').toUpperCase();
    const isServices = data?.is_services || titleUpper.includes('SERVICE');

    if (isServices) {
        if (titleUpper.includes('APAC') || titleUpper.includes('ROW') || regionUpper.includes('APAC') || regionUpper.includes('ROW') ||
            titleUpper.includes('ASEAN') || regionUpper.includes('ASEAN') ||
            titleUpper.includes('JAPAN') || regionUpper.includes('JAPAN') ||
            titleUpper.includes('KANZ') || regionUpper.includes('KANZ') ||
            titleUpper.includes('KOREA') || regionUpper.includes('KOREA')) {
            return 0; // No target for Service order backlog for APAC, ROW, ASEAN, Japan, Korea
        }
        if (titleUpper.includes('WEST') || regionUpper.includes('WEST')) return 2750000 * 1.30;
        if (titleUpper.includes('EUROPE') || regionUpper.includes('EUROPE')) return 1500000 * 1.30;
        if (titleUpper.includes('EAST') || regionUpper.includes('EAST')) return 2000000 * 1.30;
        return 7500000 * 1.30; // Overall services default ($9.75M)
    }

    if (titleUpper.includes('WEST') || regionUpper.includes('WEST')) return 18000000 * 1.30; // $23.40M (Stretch)
    if (titleUpper.includes('EUROPE') || regionUpper.includes('EUROPE')) return 16000000 * 1.30; // $20.80M (Stretch)
    if (titleUpper.includes('EAST') || regionUpper.includes('EAST')) return 24000000 * 1.30; // $31.20M (Stretch)
    if (titleUpper.includes('APAC') || titleUpper.includes('ROW') || regionUpper.includes('APAC') || regionUpper.includes('ROW')) return 8300000 * 1.30; // $10.79M (Base sum Japan+ASEAN+KANZ)
    if (titleUpper.includes('ASEAN') || regionUpper.includes('ASEAN')) return 3500000 * 1.30; // $4.55M (Base)
    if (titleUpper.includes('JAPAN') || regionUpper.includes('JAPAN')) return 2800000 * 1.30; // $3.64M (Base)
    if (titleUpper.includes('KANZ') || regionUpper.includes('KANZ')) return 2000000 * 1.30; // $2.60M (Base)
    if (titleUpper.includes('LEGACY') || titleUpper.includes('MANAGEMENT') || regionUpper.includes('LEGACY')) return 5000000 * 1.30; // $6.50M (Base)

    return 63800000 * 1.30; // Overall base default ($82.94M)
}

export function OrderBacklogChart({ data, title }: BacklogChartProps) {
    const plotRef = useRef<any>(null);
    const [figData, setFigData] = useState<any[]>([]);
    const [figLayout, setFigLayout] = useState<any>({});
    const [figFrames, setFigFrames] = useState<any[]>([]);

    useEffect(() => {
        if (!data) return;

        const { weeks, backlog_data, fy_series, fiscal_years, fy_colors, default_colors, weeks_with_fy_data, enable_animation } = data;
        const backlog_target = getBacklogTarget(data, title);
        
        if (!fy_series || !fiscal_years || fiscal_years.length === 0) {
            // Fallback to simple bar if no FY data
            console.warn('No FY breakdown data available, using simple bars');
            return;
        }

        const xNumeric = weeks.map((_: any, i: number) => i);

        // Create target line trace if backlog_target is available
        const targetLineTrace = backlog_target > 0 ? {
            x: xNumeric,
            y: Array(weeks.length).fill(backlog_target),
            mode: 'lines',
            name: `Order Backlog Target ($${(backlog_target / 1e6).toFixed(2)}M)`,
            line: { color: '#E74C3C', width: 3, dash: 'dash' },
            type: 'scatter',
            hoverinfo: 'name+y',
        } : null;

        // Create a trace for each fiscal year (stacked bars)
        const initialData = fiscal_years.map((fy: string, fyIdx: number) => {
            const color = fy_colors[fy] || default_colors[fyIdx % default_colors.length];
            const values = fy_series[fy];
            
            return {
                x: enable_animation === false ? xNumeric : [0],
                y: enable_animation === false ? values : [values[0]],
                type: 'bar',
                name: fy,
                marker: { color },
                text: enable_animation === false 
                    ? values.map((v: number) => v > 0 ? `$${(v / 1e6).toFixed(2)}M` : '')
                    : [values[0] > 0 ? `$${(values[0] / 1e6).toFixed(2)}M` : ''],
                textposition: 'inside',
                textfont: { size: 16, color: '#fff', weight: 'bold' },
                hovertemplate: `${fy}<br>%{y:$,.0f}<extra></extra>`,
            };
        });
        
        // Add a trace for placeholder weeks (weeks without FY data)
        const placeholderValues = weeks.map((_: any, idx: number) => 
            weeks_with_fy_data && !weeks_with_fy_data[idx] ? backlog_data[idx] : 0
        );
        
        if (placeholderValues.some((v: number) => v > 0)) {
            initialData.push({
                x: enable_animation === false ? xNumeric : [0],
                y: enable_animation === false ? placeholderValues : [placeholderValues[0]],
                type: 'bar',
                name: 'Historical Total',
                marker: { color: '#1f6e8c' },
                text: enable_animation === false 
                    ? placeholderValues.map((v: number) => v > 0 ? `$${(v / 1e6).toFixed(2)}M` : '')
                    : [placeholderValues[0] > 0 ? `$${(placeholderValues[0] / 1e6).toFixed(2)}M` : ''],
                textposition: 'inside',
                textfont: { size: 16, color: '#fff', weight: 'bold' },
                hovertemplate: 'Total<br>%{y:$,.0f}<extra></extra>',
            });
        }

        // Add static target line trace to initialData
        if (targetLineTrace) {
            initialData.push(targetLineTrace);
        }

        // Frame Generation for stacked bar chart animation
        const frames: any[] = [];
        if (enable_animation !== false) {
            for (let i = 0; i < weeks.length; i++) {
                const frameData = fiscal_years.map((fy: string) => {
                    const values = fy_series[fy];
                    const frameX = xNumeric.slice(0, i + 1);
                    const frameY = values.slice(0, i + 1);
                    const frameText = frameY.map((v: number) => v > 0 ? `$${(v / 1e6).toFixed(2)}M` : '');
                    
                    return {
                        x: frameX,
                        y: frameY,
                        text: frameText,
                    };
                });
                
                // Add placeholder frame if needed
                if (placeholderValues.some((v: number) => v > 0)) {
                    const frameX = xNumeric.slice(0, i + 1);
                    const frameY = placeholderValues.slice(0, i + 1);
                    const frameText = frameY.map((v: number) => v > 0 ? `$${(v / 1e6).toFixed(2)}M` : '');
                    
                    frameData.push({
                        x: frameX,
                        y: frameY,
                        text: frameText,
                    });
                }

                // Add static target line frame trace so it stays visible
                if (targetLineTrace) {
                    frameData.push({
                        x: xNumeric,
                        y: Array(weeks.length).fill(backlog_target),
                        type: 'scatter',
                        mode: 'lines',
                        name: `Order Backlog Target ($${(backlog_target / 1e6).toFixed(2)}M)`,
                        line: { color: '#E74C3C', width: 3, dash: 'dash' }
                    });
                }

                frames.push({
                    data: frameData,
                    name: `frame_${i}`
                });
            }
        }

        setFigData(initialData);
        setFigFrames(frames);

        // Use backlog_data and backlog_target for total annotations and Y-axis scaling
        const maxValue = Math.max(...backlog_data, backlog_target || 0);

        // Create annotations for total on top of each bar
        const annotations = backlog_data.map((total: number, idx: number) => ({
            x: idx,
            y: total,
            text: `<b>$${(total / 1e6).toFixed(2)}M</b>`,
            showarrow: false,
            font: { size: 18, color: '#000000', weight: 'bold', family: 'Arial' },
            xanchor: 'center',
            yanchor: 'bottom',
            yshift: 5
        }));

        // Add callout annotation for static target line
        if (backlog_target > 0) {
            annotations.push({
                x: weeks.length - 1,
                y: backlog_target,
                text: `<b>Target: $${(backlog_target / 1e6).toFixed(2)}M</b>`,
                showarrow: false,
                font: { size: 16, color: '#E74C3C', weight: 'bold', family: 'Arial' },
                bgcolor: 'rgba(255,255,255,0.9)',
                bordercolor: '#E74C3C',
                borderwidth: 1.5,
                borderpad: 4,
                xanchor: 'left',
                xshift: 10,
                yanchor: 'middle'
            });
        }

        // Layout horizontal target line shape
        const shapes = backlog_target > 0 ? [
            {
                type: 'line',
                xref: 'paper',
                x0: 0,
                x1: 1,
                yref: 'y',
                y0: backlog_target,
                y1: backlog_target,
                line: {
                    color: '#E74C3C',
                    width: 3,
                    dash: 'dash'
                }
            }
        ] : [];

        setFigLayout({
            autosize: true,
            barmode: 'stack',
            title: {
                text: title,
                font: { size: 40, family: 'Helvetica', weight: 'bold', color: '#4169E1' },
                x: 0.5, xanchor: 'center'
            },
            xaxis: {
                tickmode: 'array', 
                tickvals: xNumeric, 
                ticktext: weeks,
                showgrid: true, 
                gridcolor: 'rgba(200,200,200,0.3)', 
                zeroline: false,
                range: [-0.6, weeks.length - 0.1],
                showline: true, 
                linewidth: 2, 
                linecolor: '#d1d5db', 
                mirror: true
            },
            yaxis: {
                showgrid: true, 
                gridcolor: 'rgba(200,200,200,0.3)', 
                zeroline: true,
                range: [0, maxValue * 1.20],
                showline: true, 
                linewidth: 2, 
                linecolor: '#d1d5db', 
                mirror: true,
                tickformat: '$.3s'
            },
            margin: { l: 80, r: 80, t: 80, b: 80 },
            font: { family: 'Helvetica, Arial, sans-serif' },
            template: 'plotly_white',
            showlegend: true,
            legend: {
                orientation: 'h',
                yanchor: 'bottom',
                y: -0.25,
                xanchor: 'center',
                x: 0.5,
                font: { size: 14, weight: 'bold' }
            },
            shapes,
            annotations
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

            {/* e-con logo / footer */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', paddingRight: '20px' }}>
                <p style={{ fontSize: '0.8rem', color: '#888' }}>e-con Systems</p>
            </div>
        </div>
    );
}
