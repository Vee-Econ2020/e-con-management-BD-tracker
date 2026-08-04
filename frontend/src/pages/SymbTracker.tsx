import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Plot from 'react-plotly.js';
import { ArrowLeft, RefreshCw, X, Table, Activity, Calendar } from 'lucide-react';
import '../index.css';
import SymbTrackerUpdate from '../components/SymbTrackerUpdate';
import SymbPipelineView from '../components/SymbPipelineView';

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
    const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
    const [selectedFlag, setSelectedFlag] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
    const [activeSubTab, setActiveSubTab] = useState<'symb_plan_pipeline' | 'tracker_update' | 'detailed'>('symb_plan_pipeline');

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

    // Filter records by selected file date if available
    const activeRecords = useMemo(() => {
        if (!selectedFileDate) return records;
        const filtered = records.filter(r => r.file_date === selectedFileDate);
        return filtered.length > 0 ? filtered : records;
    }, [records, selectedFileDate]);

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

    // Helper to get sortable year-month object
    const getSortableMonth = (dateStr?: string) => {
        const d = parseAnyDate(dateStr);
        if (!d) return { key: 'Unspecified', year: 9999, monthIdx: 99, label: 'Unspecified' };
        const year = d.getFullYear();
        const monthIdx = d.getMonth();
        const label = d.toLocaleDateString('en-US', { month: 'long' });
        return {
            key: `${label} ${year}`,
            year,
            monthIdx,
            label: `${label}\n${year}`
        };
    };

    // Compute chart data grouped by Month & Flag
    const { chartMonths, flagData, monthTotals } = useMemo(() => {
        const monthMap = new Map<string, { year: number; monthIdx: number; key: string; displayLabel: string }>();

        activeRecords.forEach(rec => {
            const cdd = getCDDVal(rec);
            const info = getSortableMonth(cdd);
            if (!monthMap.has(info.key)) {
                monthMap.set(info.key, {
                    year: info.year,
                    monthIdx: info.monthIdx,
                    key: info.key,
                    displayLabel: info.key
                });
            }
        });

        const sortedMonths = Array.from(monthMap.values()).sort((a, b) => {
            if (a.year !== b.year) return a.year - b.year;
            return a.monthIdx - b.monthIdx;
        });

        const monthKeys = sortedMonths.map(m => m.key);

        // Group unique SO numbers by month and flag
        const monthFlagSoSets: Record<string, Record<string, Set<string>>> = {};
        const monthAllSoSets: Record<string, Set<string>> = {};

        monthKeys.forEach(m => {
            monthFlagSoSets[m] = {
                green: new Set(),
                red: new Set(),
                yellow: new Set(),
                blue: new Set()
            };
            monthAllSoSets[m] = new Set();
        });

        activeRecords.forEach((rec, idx) => {
            const cdd = getCDDVal(rec);
            const mKey = getMonthYearKey(cdd);
            const flag = (rec.new_flag_algo || rec.new_flag_color || rec.flag || 'green').toLowerCase().trim();
            const soNum = String(rec['SO Number'] || rec['SO NUMBER'] || rec['SO_Number'] || rec['Record Id'] || rec['NPI'] || `REC_${idx}`).trim();

            if (!monthFlagSoSets[mKey]) {
                monthFlagSoSets[mKey] = {
                    green: new Set(),
                    red: new Set(),
                    yellow: new Set(),
                    blue: new Set()
                };
                monthAllSoSets[mKey] = new Set();
            }

            if (!monthFlagSoSets[mKey][flag]) {
                monthFlagSoSets[mKey][flag] = new Set();
            }

            monthFlagSoSets[mKey][flag].add(soNum);
            monthAllSoSets[mKey].add(soNum);
        });

        const counts: Record<string, Record<string, number>> = {};
        const totals: Record<string, number> = {};

        monthKeys.forEach(m => {
            counts[m] = {
                green: monthFlagSoSets[m]?.green.size || 0,
                red: monthFlagSoSets[m]?.red.size || 0,
                yellow: monthFlagSoSets[m]?.yellow.size || 0,
                blue: monthFlagSoSets[m]?.blue.size || 0,
            };
            totals[m] = monthAllSoSets[m]?.size || 0;
        });

        return {
            chartMonths: monthKeys,
            flagData: counts,
            monthTotals: totals
        };
    }, [activeRecords]);

    // Plotly traces configuration
    const plotlyTraces = useMemo(() => {
        const flagsList: Array<{ name: string; key: string; color: string }> = [
            { name: 'green', key: 'green', color: '#52b788' },
            { name: 'red', key: 'red', color: '#e63946' },
            { name: 'yellow', key: 'yellow', color: '#f5ad42' },
            { name: 'blue', key: 'blue', color: '#3b82f6' }
        ];

        return flagsList.map(flag => {
            const yValues = chartMonths.map(m => flagData[m]?.[flag.key] || 0);
            const textLabels = yValues.map(val => val > 0 ? `${val}` : '');

            return {
                x: chartMonths,
                y: yValues,
                name: flag.name,
                type: 'bar' as const,
                marker: { color: flag.color },
                text: textLabels,
                textposition: 'inside' as const,
                insidetextfont: { color: 'white', size: 22 },
                hoverinfo: 'x+y+name' as const
            };
        });
    }, [chartMonths, flagData]);

    // Total annotations above stacked bars
    const totalAnnotations = useMemo(() => {
        return chartMonths.map(m => ({
            x: m,
            y: monthTotals[m] || 0,
            text: `<b>${monthTotals[m] || 0}</b>`,
            xanchor: 'center' as const,
            yanchor: 'bottom' as const,
            showarrow: false,
            font: { size: 22, color: '#1e293b' }
        }));
    }, [chartMonths, monthTotals]);

    // Filtered records for table view
    const filteredRecords = useMemo(() => {
        return activeRecords.filter(rec => {
            if (selectedMonth) {
                const cdd = getCDDVal(rec);
                const recMonth = getMonthYearKey(cdd);
                if (recMonth !== selectedMonth) return false;
            }

            if (selectedFlag) {
                const recFlag = (rec.new_flag_algo || rec.new_flag_color || rec.flag || 'green').toLowerCase().trim();
                if (recFlag !== selectedFlag.toLowerCase()) return false;
            }

            if (searchTerm.trim()) {
                const term = searchTerm.toLowerCase();
                const soNum = String(rec['SO Number'] || rec['SO NUMBER'] || '').toLowerCase();
                const stage = String(rec['n-reg_stage'] || rec['Regular-Product Stage'] || '').toLowerCase();
                const who = String(rec.who || '').toLowerCase();

                if (!soNum.includes(term) && !stage.includes(term) && !who.includes(term)) {
                    return false;
                }
            }

            return true;
        });
    }, [activeRecords, selectedMonth, selectedFlag, searchTerm]);

    // Total quantity sum
    const totalQuantity = useMemo(() => {
        return filteredRecords.reduce((sum, r) => {
            const qty = Number(r.Quantity) || 0;
            return sum + qty;
        }, 0);
    }, [filteredRecords]);

    const handlePlotClick = (data: any) => {
        if (data && data.points && data.points.length > 0) {
            const point = data.points[0];
            const month = point.x;
            const flag = point.data.name;
            setSelectedMonth(month);
            setSelectedFlag(flag);
            setIsModalOpen(true);
        }
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
                            Current Flag Status for Symbotic orders
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
                    {/* Main Stacked Bar Chart Card */}
                    <div style={{
                        backgroundColor: '#ffffff',
                        borderRadius: '12px',
                        padding: '1.5rem',
                        boxShadow: '0 4px 15px rgba(0,0,0,0.05)',
                        marginBottom: '2rem',
                        border: '1px solid #e2e8f0'
                    }}>
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: '1rem',
                            paddingBottom: '0.75rem',
                            borderBottom: '1px solid #f1f5f9'
                        }}>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700, color: '#1e293b' }}>
                                    Current Flag Status for Symbotic orders
                                </h3>
                                <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
                                    Click any bar segment to filter detailed records
                                </span>
                            </div>

                            {/* Active Selection Indicator & Clear Button */}
                            {(selectedMonth || selectedFlag) && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                                    <span style={{
                                        backgroundColor: '#eff6ff',
                                        color: '#1d4ed8',
                                        padding: '0.4rem 0.8rem',
                                        borderRadius: '6px',
                                        fontSize: '0.85rem',
                                        fontWeight: 600,
                                        border: '1px solid #bfdbfe'
                                    }}>
                                        Selected: {selectedMonth || 'All Months'} {selectedFlag ? `(${selectedFlag.toUpperCase()})` : ''}
                                    </span>
                                    <button
                                        onClick={() => { setSelectedMonth(null); setSelectedFlag(null); }}
                                        style={{
                                            backgroundColor: '#fef2f2',
                                            color: '#ef4444',
                                            border: '1px solid #fca5a5',
                                            padding: '0.35rem 0.75rem',
                                            borderRadius: '6px',
                                            cursor: 'pointer',
                                            fontWeight: 600,
                                            fontSize: '0.85rem',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.3rem'
                                        }}
                                    >
                                        <X size={14} /> Clear Selection
                                    </button>

                                    <button
                                        onClick={() => setIsModalOpen(true)}
                                        style={{
                                            backgroundColor: '#f5ad42',
                                            color: '#000000',
                                            border: 'none',
                                            padding: '0.4rem 1rem',
                                            borderRadius: '6px',
                                            cursor: 'pointer',
                                            fontWeight: 700,
                                            fontSize: '0.85rem',
                                            boxShadow: '0 2px 5px rgba(245,173,66,0.3)'
                                        }}
                                    >
                                        🔍 View Detailed Data ({filteredRecords.length})
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Plotly Stacked Bar Chart */}
                        <div style={{ width: '100%', height: '540px' }}>
                            <Plot
                                data={plotlyTraces}
                                layout={{
                                    barmode: 'stack',
                                    autosize: true,
                                    margin: { t: 50, b: 80, l: 80, r: 40 },
                                    xaxis: {
                                        title: { text: 'Month', font: { size: 18, color: '#1e293b' } },
                                        type: 'category',
                                        tickfont: { size: 16, color: '#0f172a' }
                                    },
                                    yaxis: {
                                        title: { text: 'Count of SO Number', font: { size: 18, color: '#1e293b' } },
                                        tickfont: { size: 16, color: '#0f172a' },
                                        gridcolor: '#e2e8f0'
                                    },
                                    legend: {
                                        orientation: 'h',
                                        x: 0,
                                        y: 1.15,
                                        font: { size: 18, color: '#0f172a' }
                                    },
                                    annotations: totalAnnotations,
                                    hovermode: 'closest',
                                    plot_bgcolor: '#ffffff',
                                    paper_bgcolor: '#ffffff'
                                }}
                                useResizeHandler={true}
                                style={{ width: '100%', height: '100%' }}
                                config={{ displayModeBar: false }}
                                onClick={handlePlotClick}
                            />
                        </div>
                    </div>

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
                            onClick={() => setActiveSubTab('detailed')}
                            style={{
                                padding: '0.75rem 1.5rem',
                                fontSize: '0.95rem',
                                fontWeight: 700,
                                border: 'none',
                                borderBottom: activeSubTab === 'detailed' ? '3px solid #f5ad42' : '3px solid transparent',
                                backgroundColor: activeSubTab === 'detailed' ? '#ffffff' : 'transparent',
                                color: activeSubTab === 'detailed' ? '#1e293b' : '#64748b',
                                cursor: 'pointer',
                                borderRadius: '8px 8px 0 0',
                                transition: 'all 0.2s ease',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem'
                            }}
                        >
                            <Table size={18} style={{ color: activeSubTab === 'detailed' ? '#f5ad42' : '#64748b' }} />
                            Detailed Sales Orders Table
                        </button>
                    </div>

                    {/* Sub-Tab 1: Detailed Sales Orders Table */}
                    {activeSubTab === 'detailed' && (
                        <>
                            <div style={{
                                backgroundColor: '#ffffff',
                                padding: '1.25rem 1.5rem',
                                boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
                                border: '1px solid #e2e8f0',
                                borderTop: 'none',
                                borderBottom: 'none',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    <Table size={20} style={{ color: '#f5ad42' }} />
                                    <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: '#1e293b' }}>
                                        Detailed Sales Orders Table
                                    </h3>
                                    <span style={{
                                        backgroundColor: '#f1f5f9',
                                        color: '#475569',
                                        padding: '0.2rem 0.6rem',
                                        borderRadius: '12px',
                                        fontSize: '0.8rem',
                                        fontWeight: 700
                                    }}>
                                        {filteredRecords.length} records
                                    </span>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                    <div style={{ position: 'relative' }}>
                                        <input
                                            type="text"
                                            placeholder="Search SO Number, Stage, Who..."
                                            value={searchTerm}
                                            onChange={e => setSearchTerm(e.target.value)}
                                            style={{
                                                padding: '0.45rem 1rem',
                                                borderRadius: '6px',
                                                border: '1px solid #cbd5e1',
                                                fontSize: '0.85rem',
                                                width: '240px',
                                                outline: 'none'
                                            }}
                                        />
                                        {searchTerm && (
                                            <button
                                                onClick={() => setSearchTerm('')}
                                                style={{
                                                    position: 'absolute',
                                                    right: '8px',
                                                    top: '50%',
                                                    transform: 'translateY(-50%)',
                                                    background: 'none',
                                                    border: 'none',
                                                    cursor: 'pointer',
                                                    color: '#94a3b8'
                                                }}
                                            >
                                                <X size={14} />
                                            </button>
                                        )}
                                    </div>

                                    <div style={{ display: 'flex', gap: '0.3rem' }}>
                                        {['All', 'green', 'red', 'yellow', 'blue'].map(flag => {
                                            const isActive = (flag === 'All' && !selectedFlag) || (selectedFlag && selectedFlag.toLowerCase() === flag.toLowerCase());
                                            return (
                                                <button
                                                    key={flag}
                                                    onClick={() => setSelectedFlag(flag === 'All' ? null : flag)}
                                                    style={{
                                                        padding: '0.35rem 0.7rem',
                                                        borderRadius: '6px',
                                                        fontSize: '0.8rem',
                                                        fontWeight: 700,
                                                        cursor: 'pointer',
                                                        border: isActive ? '2px solid #000' : '1px solid #e2e8f0',
                                                        backgroundColor: flag === 'green' ? '#dcfce7' : flag === 'red' ? '#fee2e2' : flag === 'yellow' ? '#fef3c7' : flag === 'blue' ? '#dbeafe' : '#f1f5f9',
                                                        color: flag === 'green' ? '#166534' : flag === 'red' ? '#991b1b' : flag === 'yellow' ? '#92400e' : flag === 'blue' ? '#1e40af' : '#334155'
                                                    }}
                                                >
                                                    {flag.toUpperCase()}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>

                            <div style={{
                                backgroundColor: '#ffffff',
                                borderRadius: '0 0 12px 12px',
                                border: '1px solid #e2e8f0',
                                boxShadow: '0 4px 15px rgba(0,0,0,0.05)',
                                overflowX: 'auto',
                                marginBottom: '3rem'
                            }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                                    <thead>
                                        <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0', color: '#475569' }}>
                                            <th style={{ padding: '0.85rem 1rem', fontWeight: 700 }}>SO Number</th>
                                            <th style={{ padding: '0.85rem 1rem', fontWeight: 700 }}>Customer Request date</th>
                                            <th style={{ padding: '0.85rem 1rem', fontWeight: 700 }}>Committed Due date</th>
                                            <th style={{ padding: '0.85rem 1rem', fontWeight: 700, textAlign: 'right' }}>Quantity</th>
                                            <th style={{ padding: '0.85rem 1rem', fontWeight: 700 }}>Regular-Product Stage</th>
                                            <th style={{ padding: '0.85rem 1rem', fontWeight: 700 }}>who</th>
                                            <th style={{ padding: '0.85rem 1rem', fontWeight: 700, textAlign: 'right' }}>week_diff</th>
                                            <th style={{ padding: '0.85rem 1rem', fontWeight: 700, textAlign: 'center' }}>new_flag_algo</th>
                                            <th style={{ padding: '0.85rem 1rem', fontWeight: 700 }}>red</th>
                                            <th style={{ padding: '0.85rem 1rem', fontWeight: 700 }}>green</th>
                                            <th style={{ padding: '0.85rem 1rem', fontWeight: 700 }}>recovery stage</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredRecords.map((row, idx) => {
                                            const stage = row['n-reg_stage'] || row['Regular-Product Stage'] || '';
                                            const rules = flagRulesMap[stage.trim()] || { red: '-', green: '-' };
                                            const flagColor = (row.new_flag_algo || 'green').toLowerCase();
                                            const soNumber = row['SO Number'] || row['SO NUMBER'] || row['SO_Number'] || '-';

                                            return (
                                                <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: idx % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                                                    <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#1e293b' }}>{soNumber}</td>
                                                    <td style={{ padding: '0.75rem 1rem', color: '#334155' }}>{formatDatePretty(row['Customer Request date'])}</td>
                                                    <td style={{ padding: '0.75rem 1rem', color: '#334155' }}>{formatDatePretty(row['Committed Due date'])}</td>
                                                    <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 600, color: '#0f172a' }}>{(Number(row.Quantity) || 0).toLocaleString()}</td>
                                                    <td style={{ padding: '0.75rem 1rem', color: '#334155' }}>{stage || '-'}</td>
                                                    <td style={{ padding: '0.75rem 1rem', color: '#475569' }}>{row.who || '-'}</td>
                                                    <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 600, color: '#334155' }}>{row.week_diff !== undefined && row.week_diff !== null ? row.week_diff : '-'}</td>
                                                    <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                                                        <span style={{
                                                            display: 'inline-block',
                                                            padding: '0.25rem 0.65rem',
                                                            borderRadius: '4px',
                                                            fontWeight: 700,
                                                            fontSize: '0.75rem',
                                                            backgroundColor: flagColor === 'green' ? '#52b788' : flagColor === 'red' ? '#e63946' : flagColor === 'yellow' ? '#f5ad42' : '#3b82f6',
                                                            color: '#ffffff'
                                                        }}>
                                                            {flagColor}
                                                        </span>
                                                    </td>
                                                    <td style={{ padding: '0.75rem 1rem', color: '#991b1b', backgroundColor: '#fee2e2', fontWeight: 600, fontSize: '0.8rem' }}>{rules.red}</td>
                                                    <td style={{ padding: '0.75rem 1rem', color: '#166534', backgroundColor: '#dcfce7', fontWeight: 600, fontSize: '0.8rem' }}>{rules.green}</td>
                                                    <td style={{ padding: '0.75rem 1rem', color: '#334155', fontWeight: 500 }}>{row['recovery stage'] || '-'}</td>
                                                </tr>
                                            );
                                        })}
                                        {filteredRecords.length === 0 && (
                                            <tr>
                                                <td colSpan={11} style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
                                                    No matching Sales Orders found for the selected filters.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                    {filteredRecords.length > 0 && (
                                        <tfoot>
                                            <tr style={{ backgroundColor: '#f1f5f9', borderTop: '2px solid #cbd5e1', fontWeight: 800, color: '#0f172a' }}>
                                                <td style={{ padding: '0.9rem 1rem' }}>Total</td>
                                                <td colSpan={2}></td>
                                                <td style={{ padding: '0.9rem 1rem', textAlign: 'right', fontSize: '0.95rem' }}>{totalQuantity.toLocaleString()}</td>
                                                <td colSpan={7}></td>
                                            </tr>
                                        </tfoot>
                                    )}
                                </table>
                            </div>
                        </>
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
                                    Showing {filteredRecords.length} records for {selectedMonth || 'All Months'} {selectedFlag ? `(${selectedFlag.toUpperCase()})` : ''}
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
