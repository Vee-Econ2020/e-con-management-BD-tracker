
import os

output_dir = r"d:\OneDrive - e-con Systems India Pvt Ltd\Documents\Management AUTOMATION\frontend\src\components\slides"

def create_slide(slide_num, chart_type, title, endpoint_id):
    import_comp = ""
    comp_name = ""
    if chart_type == "Cumulative":
        import_comp = "import { CumulativePerformanceChart } from '../shared_charts/CumulativePerformanceChart';"
        comp_name = "CumulativePerformanceChart"
    elif chart_type == "Trend":
        import_comp = "import { WeeklyTrendChart } from '../shared_charts/WeeklyTrendChart';"
        comp_name = "WeeklyTrendChart"
    elif chart_type == "Pipeline":
        import_comp = "import { PipelineComparisonChart } from '../shared_charts/PipelineComparisonChart';"
        comp_name = "PipelineComparisonChart"

    content = f"""import {{ useEffect, useState }} from 'react';
{import_comp}

export default function Slide{slide_num}() {{
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {{
        fetchData();
    }}, []);

    const fetchData = async () => {{
        try {{
            setLoading(true);
            const response = await fetch('/api/admin/slides/slide{endpoint_id}');
            if (!response.ok) throw new Error(`HTTP ${{response.status}}`);
            const result = await response.json();
            if (result.error) throw new Error(result.error);
            setData(result);
        }} catch (err) {{
            console.error('Failed to fetch slide {endpoint_id} data:', err);
            setError(err instanceof Error ? err.message : 'Failed to load data');
        }} finally {{
            setLoading(false);
        }}
    }};

    if (loading) return <div className="flex items-center justify-center h-full">Loading...</div>;
    if (error) return <div className="text-red-500 text-center">Error: {{error}}</div>;
    if (!data) return null;

    return (
        <{comp_name} 
            data={{data}} 
            title="{title}" 
        />
    );
}}
"""
    return content

def refactor_us_west():
    # Slide 7: Cumulative
    s7 = create_slide(7, "Cumulative", "FY2027 - US-West Cumulative Performance vs Targets", 7)
    with open(os.path.join(output_dir, "Slide7.tsx"), "w", encoding="utf-8") as f:
        f.write(s7)
        
    # Slide 8: Trend
    s8 = create_slide(8, "Trend", "Weekly Comparison - US-West Tracking", 8)
    with open(os.path.join(output_dir, "Slide8.tsx"), "w", encoding="utf-8") as f:
        f.write(s8)
        
    # Slide 9: Pipeline
    s9 = create_slide(9, "Pipeline", "US-West - Actuals vs Weighted Pipeline", 9)
    with open(os.path.join(output_dir, "Slide9.tsx"), "w", encoding="utf-8") as f:
        f.write(s9)
        
    print("Refactored Slide7, Slide8, Slide9")

if __name__ == "__main__":
    refactor_us_west()
