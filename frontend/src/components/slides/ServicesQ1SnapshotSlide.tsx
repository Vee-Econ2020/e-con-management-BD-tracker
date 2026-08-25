import { useEffect, useMemo, useState } from 'react';
import Plot from 'react-plotly.js';

interface ServicesQ1SnapshotSlideProps {
    region: string;
    quarter?: string;
}

const formatCurrency = (value: number) => {
    if (value === 0) return '';
    if (Math.abs(value) < 1000) return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (Math.abs(value) < 1_000_000) return `$${(value / 1e3).toFixed(2)}K`;
    return `$${(value / 1e6).toFixed(2)}M`;
};

export default function ServicesQ1SnapshotSlide({ region, quarter = 'Q2' }: ServicesQ1SnapshotSlideProps) {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        const fetchData = async () => {
            try {
                setLoading(true);
                // Add cache-busting to prevent stale data
                const cacheBuster = new Date().getTime();
                const response = await fetch(`/api/admin/slides/services-q1-snapshot?region=${encodeURIComponent(region)}&quarter=${encodeURIComponent(quarter)}&_cb=${cacheBuster}`, {
                    cache: 'no-store',
                    headers: {
                        'Cache-Control': 'no-cache, no-store, must-revalidate',
                        'Pragma': 'no-cache'
                    }
                });
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                const result = await response.json();
                if (result.error) throw new Error(result.error);
                if (!cancelled) {
                    setData(result);
                    setError(null);
                }
            } catch (err) {
                if (!cancelled) {
                    console.error(`Failed to fetch Services ${quarter} snapshot for ${region}:`, err);
                    setError(err instanceof Error ? err.message : 'Failed to load data');
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        fetchData();
        return () => {
            cancelled = true;
        };
    }, [region, quarter]);

    const wrapCalWeek = (w: number) => ((w - 1) % 52) + 1;

    const auditedPlotData = useMemo(() => {
        if (!data?.series) return [];
        return data.series.flatMap((series: any) => {
            const auditedPoints = series.weeks
                .map((week: number, index: number) => ({
                    week,
                    amount: Number(series.amounts?.[index] || 0),
                    snapshotDate: series.snapshot_dates?.[index] || '',
                }))
                .filter((point: any) => point.amount > 0);

            if (auditedPoints.length === 0) return [];

            return [{
                x: auditedPoints.map((point: any) => point.week),
                y: auditedPoints.map((point: any) => point.amount),
                mode: 'lines+markers',
                type: 'scatter',
                name: series.fiscal_year,
                line: { color: series.color, width: 4 },
                marker: { size: 10, color: series.color },
                customdata: auditedPoints.map((point: any) => [wrapCalWeek(point.week), point.snapshotDate]),
                hovertemplate: `<b>${series.fiscal_year} Audited</b><br>Week %{customdata[0]}<br>Date: %{customdata[1]}<br>Total: $%{y:,.0f}<extra></extra>`,
            }];
        });
    }, [data]);

    const pipelinePlotData = useMemo(() => {
        if (!data?.series) return [];
        return data.series.flatMap((series: any) => {
            const pipelinePoints = series.weeks
                .map((week: number, index: number) => ({
                    week,
                    amount: Number(series.pipeline_amounts?.[index] || 0),
                    snapshotDate: series.snapshot_dates?.[index] || '',
                }))
                .filter((point: any) => point.amount > 0);

            if (pipelinePoints.length === 0) return [];

            return [{
                x: pipelinePoints.map((point: any) => point.week),
                y: pipelinePoints.map((point: any) => point.amount),
                mode: 'lines+markers',
                type: 'scatter',
                name: series.fiscal_year,
                line: { color: series.color, width: 3, dash: 'dot' },
                marker: { size: 9, color: series.color, symbol: 'circle-open' },
                customdata: pipelinePoints.map((point: any) => [wrapCalWeek(point.week), point.snapshotDate]),
                hovertemplate: `<b>${series.fiscal_year} Pipeline</b><br>Week %{customdata[0]}<br>Date: %{customdata[1]}<br>Pipeline: $%{y:,.0f}<extra></extra>`,
            }];
        });
    }, [data]);

    const auditedAnnotations = useMemo(() => {
        if (!data?.series) return [];
        const allAnnotations: any[] = [];

        data.series.forEach((series: any, seriesIdx: number) => {
            // First series (earlier FY) gets leader lines pointing down, later ones point up
            const arrowDirection = seriesIdx === 0 ? 35 : -35;

            // Only annotate points where the value changes (skip forward-filled duplicates)
            // and always annotate the last point in the series.
            const weeks: number[] = series.weeks || [];
            const amounts: number[] = series.amounts || [];
            let prev = -1;
            weeks.forEach((week: number, idx: number) => {
                const amount = Number(amounts[idx] || 0);
                const label = series.labels?.[idx] || formatCurrency(amount);
                const isLast = idx === weeks.length - 1;
                const changed = amount !== prev;
                if (amount > 0 && (changed || isLast)) {
                    allAnnotations.push({
                        x: week,
                        y: amount,
                        xref: 'x',
                        yref: 'y',
                        text: label,
                        showarrow: true,
                        arrowhead: 0,
                        arrowsize: 1,
                        arrowwidth: 1,
                        arrowcolor: series.color,
                        ax: 0,
                        ay: arrowDirection,
                        font: {
                            size: 18,
                            color: series.color,
                            family: 'Helvetica, Arial, sans-serif',
                            weight: 700,
                        },
                        bgcolor: 'rgba(255, 255, 255, 0.85)',
                        borderpad: 2,
                    });
                }
                prev = amount;
            });
        });

        return allAnnotations;
    }, [data]);

    const pipelineAnnotations = useMemo(() => {
        if (!data?.series) return [];
        const allAnnotations: any[] = [];

        data.series.forEach((series: any, seriesIdx: number) => {
            const arrowDirection = seriesIdx === 0 ? 30 : -30;

            const weeks: number[] = series.weeks || [];
            const pipelines: number[] = series.pipeline_amounts || [];
            let prev = -1;
            weeks.forEach((week: number, idx: number) => {
                const pipelineAmount = Number(pipelines[idx] || 0);
                const pipelineLabel = series.pipeline_labels?.[idx] || formatCurrency(pipelineAmount);
                if (pipelineAmount <= 0) { prev = pipelineAmount; return; }
                const isLast = idx === weeks.length - 1;
                const changed = pipelineAmount !== prev;
                if (!(changed || isLast)) { prev = pipelineAmount; return; }

                allAnnotations.push({
                    x: week,
                    y: pipelineAmount,
                    xref: 'x',
                    yref: 'y',
                    text: pipelineLabel,
                    showarrow: true,
                    arrowhead: 0,
                    arrowsize: 1,
                    arrowwidth: 1,
                    arrowcolor: series.color,
                    ax: 0,
                    ay: arrowDirection,
                    font: {
                        size: 16,
                        color: series.color,
                        family: 'Helvetica, Arial, sans-serif',
                        weight: 700,
                    },
                    bgcolor: 'rgba(255, 255, 255, 0.8)',
                    borderpad: 2,
                });
                prev = pipelineAmount;
            });
        });

        return allAnnotations;
    }, [data]);

    if (loading) {
        return (
            <div style={{ backgroundColor: '#ffffff', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
                <div className="animate-pulse" style={{ fontSize: '1.25rem', fontWeight: 600, color: '#6b7280' }}>
                    Computing Services {quarter} snapshot...
                </div>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div style={{ backgroundColor: '#fee2e2', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
                <div style={{ textAlign: 'center', color: '#991b1b' }}>
                    <div style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>Failed to load Services {quarter} snapshot</div>
                    <div style={{ fontSize: '1rem' }}>{error}</div>
                </div>
            </div>
        );
    }

    const title = region === 'Overall'
        ? `${quarter} Snapshot of Services PO closed won Last Year to this Year - All Region`
        : `${quarter} Snapshot of Services PO closed won Last Year to this Year - ${region}`;

    const auditedYMax = Math.max(1, ...data.series.flatMap((series: any) => series.amounts || [])) * 1.28;
    const pipelineYMax = Math.max(1, ...data.series.flatMap((series: any) => series.pipeline_amounts || [])) * 1.35;
    const allWeeks = data.series.flatMap((series: any) => series.weeks || []);
    const minWeek = Math.min(...allWeeks);
    const maxWeek = Math.max(...allWeeks);
    const tickVals: number[] = Array.isArray(data.week_range) && data.week_range.length > 0
        ? data.week_range
        : Array.from({ length: (Number.isFinite(maxWeek) ? maxWeek : 26) - (Number.isFinite(minWeek) ? minWeek : 14) + 1 },
            (_v, i) => (Number.isFinite(minWeek) ? minWeek : 14) + i);
    const tickText: (number | string)[] = Array.isArray(data.week_tick_labels) && data.week_tick_labels.length === tickVals.length
        ? data.week_tick_labels
        : tickVals.map((w) => wrapCalWeek(w));
    const commonXAxis = {
        title: { text: 'Calendar Week Number' },
        tickmode: 'array',
        tickvals: tickVals,
        ticktext: tickText,
        range: [
            (Number.isFinite(minWeek) ? minWeek : 14) - 0.5,
            (Number.isFinite(maxWeek) ? maxWeek : 40) + 0.5,
        ],
        showgrid: true,
        gridcolor: '#f0f0f0',
        zeroline: false,
    };

    return (
        <div style={{ backgroundColor: '#ffffff', width: '100%', height: '100%', display: 'flex', flexDirection: 'column', padding: '1rem', overflow: 'hidden' }}>
            <div style={{ textAlign: 'center', marginBottom: '0.5rem' }}>
                <h2 style={{ fontSize: '1.7rem', fontWeight: 700, color: '#1f2937', margin: 0, fontFamily: 'Helvetica, Arial, sans-serif' }}>
                    {title}
                </h2>
                <div style={{ fontSize: '1.1rem', color: '#374151', marginTop: '0.35rem', fontStyle: 'italic', fontFamily: 'Helvetica, Arial, sans-serif' }}>
                    What was the PO Closed Won at the same time last year ?
                </div>
                <div style={{ fontSize: '0.95rem', color: '#6b7280', marginTop: '0.25rem', fontFamily: 'Helvetica, Arial, sans-serif' }}>
                    Data as of Week {data.week} | Upload date: {data.file_date}
                </div>
            </div>
            <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateRows: '1fr 1fr', gap: '0.45rem' }}>
                <div style={{ minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', paddingLeft: '1.2rem', marginBottom: '0.2rem' }}>
                        <div style={{ width: '0.55rem', height: '2.1rem', backgroundColor: '#2e8b57', flexShrink: 0 }} />
                        <div style={{ fontFamily: 'Helvetica, Arial, sans-serif', fontSize: '1.55rem', fontWeight: 800, color: '#111827', lineHeight: 1 }}>
                            Audited PO Closed Won
                        </div>
                    </div>
                    <div style={{ flex: 1, minHeight: 0 }}>
                        <Plot
                            data={auditedPlotData}
                            layout={{
                                autosize: true,
                                hovermode: 'x unified',
                                showlegend: true,
                        legend: {
                            orientation: 'h',
                            yanchor: 'bottom',
                            y: 1.07,
                            xanchor: 'right',
                            x: 1,
                            font: { size: 13, family: 'Helvetica, Arial, sans-serif', weight: 600 },
                        },
                        xaxis: { ...commonXAxis, title: { text: '' }, showticklabels: false },
                        yaxis: {
                            showticklabels: false,
                            range: [0, auditedYMax],
                            showgrid: true,
                            gridcolor: '#e5e7eb',
                            zeroline: false,
                        },
                        margin: { l: 55, r: 45, t: 42, b: 20 },
                        template: 'plotly_white',
                        font: { family: 'Helvetica, Arial, sans-serif' },
                        annotations: auditedAnnotations,
                            } as any}
                            config={{ responsive: true, displayModeBar: false, scrollZoom: false }}
                            style={{ width: '100%', height: '100%' }}
                            useResizeHandler={true}
                        />
                    </div>
                </div>
                <div style={{ minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', paddingLeft: '1.2rem', marginBottom: '0.2rem' }}>
                        <div style={{ width: '0.55rem', height: '2.1rem', backgroundColor: '#f28c18', flexShrink: 0 }} />
                        <div style={{ fontFamily: 'Helvetica, Arial, sans-serif', fontSize: '1.55rem', fontWeight: 800, color: '#111827', lineHeight: 1 }}>
                            Weighted Pipeline
                        </div>
                    </div>
                    <div style={{ flex: 1, minHeight: 0 }}>
                        <Plot
                            data={pipelinePlotData}
                            layout={{
                                autosize: true,
                                hovermode: 'x unified',
                                showlegend: true,
                        legend: {
                            orientation: 'h',
                            yanchor: 'bottom',
                            y: 1.07,
                            xanchor: 'right',
                            x: 1,
                            font: { size: 13, family: 'Helvetica, Arial, sans-serif', weight: 600 },
                        },
                        xaxis: commonXAxis,
                        yaxis: {
                            showticklabels: false,
                            range: [0, pipelineYMax],
                            showgrid: true,
                            gridcolor: '#e5e7eb',
                            zeroline: false,
                        },
                        margin: { l: 55, r: 45, t: 42, b: 48 },
                        template: 'plotly_white',
                        font: { family: 'Helvetica, Arial, sans-serif' },
                        annotations: pipelineAnnotations,
                            } as any}
                            config={{ responsive: true, displayModeBar: false, scrollZoom: false }}
                            style={{ width: '100%', height: '100%' }}
                            useResizeHandler={true}
                        />
                    </div>
                </div>
            </div>
            <div style={{ fontFamily: 'Helvetica, Arial, sans-serif', fontWeight: 700, fontSize: '1.1rem', textAlign: 'center', color: '#374151' }}>
                Weekly Snapshot Analysis - {quarter} Only
            </div>
        </div>
    );
}