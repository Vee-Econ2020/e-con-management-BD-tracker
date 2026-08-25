import React, { Component, ReactNode, useEffect, useState } from 'react';
import { WeeklyTrendChart } from '../shared_charts/WeeklyTrendChart';

interface InvoiceChartSlideProps {
    /** Region label for title (e.g. "Overall", "USA West"). */
    regionLabel: string;
    /** Region query parameter for API call. */
    region: string;
}

class ChartErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: string }> {
    constructor(props: { children: ReactNode }) {
        super(props);
        this.state = { hasError: false, error: '' };
    }

    static getDerivedStateFromError(error: Error) {
        return { hasError: true, error: error.message || 'Unknown error' };
    }

    componentDidCatch(error: Error, errorInfo: any) {
        console.error("Chart error boundary caught error:", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div style={{
                    backgroundColor: '#fee2e2', height: '100%', borderRadius: '8px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem',
                }}>
                    <div style={{ textAlign: 'center', color: '#991b1b' }}>
                        <div style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                            Chart rendering error
                        </div>
                        <div style={{ fontSize: '1rem' }}>{this.state.error}</div>
                    </div>
                </div>
            );
        }
        return this.props.children;
    }
}

/**
 * Slide component for displaying 8-Week Invoiced Amount Trend
 * across Overall or individual regions.
 */
export default function InvoiceChartSlide({
    regionLabel,
    region,
}: InvoiceChartSlideProps) {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        const fetchData = async () => {
            try {
                setLoading(true);
                const response = await fetch(`/api/admin/slides/invoice?region=${encodeURIComponent(region)}`);
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                const result = await response.json();
                if (result.error) throw new Error(result.error);
                if (!cancelled) {
                    setData(result);
                    setError(null);
                }
            } catch (err) {
                if (!cancelled) {
                    console.error(`Failed to fetch invoice slide data for ${region}:`, err);
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
                backgroundColor: '#ffffff',
                height: '100%',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '2rem',
            }}>
                <div style={{ textAlign: 'center', color: '#6b7280' }}>
                    <div className="animate-pulse" style={{ fontSize: '1.25rem', fontWeight: 600 }}>
                        Computing Invoicing Trend data…
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
                padding: '2rem',
            }}>
                <div style={{ textAlign: 'center', color: '#991b1b' }}>
                    <div style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                        Failed to load Invoicing chart
                    </div>
                    <div style={{ fontSize: '1rem' }}>{error}</div>
                </div>
            </div>
        );
    }

    return (
        <ChartErrorBoundary>
            <WeeklyTrendChart
                data={data}
                title={`${regionLabel} — Invoiced Amount (8-Week Trend)`}
                hideTargets={true}
            />
        </ChartErrorBoundary>
    );
}
