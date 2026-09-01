import { useEffect, useState, memo } from 'react';

interface MilestoneData {
    value: number;
    status: 'none' | 'green' | 'purple' | 'red';
}

interface Slide6Row {
    region: string;
    q4_stretch_target: number;
    current_qtr_stretch_target: number;
    po_achieved: number;
    prev_po_achieved?: number;
    percentage: number;
    milestones: { [key: string]: MilestoneData };
}

interface Slide6Data {
    week: number;
    current_quarter: string;
    rows: Slide6Row[];
    total: Slide6Row;
    enable_animation?: boolean;
}

export default function Slide6({ fy = "FY2027" }: { fy?: string }) {
    const [data, setData] = useState<Slide6Data | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchSlide6Data();
    }, [fy]);

    const fetchSlide6Data = async () => {
        try {
            setLoading(true);
            const response = await fetch(`/api/admin/slides/slide6?fy=${fy}`);
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
            console.error('Failed to fetch slide 6 data:', err);
            setError(err instanceof Error ? err.message : 'Failed to load data');
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (value: number) => {
        return `$${(value / 1e6).toFixed(2)}M`;
    };

    const getProgressGradient = () => {
        // Red (0%) -> Yellow (50%) -> Green (100%)
        return 'linear-gradient(to right, #ef4444 0%, #fbbf24 50%, #10b981 100%)';
    };

    if (loading) {
        return (
            <div style={{
                backgroundColor: '#f8fafc',
                height: '100%',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '2rem'
            }}>
                <div style={{ textAlign: 'center' }}>
                    <div className="animate-pulse" style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1e293b' }}>
                        Loading Region Performance...
                    </div>
                </div>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div style={{
                backgroundColor: '#fef2f2',
                height: '100%',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '2rem'
            }}>
                <div style={{ textAlign: 'center', color: '#991b1b' }}>
                    <div style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '1rem' }}>
                        Failed to load region breakdown
                    </div>
                    <div>{error}</div>
                </div>
            </div>
        );
    }

    // Split rows into 3 (first row) and 4 (second row)
    const firstRow = data.rows.slice(0, 3);
    const secondRow = data.rows.slice(3);

    return (
        <div style={{
            backgroundColor: '#f8fafc',
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            padding: '1rem', // Reduced padding
            overflow: 'hidden',
            fontFamily: '"Inter", "Helvetica", "Arial", sans-serif',
            fontSize: 'min(16px, 1.1vh, 0.9vw)' // Reduced base scaling significanly
        }}>
            {/* Header */}
            <div style={{
                marginBottom: '0.75rem',
                textAlign: 'center',
                flexShrink: 0
            }}>
                <h1 style={{
                    fontSize: '2.5rem',
                    fontWeight: '900',
                    color: '#0f172a',
                    margin: 0,
                    letterSpacing: '-0.03em',
                    lineHeight: 1.1
                }}>
                    FY 26-27 : PO's Achieved
                </h1>
                <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    backgroundColor: '#e2e8f0',
                    padding: '0.3rem 1.25rem',
                    borderRadius: '2rem',
                    color: '#475569',
                    fontSize: '0.9rem',
                    fontWeight: '700',
                    marginTop: '0.25rem'
                }}>
                    Week {data.week} • {data.current_quarter}
                </div>
            </div>

            {/* Grid - First Row (3 cards) */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '1rem',
                marginBottom: '1rem',
                flex: 1.2,
                minHeight: 0
            }}>
                {firstRow.map((row, index) => (
                    <Card key={index} row={row} qtr={data.current_quarter} enableAnimation={data.enable_animation !== false} formatCurrency={formatCurrency} gradient={getProgressGradient()} />
                ))}
            </div>

            {/* Grid - Second Row (4 cards) */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: '1rem',
                marginBottom: '1.25rem',
                flex: 1,
                minHeight: 0
            }}>
                {secondRow.map((row, index) => (
                    <Card key={index} row={row} qtr={data.current_quarter} enableAnimation={data.enable_animation !== false} formatCurrency={formatCurrency} gradient={getProgressGradient()} isSmaller />
                ))}
            </div>

            {/* Total Section (Isolated Component) */}
            <OverallTotalBanner data={data.total} enableAnimation={data.enable_animation !== false} formatCurrency={formatCurrency} getProgressGradient={getProgressGradient} />
        </div>
    );
}

