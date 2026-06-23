import { useEffect, useState } from 'react';

interface RegionInputTableProps {
    title: string;
    slideId: string;
    isEditing: boolean;
}

interface ActivityInput {
    id?: string;
    slide_id?: string;
    slide_no?: number | string;
    table_name: string;
    week_recorded: number;
    freeform_text: string;
    row_index?: number;
}

const ROW_CONFIG = [
    { id: 'pos_won_50k', label: "PO's WON (>50K)", icon: '🏆' },
    { id: 'rfqs_received', label: "RFQs Received", icon: '📨' },
    { id: 'proposals_given', label: "Proposals Given", icon: '📋' },
    { id: 'po_pending_count', label: "Total No of PO Pending", icon: '⏳' },
    { id: 'awaiting_po', label: "Awaiting PO This Week", icon: '📌' },
    { id: 'po_closed_lost', label: "PO Closed Lost", icon: '❌' },
    { id: 'pending_opps_count', label: "Total Pending Opportunities", icon: '🔢' },
    { id: 'pending_opps_value', label: "Total Pending Opportunities Values", icon: '💰' },
];

export function RegionInputTableSlide({ title, slideId, isEditing }: RegionInputTableProps) {
    const [currentWeek, setCurrentWeek] = useState<number | null>(null);
    const [lastWeekData, setLastWeekData] = useState<Record<string, string>>({});
    const [currentWeekData, setCurrentWeekData] = useState<Record<string, string>>({});
    const [currentWeekIds, setCurrentWeekIds] = useState<Record<string, string>>({});
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
            const allInputs: ActivityInput[] = await res.json();

            const lastWeek = currentWeek - 1;
            const lastMap: Record<string, string> = {};
            const currentMap: Record<string, string> = {};
            const idMap: Record<string, string> = {};

            allInputs.forEach(i => {
                if (i.week_recorded === lastWeek) {
                    lastMap[i.table_name] = i.freeform_text;
                }
                if (i.week_recorded === currentWeek) {
                    currentMap[i.table_name] = i.freeform_text;
                    if (i.id) idMap[i.table_name] = i.id;
                }
            });

            setLastWeekData(lastMap);
            setCurrentWeekData(currentMap);
            setCurrentWeekIds(idMap);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const refetchIds = async () => {
        if (currentWeek === null) return;
        const res = await fetch(`/api/admin/slide-inputs/${slideId}`);
        const allInputs: ActivityInput[] = await res.json();
        const idMap: Record<string, string> = {};
        const lastWeek = currentWeek - 1;
        const lastMap: Record<string, string> = {};
        const currentMap: Record<string, string> = {};

        allInputs.forEach(i => {
            if (i.week_recorded === lastWeek) lastMap[i.table_name] = i.freeform_text;
            if (i.week_recorded === currentWeek) {
                currentMap[i.table_name] = i.freeform_text;
                if (i.id) idMap[i.table_name] = i.id;
            }
        });

        setLastWeekData(lastMap);
        setCurrentWeekData(currentMap);
        setCurrentWeekIds(idMap);
    };

    const handleBlur = async (tableName: string, value: string) => {
        if (currentWeek === null) return;
        const entryId = currentWeekIds[tableName];
        const payload = {
            slide_id: slideId,
            table_name: tableName,
            freeform_text: value,
            week_recorded: currentWeek
        };
        try {
            if (entryId) {
                await fetch(`/api/admin/slide-inputs/${entryId}`, {
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
                if (res.ok) refetchIds();
            }
        } catch (err) {
            console.error("Failed to save input:", err);
        }
    };

    const parts = title.split(' - ');
    const regionName = parts[0] || title;
    const slideType = parts[1] || '';

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
            {/* ══════ HEADER ══════ */}
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
                    {slideType && <span style={{ color: '#64748b', marginLeft: '0.8rem', fontWeight: 600 }}>— {slideType}</span>}
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

            {/* ══════ CONTENT AREA ══════ */}
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
                    {/* Headers */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: '1.2fr 2fr 2fr',
                        background: '#f8fafc',
                        borderBottom: '2px solid #e2e8f0',
                        flexShrink: 0,
                    }}>
                        <div style={{ padding: '2vh 1.5vw', fontSize: 'clamp(0.7rem, 1.5vh, 1rem)', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                            Activity Metric
                        </div>
                        <div style={{
                            padding: '2vh 1.5vw',
                            background: 'linear-gradient(135deg, #1e40af, #3b82f6)',
                            color: 'white',
                            textAlign: 'center',
                            fontSize: 'clamp(0.8rem, 2vh, 1.2rem)',
                            fontWeight: 800,
                            letterSpacing: '0.05em',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.8rem'
                        }}>
                            LAST WEEK {currentWeek !== null ? currentWeek - 1 : ''}
                        </div>
                        <div style={{
                            padding: '2vh 1.5vw',
                            background: 'linear-gradient(135deg, #059669, #10b981)',
                            color: 'white',
                            textAlign: 'center',
                            fontSize: 'clamp(0.8rem, 2vh, 1.2rem)',
                            fontWeight: 800,
                            letterSpacing: '0.05em',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.8rem'
                        }}>
                            CURRENT WEEK {currentWeek !== null ? currentWeek : ''}
                        </div>
                    </div>

                    {/* Rows */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                        {ROW_CONFIG.map((row, idx) => (
                            <div key={row.id} style={{
                                flex: 1,
                                display: 'grid',
                                gridTemplateColumns: '1.2fr 2fr 2fr',
                                borderBottom: idx < ROW_CONFIG.length - 1 ? '1px solid #f1f5f9' : 'none',
                                background: idx % 2 === 0 ? '#fff' : '#fafbfc',
                            }}>
                                {/* Metric */}
                                <div style={{
                                    paddingLeft: '2vw',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '1rem',
                                    borderRight: '1px solid #f1f5f9'
                                }}>
                                    <span style={{ fontSize: 'clamp(1rem, 2.5vh, 1.8rem)' }}>{row.icon}</span>
                                    <span style={{
                                        fontSize: 'clamp(0.8rem, 1.8vh, 1.2rem)',
                                        fontWeight: 700,
                                        color: '#334155'
                                    }}>
                                        {row.label}
                                    </span>
                                </div>

                                {/* Last Week */}
                                <div style={{
                                    padding: '1.5vh 2vw',
                                    borderRight: '1px solid #f1f5f9',
                                    borderLeft: '4px solid #3b82f6',
                                    background: lastWeekData[row.id] ? 'rgba(59, 130, 246, 0.03)' : 'transparent',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    textAlign: 'center',
                                }}>
                                    <span style={{
                                        fontSize: 'clamp(0.85rem, 2vh, 1.4rem)',
                                        color: '#1e3a8a',
                                        fontWeight: 600,
                                        whiteSpace: 'pre-wrap',
                                        lineHeight: 1.4
                                    }}>
                                        {lastWeekData[row.id] || ''}
                                    </span>
                                </div>

                                {/* Current Week */}
                                <div style={{
                                    borderLeft: '4px solid #10b981',
                                    background: isEditing ? 'rgba(16, 185, 129, 0.04)' : (currentWeekData[row.id] ? 'rgba(16, 185, 129, 0.02)' : 'transparent'),
                                    display: 'flex',
                                    alignItems: 'stretch',
                                }}>
                                    {isEditing ? (
                                        <textarea
                                            value={currentWeekData[row.id] || ''}
                                            placeholder="..."
                                            onChange={(e) => setCurrentWeekData(p => ({ ...p, [row.id]: e.target.value }))}
                                            onBlur={(e) => handleBlur(row.id, e.target.value)}
                                            style={{
                                                width: '100%',
                                                height: '100%',
                                                border: 'none',
                                                outline: 'none',
                                                background: 'transparent',
                                                padding: '1.5vh 2vw',
                                                fontSize: 'clamp(0.85rem, 2vh, 1.4rem)',
                                                fontWeight: 600,
                                                color: '#064e3b',
                                                resize: 'none',
                                                fontFamily: 'inherit',
                                                textAlign: 'center',
                                                display: 'flex',
                                                alignItems: 'center'
                                            }}
                                        />
                                    ) : (
                                        <div style={{
                                            padding: '1.5vh 2vw',
                                            width: '100%',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            textAlign: 'center',
                                            fontSize: 'clamp(0.85rem, 2vh, 1.4rem)',
                                            color: '#064e3b',
                                            fontWeight: 600,
                                            whiteSpace: 'pre-wrap',
                                            lineHeight: 1.4
                                        }}>
                                            {currentWeekData[row.id] || ''}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div style={{
                padding: '0 3vw 1vh',
                display: 'flex',
                justifyContent: 'center',
                gap: '3vw',
                opacity: 0.6,
                flexShrink: 0,
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#3b82f6' }} />
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569' }}>Last Week</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#10b981' }} />
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569' }}>Current Week</span>
                </div>
            </div>

            <style>{`
                @keyframes pulse {
                    0% { opacity: 1; }
                    50% { opacity: 0.6; }
                    100% { opacity: 1; }
                }
            `}</style>
        </div>
    );
}
