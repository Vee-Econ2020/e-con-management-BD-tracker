import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, RefreshCw, X, Table, Activity, Calendar } from 'lucide-react';
import '../index.css';
import SymbTrackerUpdate from '../components/SymbTrackerUpdate';
import SymbPipelineView from '../components/SymbPipelineView';
import SymbOverallPlanView from '../components/SymbOverallPlanView';

interface SymbRecord {
    _id?: any;
    'Record Id'?: string;
    'Account Name (Opportunities Name)'?: string;
    'Committed Due date'?: string;
    'Customer Request date'?: string;
    'SO Number'?: string;
    'SO NUMBER'?: string;
    'Product Status'?: string;
    'Regular-Product Stage'?: string;
    'n-reg_stage'?: string;
    Status?: string;
    Quantity?: number | string;
    who?: string;
    week_diff?: number;
    new_flag_algo?: string;
    'recovery stage'?: string;
    file_date?: string;
    created_at?: string;
    [key: string]: any;
}

interface FlagMappingRule {
    'Regular Stage'?: string;
    blue?: string | null;
    green?: string | null;
    yellow?: string | null;
    red?: string | null;
}
export default function SymbTracker() {
    const navigate = useNavigate();
    const [records, setRecords] = useState<SymbRecord[]>([]);
    const [flagRules, setFlagRules] = useState<FlagMappingRule[]>([]);

    const [loading, setLoading] = useState<boolean>(true);
    const [fileDate, setFileDate] = useState<string>('');
    const [availableFileDates, setAvailableFileDates] = useState<string[]>([]);
    const [selectedFileDate, setSelectedFileDate] = useState<string>('');
    const [selectedMonth] = useState<string | null>(null);
    const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
    const [activeSubTab, setActiveSubTab] = useState<'symb_plan_pipeline' | 'tracker_update' | 'overall_plan'>('symb_plan_pipeline');

    const activeRecords = useMemo(() => {
        if (!selectedFileDate || selectedFileDate === fileDate) {
            return records.filter(r => !r.file_date || r.file_date === fileDate);
        }
        return records.filter(r => r.file_date === selectedFileDate);
    }, [records, selectedFileDate, fileDate]);

    // Filtered records for modal view
    const filteredRecords = useMemo(() => {
        return activeRecords.filter(rec => {
            if (selectedMonth) {
                const cdd = getCDDVal(rec);
                const recMonth = getMonthYearKey(cdd);
                if (recMonth !== selectedMonth) return false;
            }
            return true;
        });
    }, [activeRecords, selectedMonth]);

    // Total quantity sum
    const totalQuantity = useMemo(() => {
        return filteredRecords.reduce((sum, r) => {
            const qty = Number(r.Quantity) || 0;
            return sum + qty;
        }, 0);
    }, [filteredRecords]);

    const fetchSymbData = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/admin/symb-tracker/data');
            if (res.ok) {
                const data = await res.json();
                const recs: SymbRecord[] = data.records || [];
                setRecords(recs);
                setFlagRules(data.flags || []);

                const fileDatesSet = new Set<string>();
                recs.forEach(r => {
                    if (r.file_date) fileDatesSet.add(r.file_date);
                });
                const sortedFileDates = Array.from(fileDatesSet);
                setAvailableFileDates(sortedFileDates);

                if (sortedFileDates.length > 0) {
                    setFileDate(sortedFileDates[0]);
                    if (!selectedFileDate || !sortedFileDates.includes(selectedFileDate)) {
                        setSelectedFileDate(sortedFileDates[0]);
                    }
                }
            }

        } catch (err) {
            console.error('Error fetching SYMB data:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSymbData();
    }, []);

    // Build lookup for flag rules by stage name
    const flagRulesMap = useMemo(() => {
        const map: Record<string, { red: string; green: string; yellow: string; blue: string }> = {};
        flagRules.forEach(rule => {
            if (rule['Regular Stage']) {
                const stageName = rule['Regular Stage'].trim();
                map[stageName] = {
                    red: rule.red || '-',
                    green: rule.green || '-',
                    yellow: rule.yellow || '-',
                    blue: rule.blue || '-'
                };
            }
        });
        return map;
    }, [flagRules]);

    // Format date string nicely (e.g. "04 January 2027")
    const formatDatePretty = (dateStr?: string) => {
        if (!dateStr) return '-';
        try {
            const d = new Date(dateStr);
            if (isNaN(d.getTime())) return dateStr;
            return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
        } catch {
            return dateStr;
        }
    };

    // Helper to extract Committed Due Date across possible field name variations
    const getCDDVal = (rec: SymbRecord) => {
        return rec['Committed Due date'] || 
               rec['Committed_Due_date'] || 
               rec['Committed Due Date'] || 
               rec['CDD'] || 
               rec['cdd'] || 
               rec['Targeted shipment date'] ||
               rec['Customer Request date'];
    };

    // Helper to safely parse dates in standard string formats
    const parseAnyDate = (dateStr?: any): Date | null => {
        if (!dateStr) return null;
        if (dateStr instanceof Date) return dateStr;
        const s = String(dateStr).trim();
        if (!s) return null;

        let d = new Date(s);
        if (!isNaN(d.getTime())) return d;

        const parts = s.split(/[-/ T]/);
        if (parts.length >= 3) {
            const p1 = parseInt(parts[0], 10);
            const p2 = parseInt(parts[1], 10);
            const p3 = parseInt(parts[2], 10);

            if (p1 > 1000) return new Date(p1, p2 - 1, p3);
            if (p3 > 1000) return new Date(p3, p2 - 1, p1);
        }
        return null;
    };

    // Helper to get Month Year label from Committed Due date (e.g. "July 2026")
    const getMonthYearKey = (dateStr?: string) => {
        const d = parseAnyDate(dateStr);
        if (!d) return 'Unspecified';
        return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    };





    const todayStr = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

    return (
        <div style={{
            minHeight: '100vh',
            backgroundColor: '#f8fafc',
            color: '#0f172a',
            fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
            padding: '1.5rem 2rem'
        }}>
            {/* Top Navigation & Header */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: '#ffffff',
                padding: '1.2rem 2rem',
                borderRadius: '12px',
                boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
                marginBottom: '1.5rem',
                borderLeft: '8px solid #f5ad42'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <button
                        onClick={() => navigate('/')}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.4rem',
                            backgroundColor: '#f1f5f9',
                            color: '#475569',
                            border: '1px solid #cbd5e1',
                            padding: '0.5rem 1rem',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontWeight: 600,
                            fontSize: '0.9rem'
                        }}
                    >
                        <ArrowLeft size={16} /> Home
                    </button>
                    <div>
                        <h1 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 800, color: '#1e293b' }}>
                            SYMB Sales Orders Tracker
                        </h1>
                        <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
                            SYMB Sales Orders Tracking & Production Progress Dashboard
                        </span>
                    </div>
                </div>

                {/* Right End Date Pills */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{
                        backgroundColor: '#fef3c7',
                        color: '#92400e',
                        border: '1px solid #fcd34d',
                        padding: '0.4rem 0.9rem',
                        borderRadius: '20px',
                        fontSize: '0.85rem',
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem'
                    }}>
                        📅 Today: {todayStr}
                    </div>

                    {(availableFileDates.length > 0 || fileDate) && (
                        <div style={{
                            backgroundColor: '#e0f2fe',
                            color: '#0369a1',
                            border: '1px solid #7dd3fc',
                            padding: '0.4rem 0.9rem',
                            borderRadius: '20px',
                            fontSize: '0.85rem',
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.4rem'
                        }}>
                            📁 File Date:
                            {availableFileDates.length > 1 ? (
                                <select
                                    value={selectedFileDate || fileDate}
                                    onChange={e => setSelectedFileDate(e.target.value)}
                                    style={{
                                        background: 'transparent',
                                        border: 'none',
                                        color: '#0369a1',
                                        fontWeight: 700,
                                        fontSize: '0.85rem',
                                        cursor: 'pointer',
                                        outline: 'none'
                                    }}
                                >
                                    {availableFileDates.map(fd => (
                                        <option key={fd} value={fd} style={{ color: '#0f172a' }}>{fd}</option>
                                    ))}
                                </select>
                            ) : (
                                <span>{selectedFileDate || fileDate}</span>
                            )}
                        </div>
                    )}

                    <button
                        onClick={fetchSymbData}
                        style={{
                            backgroundColor: '#f1f5f9',
                            color: '#0f172a',
                            border: '1px solid #cbd5e1',
                            borderRadius: '50%',
                            width: '36px',
                            height: '36px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer'
                        }}
                        title="Refresh Data"
                    >
                        <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {loading ? (
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '400px',
                    backgroundColor: '#ffffff',
                    borderRadius: '12px',
                    boxShadow: '0 4px 6px rgba(0,0,0,0.05)'
                }}>
                    <RefreshCw size={36} className="animate-spin" style={{ color: '#f5ad42', marginBottom: '1rem' }} />
                    <span style={{ fontSize: '1.1rem', fontWeight: 600, color: '#475569' }}>
                        Loading SYMB Tracker Dashboard Data...
                    </span>
                </div>
            ) : (
                <>
                    {/* Sub-Tab Navigation Bar */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        marginBottom: '0',
                        backgroundColor: '#f1f5f9',
                        padding: '0.5rem 0.5rem 0 0.5rem',
                        borderRadius: '12px 12px 0 0',
                        border: '1px solid #e2e8f0',
                        borderBottom: 'none'
                    }}>
                        <button
                            onClick={() => setActiveSubTab('symb_plan_pipeline')}
                            style={{
                                padding: '0.75rem 1.5rem',
                                fontSize: '0.95rem',
                                fontWeight: 700,
                                border: 'none',
                                borderBottom: activeSubTab === 'symb_plan_pipeline' ? '3px solid #f5ad42' : '3px solid transparent',
                                backgroundColor: activeSubTab === 'symb_plan_pipeline' ? '#ffffff' : 'transparent',
                                color: activeSubTab === 'symb_plan_pipeline' ? '#1e293b' : '#64748b',
                                cursor: 'pointer',
                                borderRadius: '8px 8px 0 0',
                                transition: 'all 0.2s ease',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem'
                            }}
                        >
                            <Activity size={18} style={{ color: activeSubTab === 'symb_plan_pipeline' ? '#f5ad42' : '#64748b' }} />
                            Plan Pipeline
                        </button>

                        <button
                            onClick={() => setActiveSubTab('tracker_update')}
                            style={{
                                padding: '0.75rem 1.5rem',
                                fontSize: '0.95rem',
                                fontWeight: 700,
                                border: 'none',
                                borderBottom: activeSubTab === 'tracker_update' ? '3px solid #f5ad42' : '3px solid transparent',
                                backgroundColor: activeSubTab === 'tracker_update' ? '#ffffff' : 'transparent',
                                color: activeSubTab === 'tracker_update' ? '#1e293b' : '#64748b',
                                cursor: 'pointer',
                                borderRadius: '8px 8px 0 0',
                                transition: 'all 0.2s ease',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem'
                            }}
                        >
                            <Calendar size={18} style={{ color: activeSubTab === 'tracker_update' ? '#f5ad42' : '#64748b' }} />
                            Tracker Update
                        </button>

                        <button
                            onClick={() => setActiveSubTab('overall_plan')}
                            style={{
                                padding: '0.75rem 1.5rem',
                                fontSize: '0.95rem',
                                fontWeight: 700,
                                border: 'none',
                                borderBottom: activeSubTab === 'overall_plan' ? '3px solid #f5ad42' : '3px solid transparent',
                                backgroundColor: activeSubTab === 'overall_plan' ? '#ffffff' : 'transparent',
                                color: activeSubTab === 'overall_plan' ? '#1e293b' : '#64748b',
                                cursor: 'pointer',
                                borderRadius: '8px 8px 0 0',
                                transition: 'all 0.2s ease',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem'
                            }}
                        >
                            <Table size={18} style={{ color: activeSubTab === 'overall_plan' ? '#f5ad42' : '#64748b' }} />
                            Overall SYMB Plan
                        </button>
                    </div>

                    {/* Sub-Tab 3: Overall SYMB Plan */}
                    {activeSubTab === 'overall_plan' && (
                        <SymbOverallPlanView />
                    )}

                    {/* Sub-Tab 2: V1 Progress Charts */}
                    {activeSubTab === 'symb_plan_pipeline' && (
                        <SymbPipelineView />
                    )}
                </>
            )}

            {/* Modal for "View Detailed Data" */}
            {isModalOpen && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(15, 23, 42, 0.75)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 9999,
                    padding: '2rem'
                }}>
                    <div style={{
                        backgroundColor: '#ffffff',
                        borderRadius: '16px',
                        width: '95vw',
                        maxWidth: '95vw',
                        maxHeight: '92vh',
                        display: 'flex',
                        flexDirection: 'column',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                        overflow: 'hidden'
                    }}>
                        <div style={{
                            padding: '1.25rem 1.75rem',
                            backgroundColor: '#1e293b',
                            color: '#ffffff',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                        }}>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700, color: '#f5ad42' }}>
                                    Detailed Sales Orders Data
                                </h3>
                                <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
                                    Showing {filteredRecords.length} records for {selectedMonth || 'All Months'}
                                </span>
                            </div>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                style={{
                                    backgroundColor: 'rgba(255,255,255,0.1)',
                                    color: '#ffffff',
                                    border: 'none',
                                    borderRadius: '50%',
                                    width: '36px',
                                    height: '36px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer'
                                }}
                            >
                                <X size={20} />
                            </button>
                        </div>
                        <div style={{ padding: '1rem', overflowY: 'auto', flex: 1 }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.82rem' }}>
                                <thead>
                                    <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0', color: '#475569' }}>
                                        <th style={{ padding: '0.6rem 0.5rem', fontWeight: 700, whiteSpace: 'nowrap' }}>SO Number</th>
                                        <th style={{ padding: '0.6rem 0.5rem', fontWeight: 700, whiteSpace: 'nowrap' }}>Customer Request date</th>
                                        <th style={{ padding: '0.6rem 0.5rem', fontWeight: 700, whiteSpace: 'nowrap' }}>Committed Due date</th>
                                        <th style={{ padding: '0.6rem 0.5rem', fontWeight: 700, textAlign: 'right', whiteSpace: 'nowrap' }}>Quantity</th>
                                        <th style={{ padding: '0.6rem 0.5rem', fontWeight: 700, whiteSpace: 'nowrap' }}>Regular-Product Stage</th>
                                        <th style={{ padding: '0.6rem 0.5rem', fontWeight: 700, whiteSpace: 'nowrap' }}>who</th>
                                        <th style={{ padding: '0.6rem 0.5rem', fontWeight: 700, textAlign: 'right', whiteSpace: 'nowrap' }}>week_diff</th>
                                        <th style={{ padding: '0.6rem 0.5rem', fontWeight: 700, textAlign: 'center', whiteSpace: 'nowrap' }}>new_flag_algo</th>
                                        <th style={{ padding: '0.6rem 0.5rem', fontWeight: 700, whiteSpace: 'nowrap' }}>red</th>
                                        <th style={{ padding: '0.6rem 0.5rem', fontWeight: 700, whiteSpace: 'nowrap' }}>green</th>
                                        <th style={{ padding: '0.6rem 0.5rem', fontWeight: 700, whiteSpace: 'nowrap' }}>recovery stage</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredRecords.map((row, idx) => {
                                        const stage = row['n-reg_stage'] || row['Regular-Product Stage'] || '';
                                        const rules = flagRulesMap[stage.trim()] || { red: '-', green: '-' };
                                        const flagColor = (row.new_flag_algo || 'green').toLowerCase();

                                        return (
                                            <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: idx % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                                                <td style={{ padding: '0.5rem 0.5rem', fontWeight: 600, whiteSpace: 'nowrap' }}>{row['SO Number'] || row['SO NUMBER'] || '-'}</td>
                                                <td style={{ padding: '0.5rem 0.5rem', whiteSpace: 'nowrap' }}>{formatDatePretty(row['Customer Request date'])}</td>
                                                <td style={{ padding: '0.5rem 0.5rem', whiteSpace: 'nowrap' }}>{formatDatePretty(row['Committed Due date'])}</td>
                                                <td style={{ padding: '0.5rem 0.5rem', textAlign: 'right', fontWeight: 600 }}>{(Number(row.Quantity) || 0).toLocaleString()}</td>
                                                <td style={{ padding: '0.5rem 0.5rem' }}>{stage || '-'}</td>
                                                <td style={{ padding: '0.5rem 0.5rem', whiteSpace: 'nowrap' }}>{row.who || '-'}</td>
                                                <td style={{ padding: '0.5rem 0.5rem', textAlign: 'right', fontWeight: 600 }}>{row.week_diff !== undefined && row.week_diff !== null ? row.week_diff : '-'}</td>
                                                <td style={{ padding: '0.5rem 0.5rem', textAlign: 'center' }}>
                                                    <span style={{
                                                        display: 'inline-block',
                                                        padding: '0.15rem 0.5rem',
                                                        borderRadius: '4px',
                                                        fontWeight: 700,
                                                        fontSize: '0.75rem',
                                                        backgroundColor: flagColor === 'green' ? '#52b788' : flagColor === 'red' ? '#e63946' : flagColor === 'yellow' ? '#f5ad42' : '#3b82f6',
                                                        color: '#ffffff'
                                                    }}>
                                                        {flagColor}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '0.5rem 0.5rem', color: '#991b1b', backgroundColor: '#fee2e2', fontWeight: 600, fontSize: '0.78rem' }}>{rules.red}</td>
                                                <td style={{ padding: '0.5rem 0.5rem', color: '#166534', backgroundColor: '#dcfce7', fontWeight: 600, fontSize: '0.78rem' }}>{rules.green}</td>
                                                <td style={{ padding: '0.5rem 0.5rem', whiteSpace: 'nowrap' }}>{row['recovery stage'] || '-'}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                                <tfoot>
                                    <tr style={{ backgroundColor: '#f1f5f9', borderTop: '2px solid #cbd5e1', fontWeight: 800 }}>
                                        <td style={{ padding: '0.9rem 1rem' }}>Total</td>
                                        <td colSpan={2}></td>
                                        <td style={{ padding: '0.9rem 1rem', textAlign: 'right', fontSize: '0.95rem' }}>{totalQuantity.toLocaleString()}</td>
                                        <td colSpan={7}></td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* Sub-Tab 4: Tracker Update */}
            {activeSubTab === 'tracker_update' && (
                <SymbTrackerUpdate />
            )}
        </div>
    );
}