// --- Animation Hook ---
function useAnimatedProgress(targetValue: number, enabled: boolean = true, duration: number = 1500, delay: number = 1000) {
    const [stats, setStats] = useState(enabled ? 0 : targetValue);

    useEffect(() => {
        if (!enabled) {
            setStats(targetValue);
            return;
        }

        let animationFrameId: number;
        let timeoutId: any;
        let startTimestamp: number | null = null;

        const step = (timestamp: number) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / duration, 1);

            // Ease out cubic for satisfying smoothness
            // 1 - (1-t)^3
            const ease = 1 - Math.pow(1 - progress, 3);

            setStats(ease * targetValue);

            if (progress < 1) {
                animationFrameId = window.requestAnimationFrame(step);
            }
        };

        // Add 1 second delay (or custom delay) before starting
        timeoutId = setTimeout(() => {
            animationFrameId = window.requestAnimationFrame(step);
        }, delay);

        return () => {
            clearTimeout(timeoutId);
            cancelAnimationFrame(animationFrameId);
        };
    }, [targetValue, duration, delay, enabled]);

    return stats;
}

function BoxConfettiShower({ active, color }: { active: boolean; color: string }) {
    const [show, setShow] = useState(false);
    const [pieces] = useState(() => Array.from({ length: 28 }, (_, index) => ({
        id: index,
        left: 4 + (index * 3.4) % 92,
        delay: (index % 7) * 0.08,
        duration: 1.2 + (index % 5) * 0.18,
        drift: -20 + (index % 9) * 5,
        rotate: -160 + (index % 11) * 32,
        size: 5 + (index % 4) * 2,
        shape: index % 3,
        pieceColor: index % 4 === 0 ? '#fbbf24' : index % 4 === 1 ? '#ffffff' : index % 4 === 2 ? color : '#f59e0b'
    })));

    useEffect(() => {
        if (!active) {
            setShow(false);
            return;
        }

        setShow(true);
        const timeout = setTimeout(() => setShow(false), 2000);
        return () => clearTimeout(timeout);
    }, [active]);

    if (!show) return null;

    return (
        <div style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            overflow: 'hidden',
            zIndex: 30,
            borderRadius: '16px'
        }}>
            <style>{`
                @keyframes card-confetti-fall {
                    0% {
                        transform: translate3d(0, -16px, 0) rotate(0deg);
                        opacity: 0;
                    }
                    10% {
                        opacity: 1;
                    }
                    100% {
                        transform: translate3d(var(--drift), 260px, 0) rotate(var(--spin));
                        opacity: 0;
                    }
                }
            `}</style>
            {pieces.map((piece) => (
                <div
                    key={piece.id}
                    style={{
                        position: 'absolute',
                        left: `${piece.left}%`,
                        top: '-8px',
                        width: piece.shape === 1 ? `${piece.size}px` : `${piece.size + 1}px`,
                        height: piece.shape === 2 ? `${Math.max(4, piece.size - 1)}px` : `${piece.size}px`,
                        backgroundColor: piece.pieceColor,
                        borderRadius: piece.shape === 1 ? '999px' : '2px',
                        clipPath: piece.shape === 2 ? 'polygon(50% 0%, 0% 100%, 100% 100%)' : undefined,
                        boxShadow: `0 0 8px ${piece.pieceColor}`,
                        opacity: 0,
                        ['--drift' as string]: `${piece.drift}px`,
                        ['--spin' as string]: `${piece.rotate}deg`,
                        animation: `card-confetti-fall ${piece.duration}s linear ${piece.delay}s forwards`
                    }}
                />
            ))}
        </div>
    );
}

