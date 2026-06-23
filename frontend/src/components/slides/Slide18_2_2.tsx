import { useEffect, useState } from 'react';
import { OrderBacklogChart } from '../shared_charts/OrderBacklogChart';

export default function Slide18_2_2() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const response = await fetch('/api/admin/slides/order-backlog?region=Asean');
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const result = await response.json();
            if (result.error) throw new Error(result.error);
            setData(result);
            setError(null);
        } catch (err) {
            console.error('Failed to fetch ASEAN order backlog data:', err);
            setError(err instanceof Error ? err.message : 'Failed to load data');
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div style={{ backgroundColor: '#ffffff', height: '100%', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
                <div style={{ textAlign: 'center', color: '#6b7280' }}>
                    <div className="animate-pulse" style={{ fontSize: '1.25rem', fontWeight: '600' }}>Loading order backlog...</div>
                </div>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div style={{ backgroundColor: '#fee2e2', height: '100%', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
                <div style={{ textAlign: 'center', color: '#991b1b' }}>
                    <div style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '0.5rem' }}>Failed to load order backlog chart</div>
                    <div style={{ fontSize: '1rem' }}>{error}</div>
                </div>
            </div>
        );
    }

    return <OrderBacklogChart data={data} title="Order Backlog ASEAN" />;
}
