import { useEffect, useState } from 'react';
import { CumulativePerformanceChart } from '../shared_charts/CumulativePerformanceChart';
import { WeeklyTrendChart } from '../shared_charts/WeeklyTrendChart';
import { PipelineComparisonChart } from '../shared_charts/PipelineComparisonChart';

export type ServicesChartKind = 'cumulative' | 'trend' | 'pipeline';

interface ServicesChartSlideProps {
    /** Parent (non-services) slide number — used to fetch /slides/services/{slideNo}. */
    slideNo: number;
    /** Which shared chart to render. */
    chartKind: ServicesChartKind;
    /** Region label used to build the chart title (e.g. "Overall", "US West"). */
    regionLabel: string;
    /** Whether the parent pipeline slide is currently in CMS edit mode. Only used for pipeline. */
    isEditing?: boolean;
}

/**
 * Generic Services-only chart slide. Fetches data from
 * `/api/admin/slides/services/{slideNo}` (which filters by OPP_Type='Service')
 * and renders the matching shared chart with `hideTargets` enabled.
 *
 * Pipeline edits are keyed off `slideNo + "_services"` so they do not collide
 * with the parent slide's manual entries in the shared `weekly_tracker_user_input`
 * collection.
 */
export default function ServicesChartSlide({ slideNo,
    chartKind,
    regionLabel,
    isEditing = false,
    fy = "FY2027" }: ServicesChartSlideProps & { fy?: string }) {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        const fetchData = async () => {
            try {
                setLoading(true);
                const response = await fetch(`/api/admin/slides/services/${slideNo}?fy=${fy}`);
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                const result = await response.json();
                if (result.error) throw new Error(result.error);
                if (!cancelled) {
                    setData(result);
                    setError(null);
                }
            } catch (err) {
                if (!cancelled) {
                    console.error(`Failed to fetch services slide ${slideNo} data:`, err);
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
    }, [slideNo, fy]);

    if (loading) {
        return (
            <div style={{
                backgroundColor: '#ffffff', height: '100%', borderRadius: '8px',
                display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem',
            }}>
                <div style={{ textAlign: 'center', color: '#6b7280' }}>
                    <div className="animate-pulse" style={{ fontSize: '1.25rem', fontWeight: 600 }}>
                        Computing Services-only chart…
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
                        Failed to load Services chart
                    </div>
                    <div style={{ fontSize: '1rem' }}>{error}</div>
                </div>
            </div>
        );
    }

    const titleByKind: Record<ServicesChartKind, string> = {
        cumulative: `${regionLabel} — Services Cumulative Performance (${fy})`,
        trend: `${regionLabel} — Services 8-Week Trend`,
        pipeline: `${regionLabel} — Services Pipeline (Actual vs Weighted)`,
    };
    const title = titleByKind[chartKind];

    // Services slides usually hide targets (no dedicated services target category);
    // backend sets `has_targets: true` when a services-specific target IS available
    // (currently only Overall via the "Overall - Serivces" target category).
    const hideTargets = !data.has_targets;

    if (chartKind === 'cumulative') {
        return <CumulativePerformanceChart data={data} title={title} hideTargets={hideTargets} />;
    }
    if (chartKind === 'trend') {
        return <WeeklyTrendChart data={data} title={title} hideTargets={hideTargets} />;
    }
    // pipeline — pass a synthetic slideNo so manual edits are stored separately
    // from the parent (non-services) pipeline slide.
    return (
        <PipelineComparisonChart
            data={data}
            title={title}
            slideNo={slideNo * 1000 + 1}
            isEditing={isEditing}
            hideTargets={hideTargets}
            fy={fy}
        />
    );
}
