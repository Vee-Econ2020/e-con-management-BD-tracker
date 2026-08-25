import { useEffect, useMemo, useRef, useState } from 'react';
import Plot from 'react-plotly.js';
import Plotly from 'plotly.js-dist-min';

interface ChartSeries {
    key: string;
    label: string;
    color: string;
    values: number[];
}

interface TableRow {
    key: string;
    label: string;
    type: 'amount' | 'percent';
    color: string;
    values: string[];
}

interface OverallGrossMarginRegionSummaryData {
    title: string;
    upload_week: number | null;
    date: string | null;
    regions: string[];
    chart_series: ChartSeries[];
    table_rows: TableRow[];
    error?: string;
}

export default function Slide6_4() {
    const plotRef = useRef<any>(null);
    const [data, setData] = useState<OverallGrossMarginRegionSummaryData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const regionPositions = useMemo(() => data?.regions.map((_, index) => index) ?? [], [data]);

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                const response = await fetch('/api/admin/slides/overall-gross-margin-region-summary');
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }
                const result = await response.json();
                if (result.error) {
                    throw new Error(result.error);
                }
                setData(result);
                setError(null);
            } catch (err) {
                console.error('Failed to fetch overall gross margin region summary data:', err);
                setError(err instanceof Error ? err.message : 'Failed to load data');
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    const chartData = useMemo(() => {
        if (!data) {
            return [];
        }

        return data.chart_series.map(series => ({
            x: regionPositions,
            y: series.values,
            type: 'bar' as const,
            name: series.label,
            marker: { color: series.color },
            text: series.values.map(value => value.toFixed(2)),
            textposition: 'outside' as const,
            textfont: { size: 13, color: '#334155', weight: 'bold' } as any,
            cliponaxis: false,
            hovertemplate: `${series.label}: %{y:.2f}M<extra></extra>`,
        }));
    }, [data, regionPositions]);

    const chartLayout = useMemo(() => {
        if (!data) {
            return {};
        }

        const allValues = data.chart_series.flatMap(series => series.values);
        const maxValue = allValues.length > 0 ? Math.max(...allValues) : 0;
        const regionShapes = regionPositions.map(position => ({
            type: 'rect' as const,
            xref: 'x' as const,
            yref: 'paper' as const,
            x0: position - 0.48,
            x1: position + 0.48,
            y0: 0,
            y1: 1,
            line: {
                color: '#d6dbe4',
                width: 1,
            },
            fillcolor: 'rgba(255,255,255,0)',
            layer: 'below' as const,
        }));

        return {
            autosize: true,
            barmode: 'group' as const,
            bargap: 0.2,
            bargroupgap: 0.06,
            margin: { l: 40, r: 20, t: 10, b: 40 },
            plot_bgcolor: '#ffffff',
            paper_bgcolor: '#ffffff',
            showlegend: false,
            font: { family: 'Helvetica, Arial, sans-serif', color: '#1e293b' },
            xaxis: {
                tickmode: 'array' as const,
                tickvals: regionPositions,
                ticktext: data.regions,
                tickfont: { size: 12, family: 'Helvetica, Arial, sans-serif' },
                showgrid: false,
                zeroline: false,
                linecolor: '#cbd5e1',
                mirror: true,
                range: [-0.5, regionPositions.length - 0.5],
            },
            yaxis: {
                tickformat: '.2f',
                ticksuffix: 'M',
                range: [0, maxValue * 1.18],
                showgrid: false,
                zeroline: false,
                showticklabels: false,
            },
            shapes: regionShapes,
        };
    }, [data, regionPositions]);

    useEffect(() => {
        if (!plotRef.current || !data || chartData.length === 0) {
            return;
        }

        const frames = data.regions.map((_, index) => ({
            name: `frame_${index}`,
            data: data.chart_series.map(series => ({
                x: regionPositions.slice(0, index + 1),
                y: series.values.slice(0, index + 1),
                text: series.values.slice(0, index + 1).map(value => value.toFixed(2)),
            })),
        }));

        const timeout = setTimeout(() => {
            Plotly.animate(plotRef.current.el, frames, {
                frame: { duration: 220, redraw: true },
                transition: { duration: 0 },
                mode: 'immediate',
            });
        }, 400);

        return () => clearTimeout(timeout);
    }, [chartData, data, regionPositions]);

    if (loading) {
        return (
            <div style={{ backgroundColor: '#ffffff', height: '100%', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div className="animate-pulse" style={{ fontSize: '1.25rem', fontWeight: '700', color: '#475569' }}>
                    Loading gross margin region summary...
                </div>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div style={{ backgroundColor: '#fef2f2', height: '100%', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
                <div style={{ textAlign: 'center', color: '#991b1b' }}>
                    <div style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '0.5rem' }}>Failed to load gross margin region summary</div>
                    <div>{error}</div>
                </div>
            </div>
        );
    }

    return (
        <div style={{
            backgroundColor: '#ffffff',
            height: '100%',
            borderRadius: '8px',
            border: '1px solid #d6dbe4',
            padding: '0.8rem 1rem 0.9rem',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
        }}>
            <div style={{ textAlign: 'center', marginBottom: '0.35rem', flexShrink: 0 }}>
                <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', justifyContent: 'center', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                    <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.6rem',
                        backgroundColor: '#e0f2fe',
                        color: '#0c4a6e',
                        padding: '0.35rem 0.85rem',
                        borderRadius: '999px',
                        fontSize: '0.82rem',
                        fontWeight: '700',
                        letterSpacing: '0.04em',
                        textTransform: 'uppercase',
                    }}>
                        {data.upload_week ? <span>Week {data.upload_week}</span> : null}
                        {data.date ? <span>{data.date}</span> : null}
                    </div>
                    <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        backgroundColor: '#fef3c7',
                        color: '#92400e',
                        padding: '0.35rem 0.85rem',
                        borderRadius: '999px',
                        fontSize: '0.82rem',
                        fontWeight: '700',
                        letterSpacing: '0.04em',
                        textTransform: 'uppercase',
                    }}>
                        As on 31-Jul-2026
                    </div>
                </div>
                <h1 style={{ margin: 0, fontSize: '2rem', fontWeight: '800', color: '#1e40af', lineHeight: 1.05 }}>
                    {data.title}
                </h1>
            </div>

            <div style={{ height: '51%', minHeight: 0, flexShrink: 0 }}>
                <Plot
                    ref={plotRef}
                    data={chartData}
                    layout={chartLayout}
                    config={{ responsive: true, displayModeBar: false, scrollZoom: false }}
                    style={{ width: '100%', height: '100%' }}
                    useResizeHandler
                />
            </div>

            <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', borderTop: '1px solid #dbe2ea', marginTop: '0.25rem', paddingTop: '0.25rem' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', fontSize: '0.74rem' }}>
                    <thead>
                        <tr>
                            <th style={{ width: '17%', textAlign: 'left', border: '1px solid #d6dbe4', padding: '0.32rem 0.4rem', backgroundColor: '#f8fafc' }} />
                            {data.regions.map(region => (
                                <th key={region} style={{ textAlign: 'center', border: '1px solid #d6dbe4', padding: '0.32rem 0.15rem', backgroundColor: '#f8fafc', fontWeight: '700', color: '#334155' }}>
                                    {region}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {data.table_rows.map(row => (
                            <tr key={row.key}>
                                <td style={{ border: '1px solid #d6dbe4', padding: '0.26rem 0.4rem', fontWeight: '600', color: '#334155', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    <span style={{ display: 'inline-block', width: '8px', height: '8px', backgroundColor: row.color, marginRight: '0.35rem', verticalAlign: 'middle' }} />
                                    <span>{row.label}</span>
                                </td>
                                {row.values.map((value, index) => (
                                    <td key={`${row.key}-${data.regions[index]}`} style={{ border: '1px solid #d6dbe4', padding: '0.26rem 0.2rem', textAlign: 'center', color: '#111827' }}>
                                        {value}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}