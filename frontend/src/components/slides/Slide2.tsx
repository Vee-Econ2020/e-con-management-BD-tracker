
import { useEffect, useState } from 'react';
import ParticleEarth from './ParticleEarth';

// Interfaces
interface PieChartData {
    week: number;
    target: number;
    deficit: number;
    po: number;
    pipeline: number;
    total: number;
    achievement_pct: number;
}

interface Slide2Data {
    current_week: number;
    previous_week: number;
    base_target: number;
    stretch_target: number;
    prev_week_base: PieChartData;
    current_week_base: PieChartData;
    current_week_stretch: PieChartData;
    invoiced_data?: {
        total_invoiced: number;
        last_week_invoiced: number;
        growth_amount: number;
        growth_pct: number;
    };
    error?: string;
}

const formatDiff = (num: number) => {
    const absNum = Math.abs(num);
    if (absNum >= 1e9) return (absNum / 1e9).toFixed(2) + 'b';
    if (absNum >= 1e6) return (absNum / 1e6).toFixed(2) + 'm';
    if (absNum >= 1e3) return Math.round(absNum / 1e3) + 'k';
    return Math.round(absNum) + '';
};

const InvoicedCard = ({
    totalInvoiced = 0,
    lastWeekInvoiced = 0,
    growthAmount = 0,
    growthPct = 0
}: {
    totalInvoiced?: number;
    lastWeekInvoiced?: number;
    growthAmount?: number;
    growthPct?: number;
}) => {
    const isGrowth = growthAmount >= 0;
    const growthColor = isGrowth ? '#2a9d8f' : '#e76f51';
    const sign = isGrowth ? '+' : '';

    const formattedTotal = (totalInvoiced / 1e6).toFixed(2) + 'M';
    const formattedGrowthAmt = sign + (growthAmount / 1e6).toFixed(2) + 'M';
    const formattedGrowthPct = sign + growthPct.toFixed(1) + '%';
    const formattedLastWeek = (lastWeekInvoiced / 1e6).toFixed(2) + 'M';

    return (
        <div style={{
            backgroundColor: '#f3f4f6',
            borderRadius: '12px',
            border: '1px solid #e5e7eb',
            borderLeft: '12px solid #10b981',
            width: '100%',
            height: '100%',
            minHeight: '130px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '1.25rem 1rem',
            boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)'
        }}>
            <div style={{
                fontFamily: 'Helvetica, Arial, sans-serif',
                fontSize: '0.8rem',
                fontWeight: '800',
                color: '#059669',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                marginBottom: '0.25rem',
                textAlign: 'center'
            }}>
                TOTAL INVOICED
            </div>
            <div style={{
                display: 'flex',
                alignItems: 'baseline',
                justifyContent: 'center',
                gap: '8px',
                flexWrap: 'wrap'
            }}>
                <div style={{
                    fontFamily: 'Helvetica, Arial, sans-serif',
                    fontSize: '2rem',
                    fontWeight: '900',
                    color: '#047857',
                    lineHeight: '1'
                }}>
                    ${formattedTotal}
                </div>
                <div style={{
                    fontFamily: 'Helvetica, Arial, sans-serif',
                    fontSize: '0.95rem',
                    fontWeight: 'bold',
                    color: growthColor
                }}>
                    ({formattedGrowthAmt}, {formattedGrowthPct})
                </div>
            </div>
            <div style={{
                fontFamily: 'Helvetica, Arial, sans-serif',
                fontSize: '0.75rem',
                fontWeight: '600',
                color: '#6b7280',
                marginTop: '0.4rem'
            }}>
                last week : until last week ${formattedLastWeek}
            </div>
        </div>
    );
};

const TargetCard = ({ title, value, color, borderColor, prevValue }: { title: string, value: number, color: string, borderColor: string, prevValue?: number }) => {
    let showDiff = prevValue !== undefined && prevValue !== null;
    let diff = showDiff ? value - (prevValue as number) : 0;

    const isGrowth = diff > 0;
    const isDip = diff < 0;
    const diffColor = isGrowth ? '#2a9d8f' : (isDip ? '#e76f51' : '#6b7280');
    const diffIcon = isGrowth ? '▲' : (isDip ? '▼' : '');
    const diffText = diff !== 0 ? formatDiff(diff) : '';

    return (
        <div style={{
            backgroundColor: '#f3f4f6', // Light grey background
            borderRadius: '12px',      // Slightly more rounded
            border: '1px solid #e5e7eb',
            borderLeft: `12px solid ${borderColor}`, // Much Thicker Accent (User request: "thick enough colors")
            width: '100%',
            height: '100%',
            minHeight: '140px', // Added minHeight to increase height
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '1.75rem 1rem', // Increased vertical padding
            boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)'
        }}>
            <div style={{
                fontFamily: 'Helvetica, Arial, sans-serif',
                fontSize: '0.8rem', // Slightly smaller label
                fontWeight: '800',
                color: color,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                marginBottom: '0.25rem', // Tighter spacing
                textAlign: 'center'
            }}>
                {title}
            </div>
            <div style={{
                display: 'flex',
                alignItems: 'baseline',
                justifyContent: 'center',
                gap: '12px'
            }}>
                <div style={{
                    fontFamily: 'Helvetica, Arial, sans-serif',
                    fontSize: '2.25rem', // Slightly smaller value (was 2.5rem)
                    fontWeight: '900',
                    color: color,
                    lineHeight: '1'
                }}>
                    {(value / 1e6).toFixed(2)}M
                </div>
                {showDiff && diff !== 0 && (
                    <div style={{
                        fontFamily: 'Helvetica, Arial, sans-serif',
                        fontSize: '1.25rem',
                        fontWeight: 'bold',
                        color: diffColor,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                    }}>
                        {diffText} {diffIcon}
                    </div>
                )}
            </div>
        </div>
    );
};

