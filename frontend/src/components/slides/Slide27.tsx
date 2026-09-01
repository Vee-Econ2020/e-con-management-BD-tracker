import { useEffect, useState } from 'react';
import { PipelineComparisonChart } from '../shared_charts/PipelineComparisonChart';

interface Slide27Props {
    isEditing?: boolean;
}

export default function Slide27({ isEditing = false , fy = "FY2027" }: Slide27Props & { fy?: string }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchData();
    }, [fy]);

    const fetchData = async () => {
        try {
            setLoading(true);
            const response = await fetch(`/api/admin/slides/slide27?fy=${fy}`);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const result = await response.json();
            if (result.error) throw new Error(result.error);
            setData(result);
        } catch (err) {
            console.error('Failed to fetch slide 27 data:', err);
            setError(err instanceof Error ? err.message : 'Failed to load data');
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="flex items-center justify-center h-full">Loading...</div>;
    if (error) return <div className="text-red-500 text-center">Error: {error}</div>;
    if (!data) return null;

    return (
        <PipelineComparisonChart
            data={data}
            title="Management - Actuals vs Weighted Pipeline"
            slideNo={27}
            isEditing={isEditing}
            fy={fy}
        />
    );
}
