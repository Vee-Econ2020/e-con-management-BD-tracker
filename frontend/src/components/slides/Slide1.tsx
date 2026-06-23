import { useEffect, useState } from 'react';

interface Slide1Data {
    week: number | null;
    stretch_target: string;
    base_target: string;
    total_po: string;
    total_w_forecast: string;
    error?: string;
}

export default function Slide1() {
    const [data, setData] = useState<Slide1Data | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchSlide1Data();
    }, []);

    const fetchSlide1Data = async () => {
        try {
            setLoading(true);
            const response = await fetch('/api/admin/slides/slide1');
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            const result = await response.json();
            setData(result);
            setError(null);
        } catch (err) {
            console.error('Failed to fetch slide 1 data:', err);
            setError(err instanceof Error ? err.message : 'Failed to load data');
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div style={{
                backgroundColor: '#ffffff',
                height: '300px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '2rem'
            }}>
                <div style={{ textAlign: 'center', color: '#6b7280' }}>
                    <div className="animate-pulse" style={{ fontSize: '1.125rem', fontWeight: '600' }}>
                        Loading slide data...
                    </div>
                </div>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div style={{
                backgroundColor: '#fee2e2',
                height: '300px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '2rem'
            }}>
                <div style={{ textAlign: 'center', color: '#991b1b' }}>
                    <div style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '0.5rem' }}>
                        Failed to load slide data
                    </div>
                    <div style={{ fontSize: '0.875rem' }}>{error}</div>
                </div>
            </div>
        );
    }

    return (
        <div style={{
            backgroundColor: '#ffffff',
            minHeight: '300px',
            borderRadius: '8px',
            padding: '2rem',
            boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)'
        }}>
            {/* Slide Title */}
            <div style={{
                fontSize: '2rem',
                fontWeight: 'bold',
                textAlign: 'center',
                marginBottom: '2rem',
                color: '#1f2937',
                borderBottom: '3px solid #3b82f6',
                paddingBottom: '1rem'
            }}>
                FY2027 Weekly Tracker Overview{data.week ? ` - Week ${data.week}` : ''}
            </div>

            {/* Metrics Grid */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '1.5rem',
                marginTop: '1.5rem'
            }}>
                {/* Stretch Target */}
                <div style={{
                    backgroundColor: '#f0fdf4',
                    padding: '1.5rem',
                    borderRadius: '8px',
                    border: '2px solid #22c55e',
                    textAlign: 'center'
                }}>
                    <div style={{
                        fontSize: '0.875rem',
                        fontWeight: '600',
                        color: '#15803d',
                        marginBottom: '0.5rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em'
                    }}>
                        Stretch Target
                    </div>
                    <div style={{
                        fontSize: '2.5rem',
                        fontWeight: 'bold',
                        color: '#166534'
                    }}>
                        {data.stretch_target}
                    </div>
                </div>

                {/* Base Target */}
                <div style={{
                    backgroundColor: '#eff6ff',
                    padding: '1.5rem',
                    borderRadius: '8px',
                    border: '2px solid #3b82f6',
                    textAlign: 'center'
                }}>
                    <div style={{
                        fontSize: '0.875rem',
                        fontWeight: '600',
                        color: '#1e40af',
                        marginBottom: '0.5rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em'
                    }}>
                        Base Target
                    </div>
                    <div style={{
                        fontSize: '2.5rem',
                        fontWeight: 'bold',
                        color: '#1e3a8a'
                    }}>
                        {data.base_target}
                    </div>
                </div>

                {/* Total PO */}
                <div style={{
                    backgroundColor: '#fef3c7',
                    padding: '1.5rem',
                    borderRadius: '8px',
                    border: '2px solid #f59e0b',
                    textAlign: 'center'
                }}>
                    <div style={{
                        fontSize: '0.875rem',
                        fontWeight: '600',
                        color: '#b45309',
                        marginBottom: '0.5rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em'
                    }}>
                        Total PO (Closed Won)
                    </div>
                    <div style={{
                        fontSize: '2.5rem',
                        fontWeight: 'bold',
                        color: '#92400e'
                    }}>
                        {data.total_po}
                    </div>
                </div>

                {/* Total W.Forecast */}
                <div style={{
                    backgroundColor: '#fce7f3',
                    padding: '1.5rem',
                    borderRadius: '8px',
                    border: '2px solid #ec4899',
                    textAlign: 'center'
                }}>
                    <div style={{
                        fontSize: '0.875rem',
                        fontWeight: '600',
                        color: '#be185d',
                        marginBottom: '0.5rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em'
                    }}>
                        Total W.Forecast (Pipeline)
                    </div>
                    <div style={{
                        fontSize: '2.5rem',
                        fontWeight: 'bold',
                        color: '#831843'
                    }}>
                        {data.total_w_forecast}
                    </div>
                </div>
            </div>
        </div>
    );
}