export default function Slide2() {
    const [data, setData] = useState<Slide2Data | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchSlide2Data();
    }, []);

    const fetchSlide2Data = async () => {
        try {
            setLoading(true);
            const response = await fetch('/api/admin/slides/slide2');
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const result = await response.json();
            if (result.error) throw new Error(result.error);
            setData(result);
        } catch (err) {
            console.error(err);
            setError(err instanceof Error ? err.message : 'Failed to load data');
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="flex items-center justify-center h-full text-gray-500 font-bold animate-pulse">Loading...</div>;
    if (error || !data) return <div className="flex items-center justify-center h-full text-red-700 bg-red-100">Error: {error}</div>;

    return (
        <div style={{
            backgroundColor: '#ffffff',
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'row', // Main Split: Globe | Content
            padding: '2rem 3rem',
            boxSizing: 'border-box',
            overflow: 'hidden',
            alignItems: 'center'
        }}>
            {/* Left Section: Globe Only */}
            <div style={{
                flex: '0 0 35%', // Globe takes ~35% width
                height: '100%',
                display: 'flex',
                justifyContent: 'center', // Center horizontally in this column
                alignItems: 'center',     // Center vertically in this column
                paddingRight: '2rem'
            }}>
                <div style={{ width: '100%', height: '1200px' }}>
                    <ParticleEarth />
                </div>
            </div>

            {/* Right Section: Text + Cards */}
            <div style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                height: '100%'
            }}>
                {/* 1. Header Text Stack */}
                <div style={{ marginBottom: '2rem' }}>
                    <h3 style={{
                        fontFamily: 'Helvetica, Arial, sans-serif',
                        fontSize: '1.5rem',
                        fontWeight: 'bold',
                        color: '#6b7280',
                        margin: '0 0 0.5rem 0'
                    }}>
                        e-con Systems
                    </h3>
                    <h1 style={{
                        fontFamily: 'Helvetica, Arial, sans-serif',
                        fontSize: '4.25rem',
                        fontWeight: 'bold',
                        color: '#4b5563',
                        margin: '0 0 0.75rem 0',
                        lineHeight: '1.1'
                    }}>
                        Weekly Tracker
                    </h1>
                    <h2 style={{
                        fontFamily: 'Helvetica, Arial, sans-serif',
                        fontSize: '2.25rem',
                        fontWeight: 'bold',
                        color: '#9ca3af',
                        margin: '0'
                    }}>
                        FY2027 - week {data.current_week}
                    </h2>
                </div>

                {/* 2. Key Metrics Grid */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, 1fr)',
                    gridTemplateRows: 'repeat(2, auto)',
                    gap: '1.25rem',
                    width: '100%',
                    maxWidth: '800px', // Constrain width of the cards
                }}>
                    {/* Top Left: Stretch Target */}
                    <TargetCard
                        title="STRETCH TARGET"
                        value={data.stretch_target}
                        color="#9d45eb"
                        borderColor="#b666f7"
                    />

                    {/* Top Right: Base Target */}
                    <TargetCard
                        title="BASE TARGET"
                        value={data.base_target}
                        color="#466cd3"
                        borderColor="#668cf3"
                    />

                    {/* Bottom Left: Total PO */}
                    <TargetCard
                        title="TOTAL PO (CLOSED WON)"
                        value={data.current_week_base?.po || 0}
                        prevValue={data.prev_week_base?.po}
                        color="#787878"
                        borderColor="#999999"
                    />

                    {/* Bottom Right: Total Forecast */}
                    <TargetCard
                        title="TOTAL W.FORECAST (PIPELINE)"
                        value={data.current_week_base?.pipeline || 0}
                        prevValue={data.prev_week_base?.pipeline}
                        color="#dead65ff"
                        borderColor="#fbc14cff"
                    />
                </div>

                {/* Invoiced Amount Card */}
                <div style={{ marginTop: '1.25rem', width: '100%', maxWidth: '800px' }}>
                    <InvoicedCard
                        totalInvoiced={data.invoiced_data?.total_invoiced}
                        lastWeekInvoiced={data.invoiced_data?.last_week_invoiced}
                        growthAmount={data.invoiced_data?.growth_amount}
                        growthPct={data.invoiced_data?.growth_pct}
                    />
                </div>
            </div>
        </div>
    );
}
