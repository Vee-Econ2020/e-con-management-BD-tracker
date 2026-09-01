import { useEffect, useState } from 'react';
import { PipelineComparisonChart } from '../shared_charts/PipelineComparisonChart';

interface Slide15Props {
    isEditing?: boolean;
}

export default function Slide15({ isEditing = false , fy = "FY2027" }: Slide15Props & { fy?: string }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchData();
    }, [fy]);

    const fetchData = async () => {
        try {
            setLoading(true);
            const response = await fetch(`/api/admin/slides/slide15?fy=${fy}`);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const result = await response.json();
            if (result.error) throw new Error(result.error);
            setData(result);
        } catch (err) {
            console.error('Failed to fetch slide 15 data:', err);
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
            title="US-East - Actuals vs Weighted Pipeline"
            slideNo={15}
            isEditing={isEditing}
            fy={fy}
        />
    );
}
