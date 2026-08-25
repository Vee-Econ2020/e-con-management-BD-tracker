import { useEffect, useState, useRef } from 'react';
import Plot from 'react-plotly.js';
import Plotly from 'plotly.js-dist-min';

interface PipelineChartProps {
    data: any;
    title: string;
    slideNo?: number;
    isEditing?: boolean;
    hideTargets?: boolean;
}

interface SlideInput {
    id?: string;
    slide_no: number;
    table_name: string;
    freeform_text: string;
    row_index?: number;
    week_recorded?: number;
    date_updated?: string;
    region?: string;
    service_type?: string;
}

const REGION_OPTIONS = [
    'Overall',
    'US West',
    'Europe',
    'US East',
    'ASEAN',
    'Japan',
    'KANZ',
    'Management',
    'APAC'
];

const SERVICE_OPTIONS = ['ALL', 'Services'];

const getInitialRegionForSlide = (sNo?: number): string => {
    if (!sNo) return 'Overall';
    if (sNo === 9 || sNo === 9001) return 'US West';
    if (sNo === 12 || sNo === 12001) return 'Europe';
    if (sNo === 15 || sNo === 15001) return 'US East';
    if (sNo === 18 || sNo === 18001) return 'ASEAN';
    if (sNo === 21 || sNo === 21001) return 'Japan';
    if (sNo === 24 || sNo === 24001) return 'KANZ';
    if (sNo === 27 || sNo === 27001) return 'Management';
    if (sNo === 30 || sNo === 30001) return 'APAC';
    return 'Overall';
};

