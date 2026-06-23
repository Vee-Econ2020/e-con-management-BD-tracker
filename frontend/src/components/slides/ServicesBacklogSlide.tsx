import { useEffect, useState } from 'react';
import { OrderBacklogChart } from '../shared_charts/OrderBacklogChart';

interface ServicesBacklogSlideProps {
    /** Region name to fetch (e.g. "Overall", "Europe", "US West"). */
    region: string;
}

/**
 * Services-only Order Backlog slide. Fetches
 * `/api/admin/slides/order-backlog?region={region}&services=true`
 * which filters the orderbacklogs collection by OPP_Type='Service'.
 *
 * Hardcoded historical placeholders are skipped on the backend in this mode,
 * so the chart shows zeroes for any week where Services-tagged backlog has
 * not yet been ingested.
 */
export default function ServicesBacklogSlide({ region }: ServicesBacklogSlideProps) {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        const fetchData = async () => {
            try {
                setLoading(true);
                const url = `/api/admin/slides/order-backlog?region=${encodeURIComponent(region)}&services=true`;
                const response = await fetch(url);
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                const result = await response.json();
                if (result.error) throw new Error(result.error);
                if (!cancelled) {
                    setData(result);
                    setError(null);
                }
            } catch (err) {
                if (!cancelled) {
                    console.error(`Failed to fetch services backlog for ${region}:`, err);
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
    }, [region]);

    if (loading) {
        return (
            <div style={{
                backgroundColor: '#ffffff', height: '100%', borderRadius: '8px',
                display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem',
            }}>
                <div style={{ textAlign: 'center', color: '#6b7280' }}>
                    <div className="animate-pulse" style={{ fontSize: '1.25rem', fontWeight: 600 }}>
                        Loading Services order backlog…
                    </div>
                </div>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div style={{
                backgroundColor: '#fee2e2', height: '100%', borderRadius: '8px',
                display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem',
            }}>
                <div style={{ textAlign: 'center', color: '#991b1b' }}>
                    <div style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                        Failed to load Services order backlog
                    </div>
                    <div style={{ fontSize: '1rem' }}>{error}</div>
                </div>
            </div>
        );
    }

    return (
        <OrderBacklogChart
            data={data}
            title={`${region} — Services Order Backlog (Last 8 Weeks)`}
        />
    );
}
