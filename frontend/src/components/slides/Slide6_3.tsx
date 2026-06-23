import { useEffect, useState } from 'react';

interface GrossMarginCard {
    label: string;
    value: number;
    formatted: string;
    accent: 'revenue' | 'gross_margin' | 'gross_margin_pct';
}

interface GrossMarginSection {
    title: string;
    cards: GrossMarginCard[];
}

interface OverallGrossMarginData {
    title: string;
    subtitle: string;
    upload_week: number | null;
    date: string | null;
    sections: GrossMarginSection[];
    error?: string;
}

const ACCENT_STYLES: Record<GrossMarginCard['accent'], { bg: string; border: string; label: string; value: string }> = {
    revenue: {
        bg: '#eff6ff',
        border: '#60a5fa',
        label: '#1d4ed8',
        value: '#1e3a8a',
    },
    gross_margin: {
        bg: '#ecfdf5',
        border: '#34d399',
        label: '#047857',
        value: '#065f46',
    },
    gross_margin_pct: {
        bg: '#fff7ed',
        border: '#fb923c',
        label: '#c2410c',
        value: '#9a3412',
    },
};

export default function Slide6_3() {
    const [data, setData] = useState<OverallGrossMarginData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const response = await fetch('/api/admin/slides/overall-gross-margin');
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
            console.error('Failed to fetch overall gross margin data:', err);
            setError(err instanceof Error ? err.message : 'Failed to load data');
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div style={{
                background: 'linear-gradient(135deg, #f8fafc 0%, #eef2ff 100%)',
                height: '100%',
                borderRadius: '14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '2rem',
            }}>
                <div style={{ textAlign: 'center', color: '#475569' }}>
                    <div className="animate-pulse" style={{ fontSize: '1.25rem', fontWeight: '700' }}>
                        Loading overall gross margin...
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
                borderRadius: '14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '2rem',
            }}>
                <div style={{ textAlign: 'center', color: '#991b1b' }}>
                    <div style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '0.75rem' }}>
                        Failed to load overall gross margin
                    </div>
                    <div>{error}</div>
                </div>
            </div>
        );
    }

    return (
        <div style={{
            background: 'linear-gradient(180deg, #f8fafc 0%, #ffffff 100%)',
            height: '100%',
            borderRadius: '14px',
            padding: '1.5rem 1.75rem',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 12px 30px rgba(15, 23, 42, 0.08)',
            color: '#0f172a',
        }}>
            <div style={{ marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
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
                        {data.subtitle}
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
                        As on 31-May-2026
                    </div>
                </div>
                <h1 style={{
                    margin: '0.9rem 0 0',
                    fontSize: '2.4rem',
                    lineHeight: 1.05,
                    fontWeight: '900',
                    letterSpacing: '-0.04em',
                }}>
                    {data.title}
                </h1>
            </div>

            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                gap: '1rem',
                flex: 1,
                minHeight: 0,
            }}>
                {data.sections.map(section => (
                    <section key={section.title} style={{
                        backgroundColor: '#ffffff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '16px',
                        padding: '1.1rem',
                        display: 'flex',
                        flexDirection: 'column',
                        minHeight: 0,
                    }}>
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            marginBottom: '1rem',
                        }}>
                            <h2 style={{
                                margin: 0,
                                fontSize: '1.2rem',
                                fontWeight: '800',
                                color: '#0f172a',
                            }}>
                                {section.title}
                            </h2>
                            <div style={{
                                width: '36px',
                                height: '4px',
                                borderRadius: '999px',
                                background: 'linear-gradient(90deg, #0ea5e9 0%, #10b981 100%)',
                            }} />
                        </div>

                        <div style={{
                            display: 'grid',
                            gridTemplateRows: 'repeat(3, minmax(0, 1fr))',
                            gap: '0.85rem',
                            flex: 1,
                            minHeight: 0,
                        }}>
                            {section.cards.map(card => {
                                const accent = ACCENT_STYLES[card.accent];

                                return (
                                    <div key={`${section.title}-${card.label}`} style={{
                                        backgroundColor: accent.bg,
                                        border: `1px solid ${accent.border}`,
                                        borderRadius: '14px',
                                        padding: '1rem',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        justifyContent: 'center',
                                        minHeight: 0,
                                    }}>
                                        <div style={{
                                            fontSize: '0.82rem',
                                            fontWeight: '700',
                                            color: accent.label,
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.05em',
                                            marginBottom: '0.45rem',
                                        }}>
                                            {card.label}
                                        </div>
                                        <div style={{
                                            fontSize: '2rem',
                                            lineHeight: 1.05,
                                            fontWeight: '900',
                                            color: accent.value,
                                            letterSpacing: '-0.03em',
                                            wordBreak: 'break-word',
                                        }}>
                                            {card.formatted}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </section>
                ))}
            </div>
        </div>
    );
}