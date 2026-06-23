
import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';

interface ActionItemsSlideProps {
    title: string;
    slideId: string;
    isEditing: boolean;
}



// Helper to structure raw inputs into row objects
// We store columns separately in DB: table_name="action_item", table_name="status"
// with same row_index.
interface RawInput {
    id: string;
    table_name: string;
    freeform_text: string;
    row_index: number;
    week_recorded: number;
}

export function ActionItemsSlide({ title, slideId, isEditing }: ActionItemsSlideProps) {
    const [currentWeek, setCurrentWeek] = useState<number | null>(null);
    const [rows, setRows] = useState<any[]>([]); // Array of row objects { index, lastWeekItem, status, currentItem, statusId, currentItemId }
    const [, setLoading] = useState(false);

    useEffect(() => {
        fetch('/api/week/current')
            .then(res => res.json())
            .then(d => setCurrentWeek(d.week))
            .catch(err => console.error("Failed to fetch current week:", err));
    }, []);

    useEffect(() => {
        if (currentWeek !== null) {
            fetchData();
        }
    }, [currentWeek, slideId]);

    const fetchData = async () => {
        if (currentWeek === null) return;
        setLoading(true);
        try {
            const res = await fetch(`/api/admin/slide-inputs/${slideId}`);
            if (!res.ok) throw new Error("Failed to fetch inputs");
            const allInputs: RawInput[] = await res.json();

            // We need to construct rows based on row_index.
            // We need Last Week's "action_item" to show in "Last Week Action Item".
            // We need Current Week's "status" and "action_item" to show/edit.

            const lastWeek = currentWeek - 1;

            // Group by row_index
            const rowMap = new Map<number, any>();

            // Process Last Week (Read Only)
            allInputs
                .filter(i => i.week_recorded === lastWeek && i.table_name === 'action_item')
                .forEach(i => {
                    const r = rowMap.get(i.row_index) || { index: i.row_index };
                    r.lastWeekItem = i.freeform_text;
                    rowMap.set(i.row_index, r);
                });

            // Process Current Week
            allInputs
                .filter(i => i.week_recorded === currentWeek)
                .forEach(i => {
                    const r = rowMap.get(i.row_index) || { index: i.row_index };
                    if (i.table_name === 'action_item') {
                        r.currentItem = i.freeform_text;
                        r.currentItemId = i.id;
                    } else if (i.table_name === 'status') {
                        r.status = i.freeform_text;
                        r.statusId = i.id;
                    }
                    rowMap.set(i.row_index, r);
                });

            // Convert map to array and sort by index
            const sortedRows = Array.from(rowMap.values()).sort((a, b) => a.index - b.index);

            // If no rows and editing, maybe add empty? Or just let user add.
            if (sortedRows.length === 0 && isEditing) {
                // optional: setRows([{ index: 0 }]);
            } else {
                setRows(sortedRows);
            }

        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (rowIndex: number, type: 'status' | 'action_item', value: string, existingId?: string) => {
        if (currentWeek === null) return;

        const payload = {
            slide_id: slideId,
            table_name: type,
            freeform_text: value,
            row_index: rowIndex, // Important for row mapping
            week_recorded: currentWeek
        };

        try {
            if (existingId) {
                await fetch(`/api/admin/slide-inputs/${existingId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
            } else {
                const res = await fetch('/api/admin/slide-inputs', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                if (res.ok) {
                    const newEntry = await res.json();
                    // Update state with new ID to prevent duplicate POSTs
                    setRows(prev => prev.map(r => {
                        if (r.index === rowIndex) {
                            if (type === 'status') return { ...r, statusId: newEntry.id };
                            if (type === 'action_item') return { ...r, currentItemId: newEntry.id };
                        }
                        return r;
                    }));
                }
            }
        } catch (err) {
            console.error(err);
        }
    };

    const addRow = () => {
        const newIndex = rows.length > 0 ? Math.max(...rows.map(r => r.index)) + 1 : 0;
        setRows([...rows, { index: newIndex, isNew: true }]);
    };

    // Extract title parts
    const parts = title.split(' - ');
    const regionName = parts[0] || title;
    const subTitle = "Action Items"; // Explicitly set as Action Items based on prompt

    return (
        <div style={{
            width: '100%',
            height: '100%',
            background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
            display: 'flex',
            flexDirection: 'column',
            fontFamily: "'Inter', system-ui, sans-serif",
            overflow: 'hidden',
        }}>
            {/* Header */}
            <div style={{
                padding: '1.5vh 3vw',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexShrink: 0,
            }}>
                <h1 style={{
                    margin: 0,
                    fontSize: 'clamp(1.5rem, 4vh, 2.5rem)',
                    fontWeight: 900,
                    color: '#0f172a',
                    letterSpacing: '-0.02em',
                }}>
                    {regionName}
                    <span style={{ color: '#64748b', marginLeft: '0.8rem', fontWeight: 600 }}>— {subTitle}</span>
                </h1>

                <div style={{ display: 'flex', gap: '1vw' }}>
                    <div style={{
                        background: '#1e40af',
                        color: 'white',
                        padding: '0.5vh 1.5vw',
                        borderRadius: '99px',
                        fontSize: 'clamp(0.8rem, 2vh, 1.2rem)',
                        fontWeight: 800,
                        boxShadow: '0 4px 12px rgba(30, 64, 175, 0.2)',
                    }}>
                        WEEK {currentWeek}
                    </div>
                </div>
            </div>

            {/* Content */}
            <div style={{
                flex: 1,
                padding: '0 2vw 2vh',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
            }}>
                <div style={{
                    flex: 1,
                    background: 'white',
                    borderRadius: '24px',
                    boxShadow: '0 10px 40px rgba(0,0,0,0.08)',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    border: '1px solid rgba(0,0,0,0.05)',
                }}>
                    {/* Table Header */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: '2fr 1fr 2fr', // Last Week (2), Status (1), Current Week (2)
                        background: '#f8fafc',
                        borderBottom: '2px solid #e2e8f0',
                        flexShrink: 0,
                    }}>
                        <div style={{
                            padding: '2vh 1.5vw',
                            background: 'linear-gradient(135deg, #1e40af, #3b82f6)',
                            color: 'white',
                            textAlign: 'center',
                            fontSize: 'clamp(0.8rem, 2vh, 1.2rem)',
                            fontWeight: 800,
                            letterSpacing: '0.05em',
                        }}>
                            LAST WEEK ACTION ITEM
                        </div>
                        <div style={{
                            padding: '2vh 1.5vw',
                            background: '#f1f5f9',
                            color: '#475569',
                            textAlign: 'center',
                            fontSize: 'clamp(0.8rem, 2vh, 1.2rem)',
                            fontWeight: 800,
                            letterSpacing: '0.05em',
                            borderLeft: '1px solid #e2e8f0',
                            borderRight: '1px solid #e2e8f0',
                        }}>
                            STATUS
                        </div>
                        <div style={{
                            padding: '2vh 1.5vw',
                            background: 'linear-gradient(135deg, #059669, #10b981)', // Action Items Green
                            color: 'white', // White text on dark green header
                            textAlign: 'center',
                            fontSize: 'clamp(0.8rem, 2vh, 1.2rem)',
                            fontWeight: 800,
                            letterSpacing: '0.05em',
                        }}>
                            CURRENT WEEK ACTION ITEMS
                        </div>
                    </div>

                    {/* Table Body */}
                    <div style={{ flex: 1, overflowY: 'auto' }}>
                        {rows.map((row) => (
                            <div key={row.index} style={{
                                display: 'grid',
                                gridTemplateColumns: '2fr 1fr 2fr',
                                borderBottom: '1px solid #f1f5f9',
                                minHeight: '80px',
                            }}>
                                {/* Last Week (Read Only) */}
                                <div style={{
                                    padding: '2vh 1.5vw',
                                    borderRight: '1px solid #f1f5f9',
                                    borderLeft: '4px solid #3b82f6',
                                    background: row.lastWeekItem ? 'rgba(59, 130, 246, 0.03)' : 'transparent',
                                    display: 'flex',
                                    alignItems: 'center',
                                    fontSize: 'clamp(0.85rem, 1.8vh, 1.1rem)',
                                    color: '#334155',
                                    whiteSpace: 'pre-wrap',
                                    lineHeight: 1.5
                                }}>
                                    {row.lastWeekItem || ''}
                                </div>

                                {/* Status (Editable) */}
                                <div style={{
                                    borderRight: '1px solid #f1f5f9',
                                    background: isEditing ? '#fff7ed' : '#fff',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }}>
                                    {isEditing ? (
                                        <input
                                            type="text"
                                            defaultValue={row.status || ''}
                                            placeholder="Status..."
                                            onBlur={(e) => handleSave(row.index, 'status', e.target.value, row.statusId)}
                                            style={{
                                                width: '100%',
                                                textAlign: 'center',
                                                border: 'none',
                                                outline: 'none',
                                                background: 'transparent',
                                                fontSize: 'clamp(0.85rem, 1.8vh, 1.1rem)',
                                                fontWeight: 600,
                                                color: '#d97706',
                                            }}
                                        />
                                    ) : (
                                        <span style={{
                                            fontSize: 'clamp(0.85rem, 1.8vh, 1.1rem)',
                                            fontWeight: 700,
                                            color: '#d97706', // Amber/Orange for status
                                            padding: '0.4rem 1rem',
                                            background: '#fff7ed',
                                            borderRadius: '99px',
                                            border: '1px solid #ffedd5'
                                        }}>
                                            {row.status || '-'}
                                        </span>
                                    )}
                                </div>

                                {/* Current Week (Editable) */}
                                <div style={{
                                    borderLeft: '4px solid #10b981',
                                    background: isEditing ? 'rgba(16, 185, 129, 0.04)' : 'transparent',
                                    display: 'flex',
                                    alignItems: 'stretch',
                                }}>
                                    {isEditing ? (
                                        <textarea
                                            defaultValue={row.currentItem || ''}
                                            placeholder="Enter action item..."
                                            onBlur={(e) => handleSave(row.index, 'action_item', e.target.value, row.currentItemId)}
                                            style={{
                                                width: '100%',
                                                height: '100%',
                                                border: 'none',
                                                outline: 'none',
                                                background: 'transparent',
                                                padding: '2vh 1.5vw',
                                                fontSize: 'clamp(0.85rem, 1.8vh, 1.1rem)',
                                                color: '#0f172a',
                                                resize: 'none',
                                                fontFamily: 'inherit',
                                            }}
                                        />
                                    ) : (
                                        <div style={{
                                            padding: '2vh 1.5vw',
                                            width: '100%',
                                            display: 'flex',
                                            alignItems: 'center',
                                            fontSize: 'clamp(0.85rem, 1.8vh, 1.1rem)',
                                            color: '#0f172a',
                                            whiteSpace: 'pre-wrap',
                                            lineHeight: 1.5
                                        }}>
                                            {row.currentItem || ''}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>

                    {isEditing && (
                        <div style={{ padding: '1rem', borderTop: '1px solid #e2e8f0', background: '#f8fafc' }}>
                            <button
                                onClick={addRow}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    padding: '0.6rem 1.2rem',
                                    background: 'white',
                                    border: '1px solid #cbd5e1',
                                    borderRadius: '8px',
                                    fontSize: '0.9rem',
                                    fontWeight: 600,
                                    color: '#475569',
                                    cursor: 'pointer',
                                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                                }}
                            >
                                <Plus size={16} /> Add Action Item
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

