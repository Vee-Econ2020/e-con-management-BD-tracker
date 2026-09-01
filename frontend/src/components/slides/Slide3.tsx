import { useEffect, useState } from 'react';
import { CumulativePerformanceChart } from '../shared_charts/CumulativePerformanceChart';

export default function Slide3({ fy = "FY2027" }: { fy?: string }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchData();
    }, [fy]);

    const fetchData = async () => {
        try {
            setLoading(true);
            const response = await fetch(`/api/admin/slides/slide3?fy=${fy}`);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const result = await response.json();
            if (result.error) throw new Error(result.error);
            setData(result);
            setError(null);
        } catch (err) {
            console.error('Failed to fetch slide 3 data:', err);
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
                <div style={{ textAlign: 'center', color: '#6b7280' }}>
                    <div className="animate-pulse" style={{ fontSize: '1.25rem', fontWeight: '600' }}>
                        Computing cumulative performance...
                    </div>
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
                    <div style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '0.5rem' }}>
                        Failed to load cumulative chart
                    </div>
                    <div style={{ fontSize: '1rem' }}>{error}</div>
                </div>
            </div>
        );
    }

    return (
        <CumulativePerformanceChart
            data={data}
            title={`${fy} - Cumulative Performance vs Targets`}
        />
    );
}