function OverallTotalBanner({ data, enableAnimation, formatCurrency, getProgressGradient }: {
    data: Slide6Row,
    enableAnimation: boolean,
    formatCurrency: (v: number) => string,
    getProgressGradient: () => string
}) {
    // Animation isolated to this component
    const animatedTotalPercentage = useAnimatedProgress(data.percentage, enableAnimation, 2000, 1000);

    const diff = data.prev_po_achieved !== undefined ? data.po_achieved - data.prev_po_achieved : 0;
    const isGrowth = diff > 0;
    const isDip = diff < 0;
    const diffColor = isGrowth ? '#10b981' : (isDip ? '#ef4444' : '#64748b');
    const diffIcon = isGrowth ? '▲' : (isDip ? '▼' : '');
    const diffText = diff !== 0 ? formatCurrency(Math.abs(diff)) : '';

    return (
        <div style={{
            backgroundColor: '#1e293b',
            borderRadius: '16px',
            padding: '0.75rem 2rem',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2), 0 10px 10px -5px rgba(0,0,0,0.1)',
            marginTop: 'auto',
            flexShrink: 0
        }}>
            <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.05em' }}>OVERALL TOTAL</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '1rem', margin: '-0.1rem 0' }}>
                    <div style={{ fontSize: '3.5rem', fontWeight: '950', letterSpacing: '-0.02em', color: '#ffffff' }}>{formatCurrency(data.po_achieved)}</div>
                    <span style={{ fontSize: '3rem', fontWeight: '950', color: '#38bdf8', lineHeight: 1 }}>{data.percentage}%</span>
                </div>
                {diff !== 0 && (
                    <div style={{
                        fontSize: '1.25rem',
                        fontWeight: 'bold',
                        color: diffColor,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.2rem',
                        marginTop: '0.25rem'
                    }}>
                        {diffText} {diffIcon}
                    </div>
                )}
                <div style={{ fontSize: '1rem', color: '#cbd5e1', fontWeight: '600', marginTop: '0.25rem' }}>
                    vs Stretch Target of {formatCurrency(data.q4_stretch_target)}
                </div>
            </div>

            <div style={{ flex: 1, maxWidth: '600px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <div style={{ paddingTop: '1.5rem', paddingBottom: '1.5rem', width: '100%' }}>
                    <div style={{
                        height: '16px', // Restored thickness
                        position: 'relative',
                        borderRadius: '8px'
                    }}>
                        {/* Faint Background */}
                        <div style={{
                            position: 'absolute',
                            top: 0, left: 0, right: 0, bottom: 0,
                            background: 'linear-gradient(to right, #ef4444 0%, #fbbf24 50%, #10b981 100%)',
                            opacity: 0.15,
                            borderRadius: '8px'
                        }} />

                        {/* Actual Progress (Animated) */}
                        <div style={{
                            height: '100%',
                            position: 'relative',
                            width: `${Math.min(animatedTotalPercentage, 100)}%`,
                            background: getProgressGradient(),
                            backgroundSize: `${(100 / Math.max(animatedTotalPercentage, 1)) * 100}% 100%`,
                            borderRadius: '8px',
                            transition: 'width 0.1s linear',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'flex-end',
                            zIndex: 10
                        }}>
                            <div style={{
                                width: '10px',
                                height: '10px',
                                backgroundColor: '#ffffff',
                                borderRadius: '50%',
                                marginRight: '3px',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.3)'
                            }} />
                        </div>

                        {/* Milestone Markers */}
                        {(() => {
                            // 1. Convert to array and sort by value to check collisions
                            const msArray = Object.entries(data.milestones || {})
                                .map(([qtr, milestone]) => ({ qtr, milestone }))
                                .filter(({ milestone }) => milestone && milestone.value > 0 && milestone.value < data.q4_stretch_target);

                            msArray.sort((a, b) => a.milestone.value - b.milestone.value);

                            // 2. Assign 'levels' (0 = standard, 1 = pushed out, etc) based on proximity
                            const levels: Record<string, number> = {};
                            // Process Stretch (Above) and Base (Below) independently
                            const stretchMs = msArray.filter(m => m.qtr.startsWith('S'));
                            const baseMs = msArray.filter(m => !m.qtr.startsWith('S'));

                            const assignLevels = (arr: typeof msArray) => {
                                let lastPct = -999;
                                let currentLevel = 0;
                                for (const { qtr, milestone } of arr) {
                                    const pct = (milestone.value / data.q4_stretch_target) * 100;
                                    // If within 6% of the last marker, bump the level
                                    if (pct - lastPct < 6) {
                                        currentLevel = (currentLevel === 0) ? 1 : 0; // Toggle levels, or can increment
                                    } else {
                                        currentLevel = 0;
                                    }
                                    levels[qtr] = currentLevel;
                                    lastPct = pct;
                                }
                            };

                            assignLevels(stretchMs);
                            assignLevels(baseMs);

                            return msArray.map(({ qtr, milestone }) => {
                                const pct = (milestone.value / data.q4_stretch_target) * 100;
                                const isAchieved = animatedTotalPercentage >= pct;

                                // Stretch targets start with S (e.g., SQ1), display them ABOVE. Base targets BELOW.
                                const isStretch = qtr.startsWith('S');
                                const level = levels[qtr] || 0;
                                // Level 0: 16px, Level 1: 34px (pushed further out)
                                const offsetDistance = 16 + (level * 20);

                                let achievedColor = '#10b981'; // default green
                                if (milestone.status === 'purple') achievedColor = '#a855f7';
                                else if (milestone.status === 'red') achievedColor = '#ef4444';
                                else if (milestone.status === 'green') achievedColor = '#10b981';

                                return (
                                    <div key={qtr} style={{
                                        position: 'absolute',
                                        left: `${pct}%`,
                                        top: '50%',
                                        transform: 'translate(-50%, -50%)',
                                        zIndex: 20 + level, // higher z-index for pushed labels
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center'
                                    }}>
                                        {isStretch && level > 0 && (
                                            <div style={{
                                                position: 'absolute',
                                                bottom: '16px',
                                                width: '2px',
                                                height: `${offsetDistance - 16}px`,
                                                backgroundColor: isAchieved ? achievedColor : '#cbd5e1',
                                                opacity: 0.5
                                            }} />
                                        )}
                                        {isStretch && (
                                            <div style={{
                                                position: 'absolute',
                                                bottom: `${offsetDistance}px`,
                                                fontSize: '0.95rem',
                                                fontWeight: '800',
                                                color: isAchieved ? achievedColor : '#94a3b8',
                                                textTransform: 'uppercase',
                                                whiteSpace: 'nowrap',
                                                transition: 'color 0.3s ease'
                                            }}>
                                                {qtr}
                                            </div>
                                        )}

                                        <div style={{
                                            width: isAchieved ? '16px' : '10px',
                                            height: isAchieved ? '16px' : '10px',
                                            backgroundColor: isAchieved ? achievedColor : '#fbbf24',
                                            borderRadius: '50%',
                                            border: '2px solid #ffffff',
                                            boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                                        }}>
                                            {isAchieved && (
                                                <svg viewBox="0 0 24 24" width="10" height="10" stroke="white" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round">
                                                    <polyline points="20 6 9 17 4 12"></polyline>
                                                </svg>
                                            )}
                                        </div>

                                        {!isStretch && level > 0 && (
                                            <div style={{
                                                position: 'absolute',
                                                top: '16px',
                                                width: '2px',
                                                height: `${offsetDistance - 16}px`,
                                                backgroundColor: isAchieved ? achievedColor : '#cbd5e1',
                                                opacity: 0.5
                                            }} />
                                        )}
                                        {!isStretch && (
                                            <div style={{
                                                position: 'absolute',
                                                top: `${offsetDistance}px`,
                                                fontSize: '0.95rem',
                                                fontWeight: '800',
                                                color: isAchieved ? achievedColor : '#94a3b8',
                                                textTransform: 'uppercase',
                                                whiteSpace: 'nowrap',
                                                transition: 'color 0.3s ease'
                                            }}>
                                                {qtr}
                                            </div>
                                        )}
                                    </div>
                                );
                            });
                        })()}
                    </div>
                </div>
            </div>
        </div>
    );
}

