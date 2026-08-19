import { useEffect, useMemo, useRef, useState } from 'react';
import Plot from 'react-plotly.js';

interface CategorySummary {
    category: string;
    revenue: number;
    gross_margin: number;
    gross_margin_pct: number;
    account_count: number;
}

interface AccountRow {
    account_name: string;
    revenue: number;
    gross_margin: number;
    gross_margin_pct: number;
}

interface RegionSummary {
    revenue: number;
    gross_margin: number;
    gross_margin_pct: number;
}

interface SlideData {
    title: string;
    date: string | null;
    upload_week: number | null;
    region: string;
    region_summary: RegionSummary;
    categories: string[];
    category_summaries: CategorySummary[];
    accounts: Record<string, AccountRow[]>;
    error?: string;
}

const BAR_COLORS = {
    revenue: '#4a2175',
    gross_margin: '#0e7c7b',
};

const fmt = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 0 });

type SortColumn = 'account_name' | 'revenue' | 'gross_margin' | 'gross_margin_pct';
type SortDirection = 'asc' | 'desc';

export default function RegionServicesCYGMSlide({ region }: { region: string }) {
    const plotRef = useRef<any>(null);
    const [data, setData] = useState<SlideData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [sortColumn, setSortColumn] = useState<SortColumn>('revenue');
    const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
    const [filterAbove10K, setFilterAbove10K] = useState(false);

    useEffect(() => {
        (async () => {
            try {
                setLoading(true);
                const response = await fetch(
                    `/api/admin/slides/region-services-cy-gross-margin?region=${encodeURIComponent(region)}`
                );
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                const result: SlideData = await response.json();
                if (result.error) throw new Error(result.error);
                setData(result);
                setError(null);
            } catch (err) {
                console.error(`Failed to fetch services CY GM data for ${region}:`, err);
                setError(err instanceof Error ? err.message : 'Failed to load data');
            } finally {
                setLoading(false);
            }
        })();
    }, [region]);

    const activeSummary = useMemo<RegionSummary>(() => {
        if (!data) return { revenue: 0, gross_margin: 0, gross_margin_pct: 0 };
        if (!selectedCategory) return data.region_summary;
        const cat = data.category_summaries.find(c => c.category === selectedCategory);
        return cat
            ? { revenue: cat.revenue, gross_margin: cat.gross_margin, gross_margin_pct: cat.gross_margin_pct }
            : data.region_summary;
    }, [data, selectedCategory]);

    const visibleAccounts = useMemo<AccountRow[]>(() => {
        if (!data) return [];
        let accounts: AccountRow[];
        if (selectedCategory) {
            accounts = (data.accounts[selectedCategory] ?? []).slice();
        } else {
            accounts = Object.values(data.accounts).flat();
        }
        
        // Apply revenue filter
        if (filterAbove10K) {
            accounts = accounts.filter(acc => acc.revenue > 10000);
        }
        
        // Apply sorting
        return accounts.sort((a, b) => {
            let aVal: number | string;
            let bVal: number | string;
            
            switch (sortColumn) {
                case 'account_name':
                    aVal = a.account_name.toLowerCase();
                    bVal = b.account_name.toLowerCase();
                    break;
                case 'revenue':
                    aVal = a.revenue;
                    bVal = b.revenue;
                    break;
                case 'gross_margin':
                    aVal = a.gross_margin;
                    bVal = b.gross_margin;
                    break;
                case 'gross_margin_pct':
                    aVal = a.gross_margin_pct;
                    bVal = b.gross_margin_pct;
                    break;
            }
            
            if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
            if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
            return 0;
        });
    }, [data, selectedCategory, sortColumn, sortDirection, filterAbove10K]);

    const chartData = useMemo(() => {
        if (!data) return [];
        const xVals = data.categories.map((_, i) => i);
        const revValues = data.category_summaries.map(c => c.revenue / 1_000_000);
        const gmValues = data.category_summaries.map(c => c.gross_margin / 1_000_000);
        return [
            {
                x: xVals,
                y: revValues,
                type: 'bar' as const,
                name: 'Services Revenue',
                marker: { color: BAR_COLORS.revenue },
                text: revValues.map(v => v.toFixed(2)),
                textposition: 'outside' as const,
                textfont: { size: 11, color: '#4a2175' },
                cliponaxis: false,
                hovertemplate: 'Revenue: %{y:.2f}M<extra></extra>',
            },
            {
                x: xVals,
                y: gmValues,
                type: 'bar' as const,
                name: 'Services Gross Margin',
                marker: { color: BAR_COLORS.gross_margin },
                text: gmValues.map(v => v.toFixed(2)),
                textposition: 'outside' as const,
                textfont: { size: 11, color: '#0e7c7b' },
                cliponaxis: false,
                hovertemplate: 'Gross Margin: %{y:.2f}M<extra></extra>',
            },
        ];
    }, [data]);

    const chartLayout = useMemo(() => {
        if (!data) return {};
        const allVals = data.category_summaries.flatMap(c => [c.revenue, c.gross_margin]).map(v => v / 1_000_000);
        const maxVal = allVals.length ? Math.max(...allVals) : 0;
        const xVals = data.categories.map((_, i) => i);

        const shapes = xVals.map(pos => ({
            type: 'rect' as const,
            xref: 'x' as const,
            yref: 'paper' as const,
            x0: pos - 0.48,
            x1: pos + 0.48,
            y0: 0,
            y1: 1,
            line: { color: '#d6dbe4', width: 1 },
            fillcolor: 'rgba(255,255,255,0)',
            layer: 'below' as const,
        }));

        return {
            autosize: true,
            barmode: 'group',
            bargap: 0.25,
            bargroupgap: 0.08,
            margin: { l: 5, r: 5, t: 10, b: 30 },
            plot_bgcolor: '#ffffff',
            paper_bgcolor: '#ffffff',
            showlegend: false,
            font: { family: 'Helvetica, Arial, sans-serif', color: '#1e293b' },
            xaxis: {
                tickmode: 'array' as const,
                tickvals: xVals,
                ticktext: data.categories,
                tickfont: { size: 11 },
                showgrid: false,
                zeroline: false,
                linecolor: '#cbd5e1',
                range: [-0.5, xVals.length - 0.5],
            },
            yaxis: {
                showticklabels: false,
                showgrid: false,
                zeroline: false,
                range: [Math.min(0, ...allVals) * 1.1, maxVal * 1.22],
            },
            shapes,
        };
    }, [data]);

    const toggleCategory = (cat: string) => {
        setSelectedCategory(prev => (prev === cat ? null : cat));
    };

    const handleSort = (column: SortColumn) => {
        if (sortColumn === column) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortColumn(column);
            setSortDirection(column === 'account_name' ? 'asc' : 'desc');
        }
    };

    if (loading) {
        return (
            <div style={{ backgroundColor: '#ffffff', height: '100%', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#475569' }}>Loading services current year gross margin…</div>
            </div>
        );
    }
    if (error || !data) {
        return (
            <div style={{ backgroundColor: '#fef2f2', height: '100%', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
                <div style={{ textAlign: 'center', color: '#991b1b' }}>
                    <div style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>Failed to load services current year gross margin</div>
                    <div>{error}</div>
                </div>
            </div>
        );
    }

    return (
        <div style={{
            backgroundColor: '#ffffff',
            height: '100%',
            borderRadius: 8,
            border: '1px solid #d6dbe4',
            padding: '0.6rem 0.8rem',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
        }}>
            {/* Title row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem', flexShrink: 0 }}>
                <h1 style={{ margin: 0, fontSize: '1.55rem', fontWeight: 800, color: '#1e293b', textDecoration: 'underline' }}>
                    {data.title}
                </h1>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        backgroundColor: '#e0f2fe',
                        color: '#0c4a6e',
                        padding: '0.3rem 0.7rem',
                        borderRadius: '999px',
                        fontSize: '0.72rem',
                        fontWeight: '700',
                        letterSpacing: '0.03em',
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
                        padding: '0.3rem 0.7rem',
                        borderRadius: '999px',
                        fontSize: '0.72rem',
                        fontWeight: '700',
                        letterSpacing: '0.03em',
                        textTransform: 'uppercase',
                    }}>
                        Current Year
                    </div>
                </div>
            </div>

            {/* Summary table */}
            <table style={{ borderCollapse: 'collapse', margin: '0 auto 0.35rem', flexShrink: 0 }}>
                <thead>
                    <tr>
                        {['Revenue', 'Gross Margin', 'GM %'].map(h => (
                            <th key={h} style={{
                                padding: '0.2rem 1.6rem',
                                border: '1.5px solid #4a2175',
                                backgroundColor: '#4a2175',
                                color: '#ffffff',
                                fontSize: '0.82rem',
                                fontWeight: 700,
                                textAlign: 'center',
                            }}>{h}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td style={summaryCell}>{fmt(activeSummary.revenue)}</td>
                        <td style={summaryCell}>{fmt(activeSummary.gross_margin)}</td>
                        <td style={summaryCell}>{activeSummary.gross_margin_pct.toFixed(2)} %</td>
                    </tr>
                </tbody>
            </table>

            {/* Body: chart left + table right */}
            <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: '0.5rem', overflow: 'hidden' }}>

                {/* LEFT: chart + buttons */}
                <div style={{ width: '55%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                    <div style={{ flex: 1, minHeight: 0 }}>
                        <Plot
                            ref={plotRef}
                            data={chartData as any}
                            layout={chartLayout as any}
                            config={{ responsive: true, displayModeBar: false, scrollZoom: false }}
                            style={{ width: '100%', height: '100%' }}
                            useResizeHandler
                        />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-around', padding: '0.2rem 0 0.1rem', flexShrink: 0 }}>
                        {data.categories.map(cat => {
                            const isActive = selectedCategory === cat;
                            return (
                                <button
                                    key={cat}
                                    onClick={() => toggleCategory(cat)}
                                    style={{
                                        padding: '0.18rem 0.7rem',
                                        fontSize: '0.7rem',
                                        fontWeight: 600,
                                        border: `1px solid ${isActive ? '#4a2175' : '#94a3b8'}`,
                                        borderRadius: 4,
                                        backgroundColor: isActive ? '#4a2175' : '#f8fafc',
                                        color: isActive ? '#ffffff' : '#334155',
                                        cursor: 'pointer',
                                        transition: 'all 0.15s',
                                    }}
                                >
                                    Show Data
                                </button>
                            );
                        })}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'center', gap: '1.5rem', paddingTop: '0.15rem', flexShrink: 0 }}>
                        <LegendItem color={BAR_COLORS.revenue} label="Services Revenue" />
                        <LegendItem color={BAR_COLORS.gross_margin} label="Services Gross Margin" />
                    </div>
                </div>

                {/* RIGHT: account detail table */}
                <div style={{
                    width: '45%',
                    display: 'flex',
                    flexDirection: 'column',
                    border: '1px solid #d6dbe4',
                    borderRadius: 4,
                    overflow: 'hidden',
                }}>
                    <div style={{
                        backgroundColor: '#f1f5f9',
                        padding: '0.22rem 0.5rem',
                        borderBottom: '1px solid #d6dbe4',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        color: '#334155',
                        flexShrink: 0,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                    }}>
                        <span>
                            {selectedCategory
                                ? `${selectedCategory} — ${(data.accounts[selectedCategory] ?? []).length} accounts`
                                : `All accounts — ${Object.values(data.accounts).flat().length} accounts`}
                        </span>
                        <button
                            onClick={() => setFilterAbove10K(!filterAbove10K)}
                            style={{
                                padding: '0.2rem 0.5rem',
                                fontSize: '0.65rem',
                                fontWeight: 600,
                                border: `1px solid ${filterAbove10K ? '#4a2175' : '#94a3b8'}`,
                                borderRadius: 4,
                                backgroundColor: filterAbove10K ? '#4a2175' : '#ffffff',
                                color: filterAbove10K ? '#ffffff' : '#334155',
                                cursor: 'pointer',
                                transition: 'all 0.15s',
                            }}
                        >
                            {filterAbove10K ? 'Showing > 10K' : 'Show > 10K'}
                        </button>
                    </div>

                    <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', fontSize: '0.68rem', flexShrink: 0 }}>
                        <thead>
                            <tr style={{ backgroundColor: '#4a2175' }}>
                                <th 
                                    onClick={() => handleSort('account_name')} 
                                    style={thStyle({ width: '40%', textAlign: 'left', cursor: 'pointer', userSelect: 'none' })}
                                >
                                    Account Name {sortColumn === 'account_name' && (sortDirection === 'asc' ? '▲' : '▼')}
                                </th>
                                <th 
                                    onClick={() => handleSort('revenue')} 
                                    style={thStyle({ width: '20%', cursor: 'pointer', userSelect: 'none' })}
                                >
                                    Revenue {sortColumn === 'revenue' && (sortDirection === 'asc' ? '▲' : '▼')}
                                </th>
                                <th 
                                    onClick={() => handleSort('gross_margin')} 
                                    style={thStyle({ width: '22%', cursor: 'pointer', userSelect: 'none' })}
                                >
                                    Gross Margin {sortColumn === 'gross_margin' && (sortDirection === 'asc' ? '▲' : '▼')}
                                </th>
                                <th 
                                    onClick={() => handleSort('gross_margin_pct')} 
                                    style={thStyle({ width: '18%', cursor: 'pointer', userSelect: 'none' })}
                                >
                                    GM % {sortColumn === 'gross_margin_pct' && (sortDirection === 'asc' ? '▲' : '▼')}
                                </th>
                            </tr>
                        </thead>
                    </table>

                    <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', fontSize: '0.68rem' }}>
                            <tbody>
                                {visibleAccounts.map((row, idx) => (
                                    <tr key={`${row.account_name}-${idx}`} style={{ backgroundColor: idx % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                                        <td style={tdStyle({ width: '40%', textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' })}>
                                            {row.account_name}
                                        </td>
                                        <td style={tdStyle({ width: '20%' })}>{fmt(row.revenue)}</td>
                                        <td style={tdStyle({ width: '22%' })}>{fmt(row.gross_margin)}</td>
                                        <td style={tdStyle({ width: '18%' })}>{row.gross_margin_pct.toFixed(2)} %</td>
                                    </tr>
                                ))}
                                {visibleAccounts.length === 0 && (
                                    <tr>
                                        <td colSpan={4} style={{ padding: '1rem', textAlign: 'center', color: '#94a3b8', fontStyle: 'italic' }}>
                                            No accounts in this category
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}

const summaryCell: React.CSSProperties = {
    padding: '0.22rem 1.6rem',
    border: '1.5px solid #4a2175',
    textAlign: 'center',
    fontSize: '0.82rem',
    fontWeight: 600,
    color: '#1e293b',
};

function thStyle(extra: React.CSSProperties = {}): React.CSSProperties {
    return {
        padding: '0.22rem 0.3rem',
        color: '#ffffff',
        fontWeight: 700,
        textAlign: 'center',
        borderBottom: '1px solid #d6dbe4',
        ...extra,
    };
}

function tdStyle(extra: React.CSSProperties = {}): React.CSSProperties {
    return {
        padding: '0.18rem 0.3rem',
        borderBottom: '1px solid #e2e8f0',
        textAlign: 'center',
        color: '#1e293b',
        ...extra,
    };
}

function LegendItem({ color, label }: { color: string; label: string }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.7rem', color: '#475569' }}>
            <div style={{ width: 12, height: 12, backgroundColor: color, borderRadius: 2 }} />
            <span>{label}</span>
        </div>
    );
}