export function PipelineComparisonChart({ data, title, slideNo, isEditing = false, hideTargets = false }: PipelineChartProps) {
    const plotRef = useRef<any>(null);
    const [figData, setFigData] = useState<any[]>([]);
    const [figLayout, setFigLayout] = useState<any>({});
    const [figFrames, setFigFrames] = useState<any[]>([]);

    // Manual inputs state
    const [pipelineItems, setPipelineItems] = useState<SlideInput[]>([]);
    const [pipelineLostItems, setPipelineLostItems] = useState<SlideInput[]>([]);
    const [newPipelineItems, setNewPipelineItems] = useState<SlideInput[]>([]);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editText, setEditText] = useState('');
    const [editRegion, setEditRegion] = useState('Overall');
    const [editServiceType, setEditServiceType] = useState('ALL');

    const [newPipelineText, setNewPipelineText] = useState('');
    const [newPipelineLostText, setNewPipelineLostText] = useState('');
    const [newNewPipelineText, setNewNewPipelineText] = useState('');

    const [newRegionMap, setNewRegionMap] = useState<Record<string, string>>({});
    const [newServiceTypeMap, setNewServiceTypeMap] = useState<Record<string, string>>({});

    // Week validation state
    const [currentSystemWeek, setCurrentSystemWeek] = useState<number | null>(null);
    const [chartDataWeek, setChartDataWeek] = useState<number | null>(null);

    // Fetch manual inputs and current week
    useEffect(() => {
        if (slideNo) {
            fetchInputs();
        }

        // Fetch current week for validation
        fetch('/api/week/current')
            .then(res => res.json())
            .then(d => setCurrentSystemWeek(d.week))
            .catch(err => console.error("Failed to fetch current week:", err));

    }, [slideNo]);

    const fetchInputs = async () => {
        if (!slideNo) return;
        try {
            const res = await fetch(`/api/admin/slide-inputs/${slideNo}`);
            const items: SlideInput[] = await res.json();
            setPipelineItems(items.filter(i => i.table_name === 'pipeline_to_po'));
            setPipelineLostItems(items.filter(i => i.table_name === 'pipeline_lost'));
            setNewPipelineItems(items.filter(i => i.table_name === 'new_pipeline'));
        } catch (err) {
            console.error('Failed to fetch slide inputs:', err);
        }
    };

    const handleAddRow = async (tableName: string) => {
        if (!slideNo) return;
        const text = tableName === 'pipeline_to_po' ? newPipelineText : tableName === 'pipeline_lost' ? newPipelineLostText : newNewPipelineText;
        if (!text.trim()) return;

        const reg = newRegionMap[tableName] || getInitialRegionForSlide(slideNo);
        const stype = newServiceTypeMap[tableName] || (slideNo > 1000 ? 'Services' : 'ALL');

        try {
            const res = await fetch('/api/admin/slide-inputs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    slide_no: slideNo,
                    table_name: tableName,
                    freeform_text: text.trim(),
                    week_recorded: currentSystemWeek,
                    region: reg,
                    service_type: stype
                })
            });
            if (res.ok) {
                if (tableName === 'pipeline_to_po') setNewPipelineText('');
                else if (tableName === 'pipeline_lost') setNewPipelineLostText('');
                else setNewNewPipelineText('');
                fetchInputs();
            }
        } catch (err) {
            console.error('Failed to add input:', err);
        }
    };

    const handleUpdateRow = async (item: SlideInput) => {
        if (!item.id) return;
        try {
            const res = await fetch(`/api/admin/slide-inputs/${item.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    slide_no: item.slide_no,
                    table_name: item.table_name,
                    freeform_text: editText,
                    row_index: item.row_index,
                    week_recorded: currentSystemWeek,
                    region: editRegion,
                    service_type: editServiceType
                })
            });
            if (res.ok) {
                setEditingId(null);
                setEditText('');
                fetchInputs();
            }
        } catch (err) {
            console.error('Failed to update input:', err);
        }
    };

    const handleDeleteRow = async (id: string) => {
        try {
            const res = await fetch(`/api/admin/slide-inputs/${id}`, { method: 'DELETE' });
            if (res.ok) {
                fetchInputs();
            }
        } catch (err) {
            console.error('Failed to delete input:', err);
        }
    };

    useEffect(() => {
        if (!data) return;

        const { weeks, actual_pipeline, weighted_pipeline, stretch_target, base_target, styles, annotations, current_week } = data;

        // set chart data week from backend response
        if (current_week) {
            setChartDataWeek(current_week);
        }

        // Initial Traces
        const initialTraces = [
            {
                x: weeks, y: data.enable_animation === false ? actual_pipeline : new Array(weeks.length).fill(0),
                name: styles.Actual.name, type: 'bar', marker: { color: styles.Actual.color },
                text: data.enable_animation === false ? actual_pipeline.map((val: number) => val > 0 ? `$${(val / 1e6).toFixed(2)}M` : '') : [], textposition: 'outside'
            },
            {
                x: weeks, y: data.enable_animation === false ? weighted_pipeline : new Array(weeks.length).fill(0),
                name: styles.Weighted.name, type: 'bar', marker: { color: styles.Weighted.color },
                text: data.enable_animation === false ? weighted_pipeline.map((val: number) => val > 0 ? `$${(val / 1e6).toFixed(2)}M` : '') : [], textposition: 'outside'
            },
            {
                x: weeks, y: new Array(weeks.length).fill(stretch_target),
                mode: 'lines', line: { color: styles.Stretch.color, width: 2, dash: 'dash' },
                name: styles.Stretch.name, type: 'scatter'
            }
        ];

        // Frame Generation
        const frames: any[] = [];
        const totalSteps = 40;

        for (let step = 1; step <= totalSteps; step++) {
            const t = step / totalSteps;

            const frameActual = actual_pipeline.map((val: number) => val * t);
            const frameWeighted = weighted_pipeline.map((val: number) => val * t);

            const actualLabels = actual_pipeline.map((val: number) => (val > 0 && step > totalSteps * 0.8) ? `$${(val / 1e6).toFixed(2)}M` : '');
            const weightedLabels = weighted_pipeline.map((val: number) => (val > 0 && step > totalSteps * 0.8) ? `$${(val / 1e6).toFixed(2)}M` : '');

            frames.push({
                data: [
                    { y: frameActual, text: actualLabels },
                    { y: frameWeighted, text: weightedLabels },
                    { y: new Array(weeks.length).fill(stretch_target) }
                ],
                name: `frame_${step}`
            });
        }

        const maxVal = Math.max(
            hideTargets ? 0 : stretch_target,
            hideTargets ? 0 : base_target,
            ...actual_pipeline,
            ...weighted_pipeline,
            1
        );

        // Services-only: drop the stretch target line trace and target-colored annotations.
        const stretchColor = styles.Stretch?.color;
        const baseColor = styles.Base?.color;
        const filteredAnnotations = hideTargets
            ? annotations.filter((ann: any) => {
                const c = ann.font?.color;
                return c !== stretchColor && c !== baseColor;
            })
            : annotations;
        const finalInitialTraces = hideTargets ? initialTraces.slice(0, 2) : initialTraces;
        const finalFrames = hideTargets
            ? frames.map((f: any) => ({ ...f, data: f.data.slice(0, 2) }))
            : frames;

        setFigData(finalInitialTraces);
        setFigFrames(finalFrames);

        setFigLayout({
            autosize: true,
            title: {
                text: title,
                font: { size: 24, family: 'Helvetica', weight: 'bold' },
                x: 0.5, xanchor: 'center'
            },
            xaxis: {
                showgrid: false, zeroline: false,
                tickfont: { size: 12, family: 'Helvetica' }
            },
            yaxis: {
                tickformat: '$,.0f', showgrid: true, gridcolor: 'rgba(200,200,200,0.3)', zeroline: false,
                range: [0, maxVal * 1.15]
            },
            barmode: 'group',
            bargap: 0.3,
            bargroupgap: 0.1,
            legend: {
                x: 0.5, y: -0.2, xanchor: 'center', orientation: 'h',
                bgcolor: 'rgba(255,255,255,0.9)', bordercolor: 'rgba(0,0,0,0.1)', borderwidth: 1,
                font: { size: 12, family: 'Helvetica' }
            },
            margin: { l: 70, r: 80, t: 70, b: 100 },
            annotations: filteredAnnotations,
            font: { family: 'Helvetica, Arial, sans-serif' },
            template: 'plotly_white'
        });

        const timer = setTimeout(() => {
            if (data.enable_animation !== false && plotRef.current && frames.length > 0) {
                // @ts-ignore
                Plotly.animate(plotRef.current.el, frames, {
                    frame: { duration: 40, redraw: true },
                    transition: { duration: 0 },
                    mode: 'immediate'
                });
            }
        }, 1000);

        return () => clearTimeout(timer);
    }, [data, title, hideTargets]);

    // ─── Render a text-box table (Pipeline to PO / Pushout) ───
    const renderInputTable = (
        tableName: string,
        label: string,
        items: SlideInput[],
        headerColor: string,
        newText: string,
        setNewText: (v: string) => void
    ) => {
        const currentNewRegion = newRegionMap[tableName] || getInitialRegionForSlide(slideNo);
        const currentNewServiceType = newServiceTypeMap[tableName] || (slideNo && slideNo > 1000 ? 'Services' : 'ALL');

        return (
            <div style={{
                border: `2px solid ${headerColor}`,
                borderRadius: '6px',
                overflow: 'hidden',
                marginBottom: '0.5rem',
                fontSize: '0.75rem',
                minWidth: '220px'
            }}>
                {/* Header */}
                <div style={{
                    backgroundColor: headerColor,
                    color: '#fff',
                    fontWeight: '700',
                    padding: '6px 10px',
                    fontSize: '0.8rem',
                    textAlign: 'center'
                }}>
                    {label}
                </div>

                {/* Rows */}
                {items.map((item, idx) => (
                    <div key={item.id || idx} style={{
                        display: 'flex',
                        flexDirection: editingId === item.id ? 'column' : 'row',
                        alignItems: editingId === item.id ? 'stretch' : 'center',
                        borderBottom: '1px solid #e5e7eb',
                        padding: '4px 8px',
                        gap: '4px',
                        minHeight: '28px'
                    }}>
                        {editingId === item.id ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%' }}>
                                <input
                                    value={editText}
                                    onChange={e => setEditText(e.target.value)}
                                    style={{
                                        width: '100%',
                                        border: '1px solid #93c5fd',
                                        borderRadius: '4px',
                                        padding: '2px 6px',
                                        fontSize: '0.75rem',
                                        outline: 'none'
                                    }}
                                    autoFocus
                                    onKeyDown={e => { if (e.key === 'Enter') handleUpdateRow(item); }}
                                />
                                <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                    <select
                                        value={editRegion}
                                        onChange={e => setEditRegion(e.target.value)}
                                        style={{
                                            flex: 1,
                                            fontSize: '0.65rem',
                                            border: '1px solid #d1d5db',
                                            borderRadius: '4px',
                                            padding: '2px'
                                        }}
                                    >
                                        {REGION_OPTIONS.map(r => (
                                            <option key={r} value={r}>{r}</option>
                                        ))}
                                    </select>
                                    <select
                                        value={editServiceType}
                                        onChange={e => setEditServiceType(e.target.value)}
                                        style={{
                                            fontSize: '0.65rem',
                                            border: '1px solid #d1d5db',
                                            borderRadius: '4px',
                                            padding: '2px'
                                        }}
                                    >
                                        {SERVICE_OPTIONS.map(s => (
                                            <option key={s} value={s}>{s}</option>
                                        ))}
                                    </select>
                                    <button
                                        onClick={() => handleUpdateRow(item)}
                                        style={{
                                            backgroundColor: '#10b981',
                                            color: '#fff',
                                            border: 'none',
                                            borderRadius: '4px',
                                            padding: '2px 6px',
                                            fontSize: '0.65rem',
                                            fontWeight: '700',
                                            cursor: 'pointer'
                                        }}
                                    >Save</button>
                                    <button
                                        onClick={() => { setEditingId(null); setEditText(''); }}
                                        style={{
                                            backgroundColor: '#9ca3af',
                                            color: '#fff',
                                            border: 'none',
                                            borderRadius: '4px',
                                            padding: '2px 6px',
                                            fontSize: '0.65rem',
                                            fontWeight: '700',
                                            cursor: 'pointer'
                                        }}
                                    >✕</button>
                                </div>
                            </div>
                        ) : (
                            <>
                                <span style={{ color: headerColor, fontWeight: '700', marginRight: '2px' }}>•</span>
                                <span style={{ flex: 1, overflowWrap: 'anywhere' }}>{item.freeform_text}</span>
                                {item.region && item.region !== 'Overall' && item.region !== 'ALL' && (
                                    <span style={{
                                        fontSize: '0.6rem',
                                        backgroundColor: '#e0f2fe',
                                        color: '#0369a1',
                                        padding: '1px 4px',
                                        borderRadius: '3px',
                                        fontWeight: 600,
                                        whiteSpace: 'nowrap'
                                    }}>
                                        {item.region}
                                    </span>
                                )}
                                {item.service_type === 'Services' && (
                                    <span style={{
                                        fontSize: '0.6rem',
                                        backgroundColor: '#fef3c7',
                                        color: '#92400e',
                                        padding: '1px 4px',
                                        borderRadius: '3px',
                                        fontWeight: 600,
                                        whiteSpace: 'nowrap'
                                    }}>
                                        Svc
                                    </span>
                                )}
                                {isEditing && (
                                    <div style={{ display: 'flex', gap: '2px', marginLeft: 'auto' }}>
                                        <button
                                            onClick={() => {
                                                setEditingId(item.id!);
                                                setEditText(item.freeform_text);
                                                setEditRegion(item.region || getInitialRegionForSlide(slideNo));
                                                setEditServiceType(item.service_type || 'ALL');
                                            }}
                                            style={{
                                                backgroundColor: '#93c5fd',
                                                color: '#1e3a8a',
                                                border: 'none',
                                                borderRadius: '4px',
                                                padding: '1px 5px',
                                                fontSize: '0.6rem',
                                                fontWeight: '700',
                                                cursor: 'pointer'
                                            }}
                                        >✎</button>
                                        <button
                                            onClick={() => handleDeleteRow(item.id!)}
                                            style={{
                                                backgroundColor: '#fca5a5',
                                                color: '#7f1d1d',
                                                border: 'none',
                                                borderRadius: '4px',
                                                padding: '1px 5px',
                                                fontSize: '0.6rem',
                                                fontWeight: '700',
                                                cursor: 'pointer'
                                            }}
                                        >✕</button>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                ))}

                {/* Empty rows for visual padding */}
                {items.length < 4 && !isEditing && Array.from({ length: 4 - items.length }).map((_, i) => (
                    <div key={`empty-${i}`} style={{
                        borderBottom: '1px solid #e5e7eb',
                        padding: '4px 8px',
                        minHeight: '28px'
                    }}>&nbsp;</div>
                ))}

                {/* Add new row (only in edit mode) */}
                {isEditing && (
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        padding: '6px 8px',
                        gap: '4px',
                        borderTop: '1px solid #e5e7eb',
                        backgroundColor: '#f9fafb'
                    }}>
                        <input
                            value={newText}
                            onChange={e => setNewText(e.target.value)}
                            placeholder="Add new entry..."
                            style={{
                                width: '100%',
                                border: '1px solid #d1d5db',
                                borderRadius: '4px',
                                padding: '3px 6px',
                                fontSize: '0.7rem',
                                outline: 'none'
                            }}
                            onKeyDown={e => { if (e.key === 'Enter') handleAddRow(tableName); }}
                        />
                        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                            <select
                                value={currentNewRegion}
                                onChange={e => setNewRegionMap(prev => ({ ...prev, [tableName]: e.target.value }))}
                                style={{
                                    flex: 1,
                                    fontSize: '0.65rem',
                                    border: '1px solid #d1d5db',
                                    borderRadius: '4px',
                                    padding: '2px'
                                }}
                                title="Region Selection"
                            >
                                {REGION_OPTIONS.map(r => (
                                    <option key={r} value={r}>{r}</option>
                                ))}
                            </select>
                            <select
                                value={currentNewServiceType}
                                onChange={e => setNewServiceTypeMap(prev => ({ ...prev, [tableName]: e.target.value }))}
                                style={{
                                    fontSize: '0.65rem',
                                    border: '1px solid #d1d5db',
                                    borderRadius: '4px',
                                    padding: '2px'
                                }}
                                title="Services or ALL"
                            >
                                {SERVICE_OPTIONS.map(s => (
                                    <option key={s} value={s}>{s}</option>
                                ))}
                            </select>
                            <button
                                onClick={() => handleAddRow(tableName)}
                                style={{
                                    backgroundColor: '#3b82f6',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: '4px',
                                    padding: '2px 8px',
                                    fontSize: '0.65rem',
                                    fontWeight: '700',
                                    cursor: 'pointer'
                                }}
                            >+ Add</button>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    // Warning logic
    const showWarning = isEditing && currentSystemWeek !== null && chartDataWeek !== null && chartDataWeek < currentSystemWeek;

    return (
        <div style={{
            backgroundColor: '#ffffff',
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            padding: '1rem',
            overflow: 'hidden',
            position: 'relative' // for validation layer
        }}>
            {/* Warning Banner */}
            {showWarning && (
                <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    backgroundColor: '#fee2e2',
                    color: '#991b1b',
                    padding: '0.5rem',
                    textAlign: 'center',
                    fontWeight: '700',
                    zIndex: 10,
                    fontSize: '0.9rem',
                    borderBottom: '2px solid #ef4444'
                }}>
                    ⚠️ WARNING: Chart data is from Week {chartDataWeek}, but current week is Week {currentSystemWeek}. Please update chart data!
                </div>
            )}

            <div style={{
                display: 'flex',
                flex: 1,
                width: '100%',
                gap: '0.5rem'
            }}>
                {/* Chart area */}
                <div style={{ flex: 1, minWidth: 0 }}>
                    <Plot
                        ref={plotRef}
                        data={figData}
                        layout={figLayout}
                        frames={figFrames}
                        config={{ responsive: true, displayModeBar: false, scrollZoom: false }}
                        style={{ width: '100%', height: '100%' }}
                        useResizeHandler={true}
                    />
                </div>

                {/* Side panels: Pipeline to PO + Pushout */}
                {slideNo && (
                    <div style={{
                        width: '260px',
                        flexShrink: 0,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.5rem',
                        justifyContent: 'center',
                        paddingRight: '0.5rem'
                    }}>
                        {renderInputTable(
                            'pipeline_to_po',
                            'Pipeline to PO',
                            pipelineItems,
                            '#e67e22',
                            newPipelineText,
                            setNewPipelineText
                        )}
                        {renderInputTable(
                            'pipeline_lost',
                            'Pipeline Lost',
                            pipelineLostItems,
                            '#c0392b',
                            newPipelineLostText,
                            setNewPipelineLostText
                        )}
                        {renderInputTable(
                            'new_pipeline',
                            'New Pipeline',
                            newPipelineItems,
                            '#0ea5e9',
                            newNewPipelineText,
                            setNewNewPipelineText
                        )}
                    </div>
                )}
            </div>
            <div style={{ fontFamily: 'Helvetica, Arial, sans-serif', fontWeight: 'bold', fontSize: '1.25rem', marginTop: '1rem', textAlign: 'center', color: '#374151' }}>
                8-Week Pipeline: Actual vs Weighted
            </div>
        </div>
    );
}