const Card = memo(function Card({ row, qtr, enableAnimation, formatCurrency, gradient, isSmaller = false }: {
    row: Slide6Row,
    qtr: string,
    enableAnimation: boolean,
    formatCurrency: (v: number) => string,
    gradient: string,
    isSmaller?: boolean
}) {
    // 2s duration, 1s delay
    const animatedPercentage = useAnimatedProgress(row.percentage, enableAnimation, 2000, 1000);

    // Determines if the current quarter target (base or stretch) has been met
    const baseKey = qtr;            // e.g. "QP4"
    const stretchKey = "S" + qtr;   // e.g. "SQP4"
    const hasMetStretch = row.milestones?.[stretchKey]?.status === 'green';
    const hasMetBase = row.milestones?.[baseKey]?.status === 'green';
    const hasMetTarget = hasMetStretch || hasMetBase;

    // Royal purple for stretch, emerald green for base only
    const glowColor = hasMetStretch ? '#7c3aed' : '#10b981';
    const glowRgba = hasMetStretch ? 'rgba(124, 58, 237, 0.35)' : 'rgba(16, 185, 129, 0.35)';

    // Growth indicator logic
    const diff = row.prev_po_achieved !== undefined ? row.po_achieved - row.prev_po_achieved : 0;
    const isGrowth = diff > 0;
    const isDip = diff < 0;
    const diffColor = isGrowth ? '#10b981' : (isDip ? '#ef4444' : '#64748b');
    const diffIcon = isGrowth ? '▲' : (isDip ? '▼' : '');
    const diffText = diff !== 0 ? formatCurrency(Math.abs(diff)) : '';

    return (
        <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '16px',
            padding: isSmaller ? '1rem' : '1.25rem',
            boxShadow: hasMetTarget
                ? `0 0 18px 4px ${glowRgba}, 0 10px 15px -3px rgba(0,0,0,0.1)`
                : '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)',
            border: hasMetTarget ? `2px solid ${glowColor}` : '1px solid #f1f5f9',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            height: '100%',
            position: 'relative',
            overflow: 'hidden'
        }}>
            <BoxConfettiShower active={hasMetTarget && enableAnimation} color={glowColor} />
            <div>
                <div style={{
                    fontSize: isSmaller ? '1.25rem' : '1.75rem',
                    fontWeight: '950',
                    color: '#1e40af',
                    marginBottom: '0.5rem',
                    letterSpacing: '-0.02em',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                }}>
                    {row.region}
                </div>

                <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '0.75rem',
                    marginBottom: '0.75rem'
                }}>
                    <div>
                        <div style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{qtr} Target</div>
                        <div style={{ fontSize: isSmaller ? '1.1rem' : '1.35rem', fontWeight: '900', color: '#1e293b' }}>{formatCurrency(row.current_qtr_stretch_target)}</div>
                    </div>
                    <div>
                        <div style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Stretch Target</div>
                        <div style={{ fontSize: isSmaller ? '1.1rem' : '1.35rem', fontWeight: '900', color: '#1e293b' }}>{formatCurrency(row.q4_stretch_target)}</div>
                    </div>

                    <div style={{ marginTop: '0.5rem' }}>
                        <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.1em' }}>PO Achieved</div>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem' }}>
                            <div style={{ fontSize: isSmaller ? '2rem' : '3rem', fontWeight: '1000', color: '#0f172a', margin: '-0.2rem 0', letterSpacing: '-0.03em' }}>{formatCurrency(row.po_achieved)}</div>
                        </div>
                        {diff !== 0 && (
                            <div style={{
                                fontSize: isSmaller ? '0.9rem' : '1.1rem',
                                fontWeight: 'bold',
                                color: diffColor,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.2rem',
                                marginTop: '0.25rem'
                            }}>
                                {diffText} {diffIcon}
                            </div>
                        )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'flex-end', marginTop: '0.5rem', paddingBottom: isSmaller ? '0' : '0.2rem' }}>
                        <span style={{ fontSize: isSmaller ? '1.5rem' : '2.2rem', fontWeight: '1000', color: '#1e293b', lineHeight: 1 }}>{row.percentage}%</span>
                    </div>
                </div>

            </div>

            {/* Heatmap progress bar */}
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', width: '100%' }}>
                <div style={{ paddingTop: '1.5rem', paddingBottom: '1.5rem', width: '100%' }}>
                    <div style={{
                        height: '12px',
                        position: 'relative',
                        borderRadius: '6px'
                    }}>
                        {/* Faint Background */}
                        <div style={{
                            position: 'absolute',
                            top: 0, left: 0, right: 0, bottom: 0,
                            background: 'linear-gradient(to right, #ef4444 0%, #fbbf24 50%, #10b981 100%)',
                            opacity: 0.15,
                            borderRadius: '6px'
                        }} />

                        {/* Actual Progress (Animated) */}
                        <div style={{
                            height: '100%',
                            position: 'relative',
                            width: `${Math.min(animatedPercentage, 100)}%`, // USE ANIMATED VALUE
                            background: gradient,
                            backgroundSize: `${(100 / Math.max(animatedPercentage, 1)) * 100}% 100%`,
                            borderRadius: '6px',
                            transition: 'width 0.1s linear',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'flex-end',
                            zIndex: 10
                        }}>
                            <div style={{
                                width: '8px',
                                height: '8px',
                                backgroundColor: '#ffffff',
                                borderRadius: '50%',
                                marginRight: '2px',
                                boxShadow: '0 1px 2px rgba(0,0,0,0.3)'
                            }} />
                        </div>

                        {/* Milestone Markers */}
                        {(() => {
                            // 1. Convert to array and sort by value to check collisions
                            const msArray = Object.entries(row.milestones || {})
                                .map(([qtr, milestone]) => ({ qtr, milestone }))
                                .filter(({ milestone }) => milestone && milestone.value > 0 && milestone.value < row.q4_stretch_target);

                            msArray.sort((a, b) => a.milestone.value - b.milestone.value);

                            // 2. Assign 'levels' (0 = standard, 1 = pushed out, etc) based on proximity
                            const levels: Record<string, number> = {};
                            // Process Stretch (Above) and Base (Below) independently
                            const stretchMs = msArray.filter(m => m.qtr.startsWith('S'));
                            const baseMs = msArray.filter(m => !m.qtr.startsWith('S'));

                            const assignLevels = (arr: typeof msArray) => {
                                let lastPct = -999;
                                let currentLevel = 0;
                                for (const { qtr, milestone } of arr) {
                                    const pct = (milestone.value / row.q4_stretch_target) * 100;
                                    // If within 8% of the last marker, bump the level
                                    if (pct - lastPct < 8) {
                                        currentLevel = (currentLevel === 0) ? 1 : 0;
                                    } else {
                                        currentLevel = 0;
                                    }
                                    levels[qtr] = currentLevel;
                                    lastPct = pct;
                                }
                            };

                            assignLevels(stretchMs);
                            assignLevels(baseMs);

                            return msArray.map(({ qtr, milestone }) => {
                                const pct = (milestone.value / row.q4_stretch_target) * 100;
                                // ANIMATED ACTIVATION
                                const isAchieved = animatedPercentage >= pct;

                                // Stretch targets start with S (e.g., SQ1), display them ABOVE. Base targets BELOW.
                                const isStretch = qtr.startsWith('S');
                                const level = levels[qtr] || 0;
                                // Level 0: 14px, Level 1: 30px
                                const offsetDistance = 14 + (level * 18);

                                let achievedColor = '#10b981'; // default green
                                if (milestone.status === 'purple') achievedColor = '#a855f7';
                                else if (milestone.status === 'red') achievedColor = '#ef4444';
                                else if (milestone.status === 'green') achievedColor = '#10b981';

                                return (
                                    <div key={qtr} style={{
                                        position: 'absolute',
                                        left: `${pct}%`,
                                        top: '50%',
                                        transform: 'translate(-50%, -50%)',
                                        zIndex: 20 + level,
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center'
                                    }}>
                                        {isStretch && level > 0 && (
                                            <div style={{
                                                position: 'absolute',
                                                bottom: '14px',
                                                width: '2px',
                                                height: `${offsetDistance - 14}px`,
                                                backgroundColor: isAchieved ? achievedColor : '#cbd5e1',
                                                opacity: 0.5
                                            }} />
                                        )}
                                        {isStretch && (
                                            <div style={{
                                                position: 'absolute',
                                                bottom: `${offsetDistance}px`,
                                                fontSize: '0.9rem',
                                                fontWeight: '900',
                                                color: isAchieved ? achievedColor : '#94a3b8',
                                                textTransform: 'uppercase',
                                                whiteSpace: 'nowrap',
                                                transition: 'color 0.3s ease'
                                            }}>
                                                {qtr}
                                            </div>
                                        )}

                                        <div style={{
                                            width: isAchieved ? '14px' : '10px',
                                            height: isAchieved ? '14px' : '10px',
                                            backgroundColor: isAchieved ? achievedColor : '#fbbf24',
                                            borderRadius: '50%',
                                            border: '1px solid #ffffff',
                                            boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                                        }}>
                                            {isAchieved && (
                                                <svg viewBox="0 0 24 24" width="8" height="8" stroke="white" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round">
                                                    <polyline points="20 6 9 17 4 12"></polyline>
                                                </svg>
                                            )}
                                        </div>

                                        {!isStretch && level > 0 && (
                                            <div style={{
                                                position: 'absolute',
                                                top: '14px',
                                                width: '2px',
                                                height: `${offsetDistance - 14}px`,
                                                backgroundColor: isAchieved ? achievedColor : '#cbd5e1',
                                                opacity: 0.5
                                            }} />
                                        )}
                                        {!isStretch && (
                                            <div style={{
                                                position: 'absolute',
                                                top: `${offsetDistance}px`,
                                                fontSize: '0.9rem',
                                                fontWeight: '900',
                                                color: isAchieved ? achievedColor : '#94a3b8',
                                                textTransform: 'uppercase',
                                                whiteSpace: 'nowrap',
                                                transition: 'color 0.3s ease'
                                            }}>
                                                {qtr}
                                            </div>
                                        )}
                                    </div>
                                );
                            });
                        })()}
                    </div>
                </div>
            </div >
        </div >
    );
});
