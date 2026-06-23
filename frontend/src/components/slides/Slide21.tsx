import { useEffect, useState } from 'react';
import { PipelineComparisonChart } from '../shared_charts/PipelineComparisonChart';

interface Slide21Props {
    isEditing?: boolean;
}

export default function Slide21({ isEditing = false }: Slide21Props) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const response = await fetch('/api/admin/slides/slide21');
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const result = await response.json();
            if (result.error) throw new Error(result.error);
            setData(result);
        } catch (err) {
            console.error('Failed to fetch slide 21 data:', err);
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
            title="Japan - Actuals vs Weighted Pipeline"
            slideNo={21}
            isEditing={isEditing}
        />
    );
}
