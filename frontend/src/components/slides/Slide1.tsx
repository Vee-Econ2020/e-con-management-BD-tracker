import { useEffect, useState } from 'react';

interface Slide1Data {
    week: number | null;
    stretch_target: string;
    base_target: string;
    total_po: string;
    total_w_forecast: string;
    error?: string;
}

export default function Slide1({ fy = "FY2027" }: { fy?: string }) {
    const [data, setData] = useState<Slide1Data | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchSlide1Data();
    }, [fy]);

    const fetchSlide1Data = async () => {
        try {
            setLoading(true);
            const response = await fetch(`/api/admin/slides/slide1?fy=${fy}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const result = await response.json();
            
            if (result.error) {
                throw new Error(result.error);
            }
            
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
                height: '100%',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '2rem'
            }}>
                <div className="animate-pulse" style={{ fontSize: '1.25rem', fontWeight: '600', color: '#6b7280' }}>
                    Loading summary data...
                </div>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div style={{
                backgroundColor: '#fee2e2',
                height: '100%',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '2rem'
            }}>
                <div style={{ textAlign: 'center', color: '#991b1b' }}>
                    <div style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '0.5rem' }}>Error Loading Slide</div>
                    <div>{error || 'Unknown error occurred'}</div>
                </div>
            </div>
        );
    }

    return (
        <div style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: 'url("https://www.e-consystems.com/images/weekly-tracker/background.png")',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            fontFamily: '"Segoe UI", system-ui, sans-serif'
        }}>
            {/* Dark Overlay */}
            <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)' }} />

            <div style={{
                position: 'relative',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                padding: '4rem 6rem',
                color: 'white'
            }}>
                {/* Main Title */}
                <h1 style={{ 
                    fontSize: '4.5rem', 
                    fontWeight: '800', 
                    marginBottom: '1rem',
                    textShadow: '2px 4px 12px rgba(0,0,0,0.5)'
                }}>
                {fy} Weekly Tracker Overview{data.week ? ` - Week ${data.week}` : ''}
                </h1>
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
