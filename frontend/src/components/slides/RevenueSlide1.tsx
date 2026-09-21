import { useEffect, useState } from 'react';
import ParticleEarth from './ParticleEarth';

interface InvoicedData {
    total_invoiced: number;
    last_week_invoiced: number;
    growth_amount: number;
    growth_pct: number;
}

interface RevenueSlide1Data {
    current_week: number;
    previous_week: number;
    target: number;
    current_po: number;
    prev_po: number;
    invoiced_data?: InvoicedData;
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
    const isGrowth = growthAmount > 0;
    const isDip = growthAmount < 0;
    const growthColor = isGrowth ? '#2a9d8f' : (isDip ? '#e76f51' : '#6b7280');
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
            boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
            boxSizing: 'border-box'
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

const TargetCard = ({
    title,
    value,
    color,
    borderColor,
    prevValue
}: {
    title: string;
    value: number;
    color: string;
    borderColor: string;
    prevValue?: number;
}) => {
    const showDiff = prevValue !== undefined && prevValue !== null;
    const diff = showDiff ? value - (prevValue as number) : 0;

    const isGrowth = diff > 0;
    const isDip = diff < 0;
    const diffColor = isGrowth ? '#2a9d8f' : (isDip ? '#e76f51' : '#6b7280');
    const diffIcon = isGrowth ? '▲' : (isDip ? '▼' : '');
    const diffText = diff !== 0 ? formatDiff(diff) : '';

    return (
        <div style={{
            backgroundColor: '#f3f4f6',
            borderRadius: '12px',
            border: '1px solid #e5e7eb',
            borderLeft: `12px solid ${borderColor}`,
            width: '100%',
            height: '100%',
            minHeight: '140px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '1.75rem 1rem',
            boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
            boxSizing: 'border-box'
        }}>
            <div style={{
                fontFamily: 'Helvetica, Arial, sans-serif',
                fontSize: '0.8rem',
                fontWeight: '800',
                color: color,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                marginBottom: '0.25rem',
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
                    fontSize: '2.25rem',
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

export default function RevenueSlide1({
    fy = 'FY2027',
}: {
    fy?: string;
    isEditing?: boolean;
    onNextSlide?: () => void;
    onPreviousSlide?: () => void;
}) {
    const [data, setData] = useState<RevenueSlide1Data | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let isCancelled = false;

        const fetchRevenueSlide1Data = async () => {
            try {
                setLoading(true);
                const response = await fetch(`/api/admin/revenue/slides/slide1?fy=${fy}`);
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }
                const result = await response.json();
                if (result.error) {
                    throw new Error(result.error);
                }
                if (!isCancelled) {
                    setData(result);
                    setError(null);
                }
            } catch (err) {
                if (!isCancelled) {
                    console.error('Failed to load Revenue slide 1 data:', err);
                    setError(err instanceof Error ? err.message : 'Failed to load data');
                }
            } finally {
                if (!isCancelled) {
                    setLoading(false);
                }
            }
        };

        fetchRevenueSlide1Data();

        return () => {
            isCancelled = true;
        };
    }, [fy]);

    if (loading) {
        return (
            <div style={{
                backgroundColor: '#ffffff',
                width: '100%',
                height: '100%',
                minHeight: '400px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#6b7280',
                fontWeight: 'bold',
                fontFamily: 'Helvetica, Arial, sans-serif'
            }}>
                <div className="animate-pulse">Loading Revenue Tracker Overview...</div>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div style={{
                backgroundColor: '#fee2e2',
                width: '100%',
                height: '100%',
                minHeight: '400px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#991b1b',
                fontWeight: 'bold',
                fontFamily: 'Helvetica, Arial, sans-serif',
                padding: '2rem'
            }}>
                <div>Error loading Revenue Tracker slide 1: {error || 'No data found'}</div>
            </div>
        );
    }

    return (
        <div style={{
            backgroundColor: '#ffffff',
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '2rem 3.5rem',
            boxSizing: 'border-box',
            overflow: 'hidden',
            gap: '2.5rem'
        }}>
            {/* Left Column: Dense Point Cloud Flat Continent Map with Global Connections */}
            <div style={{
                flex: '0 0 40%',
                minWidth: 0,
                height: '100%',
                maxHeight: '520px',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                boxSizing: 'border-box'
            }}>
                <div style={{ width: '100%', height: '100%', minHeight: '380px' }}>
                    <ParticleEarth />
                </div>
            </div>

            {/* Right Column: Title Stack & Key Metrics Cards */}
            <div style={{
                flex: 1,
                minWidth: 0,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                boxSizing: 'border-box'
            }}>
                {/* 1. Header Text Stack */}
                <div style={{ marginBottom: '1.75rem' }}>
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
                        Revenue Tracker
                    </h1>
                    <h2 style={{
                        fontFamily: 'Helvetica, Arial, sans-serif',
                        fontSize: '2.25rem',
                        fontWeight: 'bold',
                        color: '#9ca3af',
                        margin: '0'
                    }}>
                        {fy} - week {data.current_week}
                    </h2>
                </div>

                {/* 2. Top Row: 2 Cards (TARGET and TOTAL PO) */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, 1fr)',
                    gap: '1.25rem',
                    width: '100%',
                    boxSizing: 'border-box'
                }}>
                    {/* Card 1: TARGET (Notice: purely 'TARGET' - no mention of base target) */}
                    <TargetCard
                        title="TARGET"
                        value={data.target}
                        color="#2563eb"
                        borderColor="#3b82f6"
                    />

                    {/* Card 2: TOTAL PO (CLOSED WON) */}
                    <TargetCard
                        title="TOTAL PO (CLOSED WON)"
                        value={data.current_po || 0}
                        prevValue={data.prev_po}
                        color="#787878"
                        borderColor="#999999"
                    />
                </div>

                {/* 3. Bottom Row: 1 Big Wide Invoiced Amount Card */}
                <div style={{ marginTop: '1.25rem', width: '100%', boxSizing: 'border-box' }}>
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
