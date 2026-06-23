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
}

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
    const [newPipelineText, setNewPipelineText] = useState('');
    const [newPipelineLostText, setNewPipelineLostText] = useState('');
    const [newNewPipelineText, setNewNewPipelineText] = useState('');

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

        try {
            const res = await fetch('/api/admin/slide-inputs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    slide_no: slideNo,
                    table_name: tableName,
                    freeform_text: text.trim(),
                    week_recorded: currentSystemWeek // Explicitly pass current week if known
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
                    week_recorded: currentSystemWeek // Update week recorded on edit
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
    ) => (
        <div style={{
            border: `2px solid ${headerColor}`,
            borderRadius: '6px',
            overflow: 'hidden',
            marginBottom: '0.5rem',
            fontSize: '0.75rem',
            minWidth: '200px'
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
                    alignItems: 'center',
                    borderBottom: '1px solid #e5e7eb',
                    padding: '4px 8px',
                    gap: '4px',
                    minHeight: '28px'
                }}>
                    <span style={{ color: headerColor, fontWeight: '700', marginRight: '4px' }}>•</span>
                    {editingId === item.id ? (
                        <>
                            <input
                                value={editText}
                                onChange={e => setEditText(e.target.value)}
                                style={{
                                    flex: 1,
                                    border: '1px solid #93c5fd',
                                    borderRadius: '4px',
                                    padding: '2px 6px',
                                    fontSize: '0.75rem',
                                    outline: 'none'
                                }}
                                autoFocus
                                onKeyDown={e => { if (e.key === 'Enter') handleUpdateRow(item); }}
                            />
                            <button
                                onClick={() => handleUpdateRow(item)}
                                style={{
                                    backgroundColor: '#10b981',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: '4px',
                                    padding: '2px 8px',
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
                        </>
                    ) : (
                        <>
                            <span style={{ flex: 1 }}>{item.freeform_text}</span>
                            {isEditing && (
                                <div style={{ display: 'flex', gap: '2px' }}>
                                    <button
                                        onClick={() => { setEditingId(item.id!); setEditText(item.freeform_text); }}
                                        style={{
                                            backgroundColor: '#93c5fd',
                                            color: '#1e3a8a',
                                            border: 'none',
                                            borderRadius: '4px',
                                            padding: '1px 6px',
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
                                            padding: '1px 6px',
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
                    padding: '4px 8px',
                    gap: '4px',
                    borderTop: '1px solid #e5e7eb',
                    backgroundColor: '#f9fafb'
                }}>
                    <input
                        value={newText}
                        onChange={e => setNewText(e.target.value)}
                        placeholder="Add new entry..."
                        style={{
                            flex: 1,
                            border: '1px solid #d1d5db',
                            borderRadius: '4px',
                            padding: '3px 6px',
                            fontSize: '0.7rem',
                            outline: 'none'
                        }}
                        onKeyDown={e => { if (e.key === 'Enter') handleAddRow(tableName); }}
                    />
                    <button
                        onClick={() => handleAddRow(tableName)}
                        style={{
                            backgroundColor: '#3b82f6',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '4px',
                            padding: '2px 10px',
                            fontSize: '0.65rem',
                            fontWeight: '700',
                            cursor: 'pointer'
                        }}
                    >+ Add</button>
                </div>
            )}
        </div>
    );

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
                        width: '220px',
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
