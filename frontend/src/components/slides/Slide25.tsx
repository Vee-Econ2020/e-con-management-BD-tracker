import { useEffect, useState } from 'react';
import { CumulativePerformanceChart } from '../shared_charts/CumulativePerformanceChart';

export default function Slide25({ fy = "FY2027" }: { fy?: string }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchData();
    }, [fy]);

    const fetchData = async () => {
        try {
            setLoading(true);
            const response = await fetch(`/api/admin/slides/slide25?fy=${fy}`);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const result = await response.json();
            if (result.error) throw new Error(result.error);
            setData(result);
        } catch (err) {
            console.error('Failed to fetch slide 25 data:', err);
            setError(err instanceof Error ? err.message : 'Failed to load data');
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="flex items-center justify-center h-full">Loading...</div>;
    if (error) return <div className="text-red-500 text-center">Error: {error}</div>;
    if (!data) return null;

    return (
        <CumulativePerformanceChart 
            data={data} 
            title={`${fy} - Management Cumulative Performance vs Targets`} 
        />
    );
}
