import React, { useState, useEffect, useMemo } from 'react';
import { 
    Calendar, Filter, AlertCircle, CalendarDays, ArrowRight, RefreshCw, Clock, 
    CheckCircle2, ChevronDown, Eye, Check, Layers, X, ShieldAlert,
    MessageSquare, History, Send, Edit2, Trash2, Plus, Maximize2,
    ShieldCheck, TrendingDown, ArrowUpRight, Activity, ChevronUp
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface SymbPlanRow {
    id: string;
    "Last Batch Date": string;
    "Shipment Week": string;
    "Variant Type": string;
    "Event Type": string;
    "planned Value": number;
    completed: number;
    "Material Covered": string;
    "Delayed by days": number;
    "Delayed by weeks": number;
    "Estimated Completion Date"?: string;
    "Actual Completed Date"?: string;
    is_autofilled?: boolean;
    unplanned_qty?: number;
    warning_msg?: string;
    original_planned_value?: number;
    [key: string]: any;
}

interface RemarkHistoryEntry {
    old_text: string;
    edited_by: string;
    edited_at: string;
    edit_number?: number;
}

interface StageRemark {
    id: string;
    shipment_week: string;
    stage: string;
    remark: string;
    created_by: string;
    created_at: string;
    updated_by?: string;
    updated_at?: string;
    edit_history?: RemarkHistoryEntry[];
}

const EVENT_ORDER = [
    "EBOM covered",
    "PCBA covered",
    "All Material Available",
    "Materials Issued",
    "Active alignment",
    "Production/Assembly",
    "FQC",
    "Finished goods",
    "Invoice Date",
    "Shipment Date",
    "customer place"
];

const STAGE_COLOR_MAP: Record<string, { color: string; bg: string; border: string; text: string }> = {
    'EBOM covered': { color: '#6366f1', bg: '#eef2ff', border: '#c7d2fe', text: '#3730a3' },
    'PCBA covered': { color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe', text: '#1e40af' },
    'PCBA Ready': { color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe', text: '#1e40af' },
    'All Material Available': { color: '#d97706', bg: '#fffbeb', border: '#fde68a', text: '#92400e' },
    'Materials Issued': { color: '#8b5cf6', bg: '#f5f3ff', border: '#ddd6fe', text: '#5b21b6' },
    'Active alignment': { color: '#d97706', bg: '#fffbeb', border: '#fde68a', text: '#92400e' },
    'Production/Assembly': { color: '#0d9488', bg: '#f0fdfa', border: '#99f6e4', text: '#115e59' },
    'FQC': { color: '#4f46e5', bg: '#eef2ff', border: '#c7d2fe', text: '#3730a3' },
    'Finished goods': { color: '#059669', bg: '#ecfdf5', border: '#a7f3d0', text: '#065f46' },
    'Invoice Date': { color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe', text: '#5b21b6' },
    'Shipment Date': { color: '#db2777', bg: '#fdf2f8', border: '#fbcfe8', text: '#9d174d' },
    'customer place': { color: '#0284c7', bg: '#f0f9ff', border: '#bae6fd', text: '#0369a1' }
};

const getStageThemeColor = (stageName: string) => {
    return STAGE_COLOR_MAP[stageName] || { color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe', text: '#1e40af' };
};

const ProgressRing: React.FC<{ percentage: number; size?: number; strokeWidth?: number }> = ({ percentage, size = 26, strokeWidth = 3 }) => {
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (percentage / 100) * circumference;
    const isComplete = percentage === 100;
    const color = isComplete ? '#10b981' : percentage > 50 ? '#f5ad42' : '#ef4444';

    return (
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', flexShrink: 0 }}>
            <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                stroke="#334155"
                strokeWidth={strokeWidth}
                fill="transparent"
            />
            <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                stroke={color}
                strokeWidth={strokeWidth}
                fill="transparent"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                strokeLinecap="round"
                style={{ transition: 'stroke-dashoffset 0.3s ease' }}
            />
        </svg>
    );
};

function parseDateSafe(val: any): Date | null {
    if (!val) return null;
    const str = String(val).trim();
    if (!str || ['none', 'nan', 'nat', 'null', '-', 'unknown'].includes(str.toLowerCase())) return null;

    const isoMatch = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
    if (isoMatch) {
        return new Date(parseInt(isoMatch[1], 10), parseInt(isoMatch[2], 10) - 1, parseInt(isoMatch[3], 10));
    }

    const match = str.match(/^(\d{1,2})[-/\s]+([A-Za-z]+)[-/\s]+(\d{2,4})/);
    if (match) {
        const day = parseInt(match[1], 10);
        const monthStr = match[2].toLowerCase();
        let year = parseInt(match[3], 10);
        if (year < 100) year += 2000;
        const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
        const monthIdx = months.findIndex(m => monthStr.startsWith(m));
        if (!isNaN(day) && monthIdx >= 0 && !isNaN(year)) {
            return new Date(year, monthIdx, day);
        }
    }

    const d = new Date(str);
    return isNaN(d.getTime()) ? null : d;
}

interface WeekBufferAnalysis {
    weekStr: string;
    shipDate: Date;
    targetFgDate: Date;
    projectedFgDate: Date;
    actualFgDate: Date | null;
    isFgCompleted: boolean;
    maxSlippageDays: number;
    bufferDays: number;
    bufferWeeks: number;
    status: 'healthy' | 'consumed' | 'at_risk' | 'breached';
    primaryEaterStage: string;
    stageBreakdowns: {
        stage: string;
        targetDate: Date | null;
        actualDate: Date | null;
        estDate: Date | null;
        slippageDays: number;
        isCompleted: boolean;
    }[];
    v1Planned: number;
    v2Planned: number;
    totalPlanned: number;
}

interface StageRemarksModalProps {
    weekStr: string;
    stage: string;
    remarks: StageRemark[];
    onClose: () => void;
    onAddRemark: (text: string) => Promise<void>;
    onUpdateRemark: (remarkId: string, text: string) => Promise<void>;
    onDeleteRemark: (remarkId: string) => Promise<void>;
    formatDateTime: (dateStr?: string) => string;
    onViewHistory: (remark: StageRemark) => void;
}

const StageRemarksModal: React.FC<StageRemarksModalProps> = ({
    weekStr,
    stage,
    remarks,
    onClose,
    onAddRemark,
    onUpdateRemark,
    onDeleteRemark,
    formatDateTime,
    onViewHistory
}) => {
    const [newRemarkText, setNewRemarkText] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [editingRemarkId, setEditingRemarkId] = useState<string | null>(null);
    const [editingRemarkText, setEditingRemarkText] = useState('');

    const handlePost = async () => {
        const text = newRemarkText.trim();
        if (!text || isSubmitting) return;
        try {
            setIsSubmitting(true);
            await onAddRemark(text);
            setNewRemarkText('');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSaveEdit = async (id: string) => {
        const text = editingRemarkText.trim();
        if (!text) return;
        await onUpdateRemark(id, text);
        setEditingRemarkId(null);
        setEditingRemarkText('');
    };

    const stageRemarks = useMemo(() => {
        return remarks
            .filter(r => r.shipment_week === weekStr && r.stage === stage)
            .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    }, [remarks, weekStr, stage]);

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9998,
            padding: '1rem'
        }}>
            <div style={{
                backgroundColor: '#ffffff',
                borderRadius: '12px',
                width: '100%',
                maxWidth: '640px',
                maxHeight: '88vh',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 20px 25px -5px rgba(0,0,0,0.25)',
                overflow: 'hidden'
            }}>
                {/* Modal Header */}
                <div style={{
                    padding: '1rem 1.25rem',
                    borderBottom: '1px solid #e2e8f0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    backgroundColor: '#f8fafc'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <div style={{ backgroundColor: '#e0e7ff', color: '#4338ca', padding: '0.45rem', borderRadius: '8px', display: 'flex' }}>
                            <MessageSquare size={18} />
                        </div>
                        <div>
                            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#0f172a' }}>
                                Stage Remarks: {stage}
                            </h3>
                            <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b' }}>
                                Shipment Week: <strong>{weekStr}</strong> • {stageRemarks.length} Remark{stageRemarks.length !== 1 ? 's' : ''}
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: '0.25rem', display: 'flex', borderRadius: '4px' }}
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Modal Body */}
                <div style={{ padding: '1.25rem', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {/* Add New Remark Input */}
                    <div style={{
                        backgroundColor: '#f8fafc',
                        border: '1px solid #cbd5e1',
                        borderRadius: '8px',
                        padding: '0.75rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.5rem'
                    }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155' }}>
                            Add New Remark
                        </div>
                        <textarea
                            placeholder="Type a remark for this stage..."
                            value={newRemarkText}
                            onChange={e => setNewRemarkText(e.target.value)}
                            rows={3}
                            style={{
                                width: '100%',
                                padding: '0.5rem 0.65rem',
                                fontSize: '0.82rem',
                                border: '1px solid #94a3b8',
                                borderRadius: '6px',
                                outline: 'none',
                                resize: 'vertical',
                                boxSizing: 'border-box',
                                fontFamily: 'inherit'
                            }}
                            onKeyDown={e => {
                                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                                    handlePost();
                                }
                            }}
                        />
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                                Tip: Press Ctrl+Enter to post
                            </span>
                            <button
                                type="button"
                                onClick={handlePost}
                                disabled={!newRemarkText.trim() || isSubmitting}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.35rem',
                                    padding: '0.35rem 0.85rem',
                                    fontSize: '0.78rem',
                                    backgroundColor: newRemarkText.trim() && !isSubmitting ? '#4f46e5' : '#a5b4fc',
                                    color: '#ffffff',
                                    border: 'none',
                                    borderRadius: '6px',
                                    cursor: newRemarkText.trim() && !isSubmitting ? 'pointer' : 'not-allowed',
                                    fontWeight: 700
                                }}
                            >
                                <Send size={12} />
                                <span>{isSubmitting ? 'Posting...' : 'Post Remark'}</span>
                            </button>
                        </div>
                    </div>

                    {/* Remarks List */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Remarks List ({stageRemarks.length})
                        </div>

                        {stageRemarks.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '1.5rem', color: '#94a3b8', fontSize: '0.82rem', fontStyle: 'italic', backgroundColor: '#f8fafc', borderRadius: '8px' }}>
                                No remarks posted yet for this stage.
                            </div>
                        ) : (
                            stageRemarks.map(rm => (
                                <div
                                    key={rm.id}
                                    style={{
                                        border: '1px solid #e2e8f0',
                                        borderRadius: '8px',
                                        padding: '0.75rem 0.9rem',
                                        backgroundColor: '#ffffff',
                                        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '0.4rem',
                                        minWidth: 0
                                    }}
                                >
                                    {editingRemarkId === rm.id ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                            <textarea
                                                value={editingRemarkText}
                                                onChange={e => setEditingRemarkText(e.target.value)}
                                                rows={3}
                                                style={{
                                                    width: '100%',
                                                    padding: '0.45rem 0.6rem',
                                                    fontSize: '0.82rem',
                                                    border: '1px solid #818cf8',
                                                    borderRadius: '6px',
                                                    resize: 'vertical',
                                                    boxSizing: 'border-box',
                                                    fontFamily: 'inherit'
                                                }}
                                                autoFocus
                                            />
                                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.4rem' }}>
                                                <button
                                                    type="button"
                                                    onClick={() => { setEditingRemarkId(null); setEditingRemarkText(''); }}
                                                    style={{
                                                        padding: '0.25rem 0.65rem',
                                                        fontSize: '0.74rem',
                                                        backgroundColor: '#e2e8f0',
                                                        color: '#475569',
                                                        border: 'none',
                                                        borderRadius: '4px',
                                                        cursor: 'pointer'
                                                    }}
                                                >
                                                    Cancel
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleSaveEdit(rm.id)}
                                                    style={{
                                                        padding: '0.25rem 0.75rem',
                                                        fontSize: '0.74rem',
                                                        backgroundColor: '#4f46e5',
                                                        color: '#ffffff',
                                                        border: 'none',
                                                        borderRadius: '4px',
                                                        cursor: 'pointer',
                                                        fontWeight: 600
                                                    }}
                                                >
                                                    Save Edit
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem', minWidth: 0 }}>
                                                <div style={{
                                                    fontSize: '0.84rem',
                                                    color: '#1e293b',
                                                    lineHeight: 1.45,
                                                    whiteSpace: 'pre-wrap',
                                                    wordBreak: 'break-all',
                                                    overflowWrap: 'anywhere',
                                                    flex: 1,
                                                    minWidth: 0
                                                }}>
                                                    {rm.remark}
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', flexShrink: 0 }}>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setEditingRemarkId(rm.id);
                                                            setEditingRemarkText(rm.remark);
                                                        }}
                                                        title="Edit remark"
                                                        style={{
                                                            padding: '0.25rem',
                                                            color: '#64748b',
                                                            backgroundColor: '#f1f5f9',
                                                            border: 'none',
                                                            borderRadius: '4px',
                                                            cursor: 'pointer',
                                                            display: 'flex'
                                                        }}
                                                    >
                                                        <Edit2 size={13} />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => onDeleteRemark(rm.id)}
                                                        title="Delete remark"
                                                        style={{
                                                            padding: '0.25rem',
                                                            color: '#ef4444',
                                                            backgroundColor: '#fee2e2',
                                                            border: 'none',
                                                            borderRadius: '4px',
                                                            cursor: 'pointer',
                                                            display: 'flex'
                                                        }}
                                                    >
                                                        <Trash2 size={13} />
                                                    </button>
                                                </div>
                                            </div>

                                            <div style={{
                                                display: 'flex',
                                                flexWrap: 'wrap',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                gap: '0.35rem',
                                                marginTop: '0.3rem',
                                                paddingTop: '0.35rem',
                                                borderTop: '1px solid #f1f5f9',
                                                fontSize: '0.7rem',
                                                color: '#64748b'
                                            }}>
                                                <span>
                                                    By <strong style={{ color: '#334155' }}>{rm.created_by}</strong> • {formatDateTime(rm.created_at)}
                                                </span>
                                                {rm.edit_history && rm.edit_history.length > 0 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => onViewHistory(rm)}
                                                        style={{
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            gap: '0.25rem',
                                                            padding: '0.1rem 0.45rem',
                                                            backgroundColor: '#fef3c7',
                                                            color: '#92400e',
                                                            borderRadius: '9999px',
                                                            border: '1px solid #fde68a',
                                                            fontSize: '0.66rem',
                                                            fontWeight: 700,
                                                            cursor: 'pointer'
                                                        }}
                                                        title="Click to view full revision history"
                                                    >
                                                        <History size={11} />
                                                        <span>Edited ({rm.edit_history.length})</span>
                                                    </button>
                                                )}
                                            </div>
                                        </>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Modal Footer */}
                <div style={{ padding: '0.8rem 1.25rem', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', backgroundColor: '#f8fafc' }}>
                    <button
                        type="button"
                        onClick={onClose}
                        style={{
                            padding: '0.45rem 1.1rem',
                            backgroundColor: '#e2e8f0',
                            color: '#334155',
                            borderRadius: '6px',
                            border: 'none',
                            fontSize: '0.82rem',
                            fontWeight: 600,
                            cursor: 'pointer'
                        }}
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

const SymbPipelineView: React.FC = () => {
    const { user } = useAuth();
    const [data, setData] = useState<SymbPlanRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isCompletedSectionOpen, setIsCompletedSectionOpen] = useState(false);
    const [highlightedWeek, setHighlightedWeek] = useState<string | null>(null);
    
    // Remarks State
    const [remarks, setRemarks] = useState<StageRemark[]>([]);
    const [, setLoadingRemarks] = useState(false);
    const [activeModalStage, setActiveModalStage] = useState<{ weekStr: string; stage: string } | null>(null);
    const [activeHistoryRemark, setActiveHistoryRemark] = useState<StageRemark | null>(null);

    // Coverage Stage Filter State
    const [selectedCoverageStage, setSelectedCoverageStage] = useState<string | null>(null);

    // Filters
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
    const [selectedVariant, setSelectedVariant] = useState<string>('All');
    const isAdmin = user?.role === 'Admin';

    // Buffer Analysis State (Admin Only)
    const [bufferFilter, setBufferFilter] = useState<'all' | 'at_risk' | 'breached' | 'healthy'>('all');
    const [bufferSortMode, setBufferSortMode] = useState<'least_buffer' | 'chronological'>('least_buffer');
    const [isBufferSectionOpen, setIsBufferSectionOpen] = useState<boolean>(true);
    const [selectedBufferStage, setSelectedBufferStage] = useState<string | null>(null);

    const MILESTONE_STAGES = useMemo(() => [
        { key: 'EBOM covered', title: 'EBOM covered', eventMatch: ['EBOM covered'], color: '#6366f1', bg: '#eef2ff', border: '#c7d2fe' },
        { key: 'PCBA', title: 'PCBA', eventMatch: ['PCBA covered', 'PCBA Ready'], color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
        { key: 'All Material Available', title: 'All Material Available', eventMatch: ['All Material Available'], color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
        { key: 'Materials Issued', title: 'Materials Issued', eventMatch: ['Materials Issued'], color: '#8b5cf6', bg: '#f5f3ff', border: '#ddd6fe' },
        { key: 'Active Alignment', title: 'Active Alignment', eventMatch: ['Active alignment'], color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
        { key: 'Production / Assembly', title: 'Production / Assembly', eventMatch: ['Production/Assembly'], color: '#0d9488', bg: '#f0fdfa', border: '#99f6e4' },
        { key: 'FQC', title: 'FQC', eventMatch: ['FQC'], color: '#4f46e5', bg: '#eef2ff', border: '#c7d2fe' },
        { key: 'Finished Goods', title: 'Finished Goods', eventMatch: ['Finished goods'], color: '#059669', bg: '#ecfdf5', border: '#a7f3d0' }
    ], []);

    const fetchRemarks = async () => {
        try {
            setLoadingRemarks(true);
            const res = await fetch('/api/admin/symb-plan/remarks');
            if (res.ok) {
                const json = await res.json();
                setRemarks(json);
            }
        } catch (error) {
            console.error("Error fetching stage remarks:", error);
        } finally {
            setLoadingRemarks(false);
        }
    };

    useEffect(() => {
        fetchData();
        fetchRemarks();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const res = await fetch('/api/admin/symb-plan/transformed');
            const json = await res.json();
            setData(json);
        } catch (error) {
            console.error("Error fetching pipeline data:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleRefresh = async () => {
        try {
            setIsRefreshing(true);
            await Promise.all([
                fetch('/api/admin/symb-plan/transformed').then(r => r.json()).then(json => setData(json)),
                fetch('/api/admin/symb-plan/remarks').then(r => r.json()).then(json => setRemarks(json))
            ]);
        } catch (error) {
            console.error("Error refreshing pipeline data:", error);
        } finally {
            setIsRefreshing(false);
        }
    };

    const handleAddRemark = async (shipmentWeek: string, stage: string, text: string) => {
        const trimmed = text.trim();
        if (!trimmed) return;

        try {
            const author = user?.email || (user as any)?.name || 'User';
            const res = await fetch('/api/admin/symb-plan/remarks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    shipment_week: shipmentWeek,
                    stage: stage,
                    remark: trimmed,
                    user_name: author
                })
            });
            if (res.ok) {
                const data = await res.json();
                const created: StageRemark = data.remark || data;
                setRemarks(prev => [created, ...prev.filter(r => r.id !== created.id)]);
            } else {
                const err = await res.json();
                alert(err.detail || 'Failed to save remark');
            }
        } catch (err) {
            console.error("Failed to add remark:", err);
            alert("Error saving remark");
        }
    };

    const handleUpdateRemark = async (remarkId: string, text: string) => {
        const trimmed = text.trim();
        if (!trimmed) return;

        try {
            const editor = user?.email || (user as any)?.name || 'User';
            const res = await fetch(`/api/admin/symb-plan/remarks/${remarkId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    remark: trimmed,
                    user_name: editor
                })
            });
            if (res.ok) {
                const data = await res.json();
                const updated: StageRemark = data.remark || data;
                setRemarks(prev => prev.map(r => r.id === remarkId ? updated : r));
                if (activeHistoryRemark && activeHistoryRemark.id === remarkId) {
                    setActiveHistoryRemark(updated);
                }
            } else {
                const err = await res.json();
                alert(err.detail || 'Failed to update remark');
            }
        } catch (err) {
            console.error("Failed to update remark:", err);
            alert("Error updating remark");
        }
    };

    const handleDeleteRemark = async (remarkId: string) => {
        if (!window.confirm("Are you sure you want to delete this remark?")) return;
        try {
            const res = await fetch(`/api/admin/symb-plan/remarks/${remarkId}`, {
                method: 'DELETE'
            });
            if (res.ok) {
                setRemarks(prev => prev.filter(r => r.id !== remarkId));
                if (activeHistoryRemark && activeHistoryRemark.id === remarkId) {
                    setActiveHistoryRemark(null);
                }
            } else {
                alert("Failed to delete remark");
            }
        } catch (err) {
            console.error("Failed to delete remark:", err);
            alert("Error deleting remark");
        }
    };

    const formatDateTime = (dateStr?: string) => {
        if (!dateStr) return '';
        try {
            const d = new Date(dateStr);
            if (isNaN(d.getTime())) return dateStr;
            return d.toLocaleString('en-GB', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
            });
        } catch {
            return dateStr;
        }
    };

    const filteredAndSortedData = useMemo(() => {
        let filtered = data;

        // Apply Variant Filter
        if (selectedVariant !== 'All') {
            filtered = filtered.filter(d => d["Variant Type"] === selectedVariant);
        }

        // Apply Date Filters based on "Shipment Week"
        if (fromDate) {
            const from = new Date(fromDate).getTime();
            filtered = filtered.filter(d => new Date(d["Shipment Week"]).getTime() >= from);
        }
        
        if (toDate) {
            const to = new Date(toDate).getTime();
            filtered = filtered.filter(d => new Date(d["Shipment Week"]).getTime() <= to);
        }

        // Sort by Shipment Week
        filtered.sort((a, b) => {
            const timeA = new Date(a["Shipment Week"]).getTime();
            const timeB = new Date(b["Shipment Week"]).getTime();
            return sortOrder === 'asc' ? timeA - timeB : timeB - timeA;
        });

        return filtered;
    }, [data, fromDate, toDate, sortOrder, selectedVariant]);

    // Group by Shipment Week (filtering out weeks where total planned quantity is 0 or week is Unknown)
    const groupedByWeek = useMemo(() => {
        const groups: Record<string, SymbPlanRow[]> = {};
        filteredAndSortedData.forEach(row => {
            const rawWeek = (row["Shipment Week"] || "").trim();
            if (!rawWeek || ['unknown', 'none', 'nat', 'nan', 'null'].includes(rawWeek.toLowerCase())) {
                return;
            }
            const weekStr = rawWeek.split(' ')[0];
            if (!groups[weekStr]) groups[weekStr] = [];
            groups[weekStr].push(row);
        });

        // Omit any shipment week where total planned quantity across all stages is 0
        const validGroups: Record<string, SymbPlanRow[]> = {};
        Object.entries(groups).forEach(([weekStr, rows]) => {
            const totalPlannedInWeek = rows.reduce((sum, r) => sum + (Number(r["planned Value"]) || 0), 0);
            if (totalPlannedInWeek > 0 && weekStr !== 'Unknown') {
                validGroups[weekStr] = rows;
            }
        });
        return validGroups;
    }, [filteredAndSortedData]);

    const getWeekBackfillInfo = (rows: SymbPlanRow[]) => {
        const variants = ["Variant 1", "Variant 2"];
        const maxNativeCompletedIdxMap: Record<string, number> = {};
        const maxNativeCompletedStageNameMap: Record<string, string> = {};

        variants.forEach(variantKey => {
            let maxIdx = -1;
            let stageName = '';

            EVENT_ORDER.forEach((evt, idx) => {
                const row = rows.find(r => r["Event Type"] === evt && (r["Variant Type"] || "").toLowerCase() === variantKey.toLowerCase());
                if (row) {
                    const isNativeCompleted = row["Material Covered"] === "Yes" || (row["planned Value"] > 0 && row.completed >= row["planned Value"]);
                    if (isNativeCompleted) {
                        maxIdx = idx;
                        stageName = evt;
                    }
                }
            });

            maxNativeCompletedIdxMap[variantKey] = maxIdx;
            maxNativeCompletedIdxMap[variantKey.toLowerCase()] = maxIdx;
            maxNativeCompletedStageNameMap[variantKey] = stageName;
            maxNativeCompletedStageNameMap[variantKey.toLowerCase()] = stageName;
        });

        return { maxNativeCompletedIdxMap, maxNativeCompletedStageNameMap };
    };

    const sortedShipmentWeeks = useMemo(() => {
        return Object.keys(groupedByWeek).sort((a, b) => {
            const timeA = new Date(a).getTime();
            const timeB = new Date(b).getTime();
            return timeA - timeB;
        });
    }, [groupedByWeek]);

    const isStageCoveredForWeekVariant = (weekStr: string, variantKey: string, stageTitle: string) => {
        const rows = groupedByWeek[weekStr] || [];
        const stageConfig = MILESTONE_STAGES.find(s => s.title === stageTitle);
        if (!stageConfig) return false;

        const { maxNativeCompletedIdxMap } = getWeekBackfillInfo(rows);
        const vMaxIdx = maxNativeCompletedIdxMap[variantKey.toLowerCase()] ?? -1;

        for (const evt of stageConfig.eventMatch) {
            const stageIdx = EVENT_ORDER.findIndex(e => e.toLowerCase() === evt.toLowerCase());
            const row = rows.find(r => r["Event Type"].toLowerCase() === evt.toLowerCase() && (r["Variant Type"] || "").toLowerCase() === variantKey.toLowerCase());
            if (row) {
                const isNativeCompleted = row["Material Covered"] === "Yes" || (row["planned Value"] > 0 && row.completed >= row["planned Value"]);
                const isBackfilled = !isNativeCompleted && (stageIdx >= 0 && stageIdx < vMaxIdx);
                if (isNativeCompleted || isBackfilled) return true;
            } else if (stageIdx >= 0 && stageIdx < vMaxIdx) {
                return true;
            }
        }
        return false;
    };

    const getTargetDateForWeekVariantStage = (weekStr: string, variantKey: string, stageTitle: string) => {
        const rows = groupedByWeek[weekStr] || [];
        const stageConfig = MILESTONE_STAGES.find(s => s.title === stageTitle);
        if (!stageConfig) return null;

        const row = rows.find(r => stageConfig.eventMatch.includes(r["Event Type"]) && (r["Variant Type"] || "").toLowerCase() === variantKey.toLowerCase());
        if (row) {
            if (row["Last Batch Date"]) {
                return String(row["Last Batch Date"]).split(' ')[0];
            }
            if (row["Estimated Completion Date"] && row["Estimated Completion Date"] !== "None" && row["Estimated Completion Date"] !== "N/A" && row["Estimated Completion Date"].trim() !== "") {
                return row["Estimated Completion Date"];
            }
        }
        return null;
    };

    const { completedWeeks, activeWeeks } = useMemo(() => {
        const completed: [string, SymbPlanRow[], number][] = [];
        const active: [string, SymbPlanRow[], number][] = [];

        Object.entries(groupedByWeek).forEach(([weekStr, rows]) => {
            const { maxNativeCompletedIdxMap } = getWeekBackfillInfo(rows);
            let completedSlots = 0;

            EVENT_ORDER.forEach((evt, stageIdx) => {
                const eventRows = rows.filter(r => r["Event Type"] === evt);
                eventRows.forEach(r => {
                    const variantKey = (r["Variant Type"] || "").toLowerCase();
                    const maxCompletedIdx = maxNativeCompletedIdxMap[variantKey] ?? -1;
                    const isNativeCompleted = r["Material Covered"] === "Yes" || (r["planned Value"] > 0 && r.completed >= r["planned Value"]);
                    const isBackfilled = !isNativeCompleted && stageIdx < maxCompletedIdx;

                    if (isNativeCompleted || isBackfilled) {
                        completedSlots++;
                    }
                });
            });

            const pct = Math.min(100, Math.round(completedSlots * (100 / 22)));
            if (pct === 100) {
                completed.push([weekStr, rows, pct]);
            } else {
                active.push([weekStr, rows, pct]);
            }
        });

        return { completedWeeks: completed, activeWeeks: active };
    }, [groupedByWeek]);

    // Calculate Project Coverage Percentage based on Shipment Weeks completion
    const projectCoverageStats = useMemo(() => {
        const totalWeeks = sortedShipmentWeeks.length;

        if (selectedCoverageStage) {
            // Count how many shipment weeks have this stage covered
            let coveredWeeksCount = 0;
            sortedShipmentWeeks.forEach(weekStr => {
                const v1Covered = isStageCoveredForWeekVariant(weekStr, 'Variant 1', selectedCoverageStage);
                const v2Covered = isStageCoveredForWeekVariant(weekStr, 'Variant 2', selectedCoverageStage);
                if (v1Covered || v2Covered) {
                    coveredWeeksCount++;
                }
            });

            const percent = totalWeeks > 0 ? Math.round((coveredWeeksCount / totalWeeks) * 100) : 0;

            return {
                stageTitle: selectedCoverageStage,
                completedWeeksCount: coveredWeeksCount,
                totalWeeks,
                percent
            };
        } else {
            // Overall Project: A week is completed if customer place data is done (pct === 100)
            const completedWeeksCount = completedWeeks.length;
            const percent = totalWeeks > 0 ? Math.round((completedWeeksCount / totalWeeks) * 100) : 0;

            return {
                stageTitle: 'Overall Project',
                completedWeeksCount,
                totalWeeks,
                percent
            };
        }
    }, [sortedShipmentWeeks, completedWeeks, selectedCoverageStage, isStageCoveredForWeekVariant]);

    const overallSummaryCards = useMemo(() => {
        const STAGES = [
            { 
                key: 'EBOM covered', 
                title: 'EBOM covered', 
                eventMatch: ['EBOM covered'],
                bgColor: '#eef2ff',
                borderColor: '#c7d2fe',
                titleColor: '#3730a3',
                numColor: '#4338ca',
                subTextColor: '#6366f1'
            },
            { 
                key: 'PCBA', 
                title: 'PCBA', 
                eventMatch: ['PCBA covered', 'PCBA Ready'],
                bgColor: '#eff6ff',
                borderColor: '#bfdbfe',
                titleColor: '#1e40af',
                numColor: '#1d4ed8',
                subTextColor: '#2563eb'
            },
            { 
                key: 'All Material Available', 
                title: 'All Material Available', 
                eventMatch: ['All Material Available'],
                bgColor: '#fffbeb',
                borderColor: '#fde68a',
                titleColor: '#92400e',
                numColor: '#b45309',
                subTextColor: '#d97706'
            },
            { 
                key: 'Materials Issued', 
                title: 'Materials Issued', 
                eventMatch: ['Materials Issued'],
                bgColor: '#f5f3ff',
                borderColor: '#ddd6fe',
                titleColor: '#5b21b6',
                numColor: '#6d28d9',
                subTextColor: '#7c3aed'
            },
            { 
                key: 'Active alignment', 
                title: 'Active Alignment', 
                eventMatch: ['Active alignment'],
                bgColor: '#fffbeb',
                borderColor: '#fde68a',
                titleColor: '#92400e',
                numColor: '#b45309',
                subTextColor: '#d97706'
            },
            { 
                key: 'Production/Assembly', 
                title: 'Production / Assembly', 
                eventMatch: ['Production/Assembly'],
                bgColor: '#f0fdfa',
                borderColor: '#99f6e4',
                titleColor: '#115e59',
                numColor: '#0f766e',
                subTextColor: '#0d9488'
            },
            { 
                key: 'FQC', 
                title: 'FQC', 
                eventMatch: ['FQC'],
                bgColor: '#eef2ff',
                borderColor: '#c7d2fe',
                titleColor: '#3730a3',
                numColor: '#4338ca',
                subTextColor: '#4f46e5'
            },
            { 
                key: 'Finished goods', 
                title: 'Finished Goods', 
                eventMatch: ['Finished goods'],
                bgColor: '#ecfdf5',
                borderColor: '#a7f3d0',
                titleColor: '#065f46',
                numColor: '#047857',
                subTextColor: '#059669'
            }
        ];

        return STAGES.map(stage => {
            const stageRows = data.filter(r => stage.eventMatch.includes(r["Event Type"]));
            
            const v1Sum = stageRows
                .filter(r => (r["Variant Type"] || "").toLowerCase().includes("1"))
                .reduce((acc, curr) => acc + (curr.completed || 0), 0);
                
            const v2Sum = stageRows
                .filter(r => (r["Variant Type"] || "").toLowerCase().includes("2"))
                .reduce((acc, curr) => acc + (curr.completed || 0), 0);

            return {
                title: stage.title,
                v1: v1Sum,
                v2: v2Sum,
                total: v1Sum + v2Sum,
                bgColor: stage.bgColor,
                borderColor: stage.borderColor,
                titleColor: stage.titleColor,
                numColor: stage.numColor,
                subTextColor: stage.subTextColor
            };
        });
    }, [data]);

    // Buffer Stages Tracked (from EBOM covered to Finished goods)
    const BUFFER_STAGES = useMemo(() => [
        "EBOM covered",
        "PCBA covered",
        "All Material Available",
        "Materials Issued",
        "Active alignment",
        "Production/Assembly",
        "FQC",
        "Finished goods"
    ], []);

    // Comprehensive Weekly Buffer Analysis (Evaluated against 4-Week Finished Goods cushion)
    const weeklyBufferData = useMemo(() => {
        const today = new Date();
        const todayMid = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();

        const list: WeekBufferAnalysis[] = [];

        sortedShipmentWeeks.forEach(weekStr => {
            const rows = groupedByWeek[weekStr] || [];
            const shipDate = parseDateSafe(weekStr) || new Date();
            
            // Standard target is 4 weeks (28 days) before shipment date
            const targetFgDate = new Date(shipDate.getTime() - (28 * 86400000));

            // Find Finished goods row
            const fgRows = rows.filter(r => r["Event Type"] === "Finished goods");
            const isFgCompleted = fgRows.length > 0 && fgRows.every(r => 
                r["Material Covered"] === "Yes" || (Number(r["planned Value"] || 0) > 0 && Number(r.completed || 0) >= Number(r["planned Value"] || 0))
            );

            let actualFgDate: Date | null = null;
            if (isFgCompleted && fgRows.length > 0) {
                const dates = fgRows.map(r => parseDateSafe(r["Actual Completed Date"] || r.actual_completed_date)).filter(Boolean) as Date[];
                if (dates.length > 0) {
                    actualFgDate = new Date(Math.max(...dates.map(d => d.getTime())));
                }
            }

            let maxSlippageDays = 0;
            let primaryEaterStage = 'All on track';

            const stageBreakdowns = BUFFER_STAGES.map(stageName => {
                const stageRows = rows.filter(r => r["Event Type"] === stageName);
                if (stageRows.length === 0) {
                    return {
                        stage: stageName,
                        targetDate: null,
                        actualDate: null,
                        estDate: null,
                        slippageDays: 0,
                        isCompleted: false
                    };
                }

                // Target date from Last Batch Date
                const targetDates = stageRows.map(r => parseDateSafe(r["Last Batch Date"])).filter(Boolean) as Date[];
                const targetDate = targetDates.length > 0 ? targetDates[0] : null;

                const isCompleted = stageRows.every(r => 
                    r["Material Covered"] === "Yes" || (Number(r["planned Value"] || 0) > 0 && Number(r.completed || 0) >= Number(r["planned Value"] || 0))
                );

                const actualDates = stageRows.map(r => parseDateSafe(r["Actual Completed Date"] || r.actual_completed_date)).filter(Boolean) as Date[];
                const actualDate = actualDates.length > 0 ? new Date(Math.max(...actualDates.map(d => d.getTime()))) : null;

                const estDates = stageRows.map(r => parseDateSafe(r["Estimated Completion Date"])).filter(Boolean) as Date[];
                const estDate = estDates.length > 0 ? new Date(Math.max(...estDates.map(d => d.getTime()))) : null;

                let slippageDays = 0;
                if (targetDate) {
                    if (isCompleted) {
                        if (actualDate) {
                            slippageDays = Math.max(0, Math.round((actualDate.getTime() - targetDate.getTime()) / 86400000));
                        }
                    } else {
                        if (estDate) {
                            slippageDays = Math.max(0, Math.round((estDate.getTime() - targetDate.getTime()) / 86400000));
                        } else if (todayMid > targetDate.getTime()) {
                            slippageDays = Math.max(0, Math.round((todayMid - targetDate.getTime()) / 86400000));
                        }
                    }
                }

                if (slippageDays > maxSlippageDays) {
                    maxSlippageDays = slippageDays;
                    primaryEaterStage = stageName;
                }

                return {
                    stage: stageName,
                    targetDate,
                    actualDate,
                    estDate,
                    slippageDays,
                    isCompleted
                };
            });

            const bufferDays = 28 - maxSlippageDays;
            const bufferWeeks = Number((bufferDays / 7.0).toFixed(1));
            const projectedFgDate = new Date(targetFgDate.getTime() + (maxSlippageDays * 86400000));

            let status: 'healthy' | 'consumed' | 'at_risk' | 'breached';
            if (bufferWeeks >= 3.5) status = 'healthy';
            else if (bufferWeeks >= 2.0) status = 'consumed';
            else if (bufferWeeks > 0.0) status = 'at_risk';
            else status = 'breached';

            let v1Planned = 0;
            let v2Planned = 0;
            rows.forEach(r => {
                const v = (r["Variant Type"] || "").toLowerCase();
                const p = Number(r["planned Value"] || 0);
                if (v.includes("1") && p > v1Planned) v1Planned = p;
                if (v.includes("2") && p > v2Planned) v2Planned = p;
            });

            list.push({
                weekStr,
                shipDate,
                targetFgDate,
                projectedFgDate,
                actualFgDate,
                isFgCompleted,
                maxSlippageDays,
                bufferDays,
                bufferWeeks,
                status,
                primaryEaterStage: maxSlippageDays > 0 ? primaryEaterStage : 'All on track',
                stageBreakdowns,
                v1Planned,
                v2Planned,
                totalPlanned: v1Planned + v2Planned
            });
        });

        return list;
    }, [sortedShipmentWeeks, groupedByWeek, BUFFER_STAGES]);

    // Fast Lookup Map for Header Pills & Card Badges
    const weeklyBufferMap = useMemo(() => {
        const map = new Map<string, WeekBufferAnalysis & {
            statusBg: string;
            statusColor: string;
            statusBorder: string;
            statusLabel: string;
            targetFgFormatted: string;
            projectedFgFormatted: string;
        }>();

        weeklyBufferData.forEach(item => {
            let statusBg = '#ecfdf5';
            let statusColor = '#065f46';
            let statusBorder = '#a7f3d0';
            let statusLabel = 'Healthy (Full Cushion)';

            if (item.status === 'consumed') {
                statusBg = '#fffbeb';
                statusColor = '#92400e';
                statusBorder = '#fde68a';
                statusLabel = 'Buffer Consumed';
            } else if (item.status === 'at_risk') {
                statusBg = '#fff7ed';
                statusColor = '#9a3412';
                statusBorder = '#fed7aa';
                statusLabel = 'At Risk (< 2 wks)';
            } else if (item.status === 'breached') {
                statusBg = '#fef2f2';
                statusColor = '#991b1b';
                statusBorder = '#fecaca';
                statusLabel = 'Breached (Overdue)';
            }

            const targetFgFormatted = item.targetFgDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
            const projectedFgFormatted = item.isFgCompleted && item.actualFgDate
                ? item.actualFgDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                : item.projectedFgDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

            map.set(item.weekStr, {
                ...item,
                statusBg,
                statusColor,
                statusBorder,
                statusLabel,
                targetFgFormatted,
                projectedFgFormatted
            });
        });

        return map;
    }, [weeklyBufferData]);

    // High-level Executive KPIs for Buffer Dashboard
    const bufferExecutiveKPIs = useMemo(() => {
        if (weeklyBufferData.length === 0) {
            return {
                avgBufferWeeks: 4.0,
                avgBufferDays: 28,
                healthyCount: 0,
                consumedCount: 0,
                atRiskCount: 0,
                breachedCount: 0,
                totalWeeks: 0,
                topBottleneckStage: 'None',
                topBottleneckDays: 0
            };
        }

        const totalWeeks = weeklyBufferData.length;
        const totalBufferDays = weeklyBufferData.reduce((sum, w) => sum + w.bufferDays, 0);
        const avgBufferDays = Math.round(totalBufferDays / totalWeeks);
        const avgBufferWeeks = Number((avgBufferDays / 7.0).toFixed(1));

        let healthyCount = 0;
        let consumedCount = 0;
        let atRiskCount = 0;
        let breachedCount = 0;

        weeklyBufferData.forEach(w => {
            if (w.status === 'healthy') healthyCount++;
            else if (w.status === 'consumed') consumedCount++;
            else if (w.status === 'at_risk') atRiskCount++;
            else if (w.status === 'breached') breachedCount++;
        });

        // Stage attribution: sum of slippage per stage across all weeks
        const stageSums: Record<string, number> = {};
        BUFFER_STAGES.forEach(s => { stageSums[s] = 0; });

        weeklyBufferData.forEach(w => {
            w.stageBreakdowns.forEach(sb => {
                if (sb.slippageDays > 0) {
                    stageSums[sb.stage] = (stageSums[sb.stage] || 0) + sb.slippageDays;
                }
            });
        });

        let topBottleneckStage = 'All on track';
        let topBottleneckDays = 0;
        Object.entries(stageSums).forEach(([stg, days]) => {
            if (days > topBottleneckDays) {
                topBottleneckDays = days;
                topBottleneckStage = stg;
            }
        });

        return {
            avgBufferWeeks,
            avgBufferDays,
            healthyCount,
            consumedCount,
            atRiskCount,
            breachedCount,
            totalWeeks,
            topBottleneckStage,
            topBottleneckDays
        };
    }, [weeklyBufferData, BUFFER_STAGES]);

    // Stage Buffer Attribution Ranking (Which stage is eating the most cushion?)
    const stageBufferAttribution = useMemo(() => {
        const list: { stage: string; totalDaysEaten: number; impactedWeeksCount: number; pctShare: number }[] = [];
        let totalPipelineDaysLost = 0;

        BUFFER_STAGES.forEach(stageName => {
            let totalDaysEaten = 0;
            let impactedWeeksCount = 0;

            weeklyBufferData.forEach(w => {
                const sb = w.stageBreakdowns.find(s => s.stage === stageName);
                if (sb && sb.slippageDays > 0) {
                    totalDaysEaten += sb.slippageDays;
                    impactedWeeksCount++;
                }
            });

            totalPipelineDaysLost += totalDaysEaten;
            list.push({
                stage: stageName,
                totalDaysEaten,
                impactedWeeksCount,
                pctShare: 0
            });
        });

        if (totalPipelineDaysLost > 0) {
            list.forEach(item => {
                item.pctShare = Math.round((item.totalDaysEaten / totalPipelineDaysLost) * 100);
            });
        }

        return list.sort((a, b) => b.totalDaysEaten - a.totalDaysEaten);
    }, [weeklyBufferData, BUFFER_STAGES]);

    // Filtered & Sorted Weekly Buffer List for the Buffer Available Grid
    const filteredWeeklyBufferList = useMemo(() => {
        let list = [...weeklyBufferData];

        if (selectedBufferStage) {
            list = list.filter(w => {
                const sb = w.stageBreakdowns.find(s => s.stage === selectedBufferStage);
                return sb && sb.slippageDays > 0;
            });
        }

        if (bufferFilter === 'at_risk') {
            list = list.filter(w => w.status === 'at_risk');
        } else if (bufferFilter === 'breached') {
            list = list.filter(w => w.status === 'breached');
        } else if (bufferFilter === 'healthy') {
            list = list.filter(w => w.status === 'healthy');
        }

        if (bufferSortMode === 'least_buffer') {
            list.sort((a, b) => a.bufferDays - b.bufferDays);
        } else {
            list.sort((a, b) => a.shipDate.getTime() - b.shipDate.getTime());
        }

        return list;
    }, [weeklyBufferData, bufferFilter, bufferSortMode, selectedBufferStage]);

    const handleWeekClick = (weekStr: string) => {
        // If the target week is in completedWeeks, ensure accordion is open so card exists in DOM
        const isCompleted = completedWeeks.some(([w]) => w === weekStr);
        if (isCompleted && !isCompletedSectionOpen) {
            setIsCompletedSectionOpen(true);
        }

        setHighlightedWeek(weekStr);

        setTimeout(() => {
            const el = document.getElementById(`week-card-${weekStr}`);
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }, 120);

        setTimeout(() => {
            setHighlightedWeek(prev => (prev === weekStr ? null : prev));
        }, 2500);
    };

    const renderVariantSection = (row: SymbPlanRow, isBackfilled: boolean, backfillSourceStage?: string, backfillActualCompDate?: string) => {
        const isNativeCompleted = row["Material Covered"] === "Yes" || (row["planned Value"] > 0 && row.completed >= row["planned Value"]);
        const isCompleted = isNativeCompleted || isBackfilled;
        const isDelayed = !isCompleted && row["Delayed by days"] > 0;
        const isAutofilled = Boolean(row.is_autofilled || row["is_autofilled"]);
        const unplannedQty = Number(row.unplanned_qty || row["unplanned_qty"] || 0);
        const warningMsg = row.warning_msg || row["warning_msg"] || (unplannedQty > 0 ? `There is no plan for remaining qty (${unplannedQty.toLocaleString()} units). Please update!` : '');
        const actualCompDate = row["Actual Completed Date"] || row["actual_completed_date"] || backfillActualCompDate;
        
        return (
            <div key={row.id} style={{ 
                padding: '0.75rem', 
                backgroundColor: isBackfilled ? '#f1f5f9' : '#f8fafc', 
                borderRadius: '8px',
                borderLeft: `4px solid ${unplannedQty > 0 ? '#ef4444' : isNativeCompleted ? '#10b981' : isBackfilled ? '#94a3b8' : isDelayed ? '#ef4444' : '#f59e0b'}`,
                marginBottom: '0.5rem',
                fontSize: '0.85rem'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                    <span style={{ fontWeight: 700, color: isBackfilled ? '#475569' : '#1e293b' }}>{row["Variant Type"]}</span>
                    <span style={{
                        padding: '0.15rem 0.5rem',
                        borderRadius: '12px',
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        backgroundColor: isNativeCompleted ? '#dcfce7' : isBackfilled ? '#e2e8f0' : isDelayed ? '#fee2e2' : '#fef3c7',
                        color: isNativeCompleted ? '#166534' : isBackfilled ? '#475569' : isDelayed ? '#991b1b' : '#92400e'
                    }}>
                        {isNativeCompleted ? 'Completed' : isBackfilled ? 'Auto-Completed' : isDelayed ? 'Delayed' : 'Pending'}
                    </span>
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem', color: isBackfilled ? '#64748b' : '#475569', flexWrap: 'wrap', gap: '0.2rem' }}>
                    <span>Planned: <strong style={{ color: isAutofilled ? '#1d4ed8' : '#1e293b' }}>{Number(row["planned Value"] || 0).toLocaleString()}</strong></span>
                    <span>Completed: <strong>{isBackfilled ? (Number(row["planned Value"]) || 0).toLocaleString() : (Number(row.completed) || 0).toLocaleString()}</strong></span>
                </div>

                {isAutofilled && (
                    <div style={{ color: '#1e40af', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.25rem', backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', padding: '0.2rem 0.4rem', borderRadius: '4px', fontWeight: 600 }}>
                        <RefreshCw size={11} style={{ flexShrink: 0 }} />
                        <span>Planned auto-updated from previous stage completed ({Number(row.original_planned_value || 0).toLocaleString()} ➔ {Number(row["planned Value"] || 0).toLocaleString()})</span>
                    </div>
                )}

                {warningMsg && (
                    <div style={{ color: '#991b1b', fontSize: '0.73rem', display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.35rem', backgroundColor: '#fef2f2', border: '1px solid #fecaca', padding: '0.3rem 0.5rem', borderRadius: '4px', fontWeight: 700 }}>
                        <ShieldAlert size={14} style={{ color: '#dc2626', flexShrink: 0 }} />
                        <span>{warningMsg.replace(/^⚠️\s*/, '')}</span>
                    </div>
                )}

                {isBackfilled && (
                    <div style={{ color: '#475569', fontSize: '0.73rem', display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.3rem', backgroundColor: '#e2e8f0', padding: '0.25rem 0.4rem', borderRadius: '4px' }}>
                        <CheckCircle2 size={12} style={{ color: '#64748b', flexShrink: 0 }} />
                        <span>Auto-completed (Data not updated; backfilled from {backfillSourceStage})</span>
                    </div>
                )}

                {isDelayed && (
                    <div style={{ color: '#dc2626', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.3rem' }}>
                        <AlertCircle size={12} />
                        Delayed by {row["Delayed by days"]} days ({row["Delayed by weeks"]} wks)
                    </div>
                )}
                
                {(!isCompleted && row["Estimated Completion Date"]) && (
                    <div style={{ color: '#0369a1', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.3rem', backgroundColor: '#e0f2fe', padding: '0.25rem 0.4rem', borderRadius: '4px' }}>
                        <CalendarDays size={12} />
                        Will complete on: <strong>{row["Estimated Completion Date"]}</strong>
                    </div>
                )}

                {(isCompleted && actualCompDate) && (
                    <div style={{ color: '#166534', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.3rem', backgroundColor: '#dcfce7', padding: '0.25rem 0.4rem', borderRadius: '4px' }}>
                        <CheckCircle2 size={12} style={{ color: '#16a34a', flexShrink: 0 }} />
                        Actual completed date: <strong>{actualCompDate}</strong>
                    </div>
                )}

                {(() => {
                    if (!isAdmin) return null;
                    const rowLbd = parseDateSafe(row["Last Batch Date"]);
                    const rowAct = parseDateSafe(actualCompDate);
                    const rowEst = parseDateSafe(row["Estimated Completion Date"]);
                    let slip = 0;
                    if (rowLbd) {
                        if (isCompleted && rowAct) {
                            slip = Math.max(0, Math.round((rowAct.getTime() - rowLbd.getTime()) / 86400000));
                        } else if (!isCompleted) {
                            if (rowEst) {
                                slip = Math.max(0, Math.round((rowEst.getTime() - rowLbd.getTime()) / 86400000));
                            } else {
                                const nowMid = new Date();
                                nowMid.setHours(0, 0, 0, 0);
                                if (nowMid.getTime() > rowLbd.getTime()) {
                                    slip = Math.max(0, Math.round((nowMid.getTime() - rowLbd.getTime()) / 86400000));
                                }
                            }
                        }
                    }
                    if (slip <= 0) return null;
                    return (
                        <div style={{ color: '#9a3412', fontSize: '0.73rem', display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.3rem', backgroundColor: '#fff7ed', border: '1px solid #fed7aa', padding: '0.2rem 0.45rem', borderRadius: '4px', fontWeight: 600 }}>
                            <ShieldAlert size={12} style={{ color: '#ea580c', flexShrink: 0 }} />
                            <span>Buffer Impact: <strong>-{slip} days</strong> eaten by this stage</span>
                        </div>
                    );
                })()}
            </div>
        );
    };

    const renderWeekCardBlock = (weekStr: string, rows: SymbPlanRow[], pct: number) => {
        const isComplete = pct === 100;
        const weekBufInfo = isAdmin ? weeklyBufferMap.get(weekStr) : undefined;
        const { maxNativeCompletedIdxMap, maxNativeCompletedStageNameMap } = getWeekBackfillInfo(rows);

        const v1MaxIdx = maxNativeCompletedIdxMap['Variant 1'] ?? maxNativeCompletedIdxMap['variant 1'] ?? -1;
        const v2MaxIdx = maxNativeCompletedIdxMap['Variant 2'] ?? maxNativeCompletedIdxMap['variant 2'] ?? -1;

        let quickSummaryText = '';
        if (v1MaxIdx >= 0 && v2MaxIdx >= 0) {
            if (v1MaxIdx === v2MaxIdx) {
                quickSummaryText = `${EVENT_ORDER[v1MaxIdx]} both done`;
            } else {
                quickSummaryText = `${EVENT_ORDER[v1MaxIdx]} V1 & ${EVENT_ORDER[v2MaxIdx]} V2 done`;
            }
        } else if (v1MaxIdx >= 0) {
            quickSummaryText = `${EVENT_ORDER[v1MaxIdx]} V1 done only`;
        } else if (v2MaxIdx >= 0) {
            quickSummaryText = `${EVENT_ORDER[v2MaxIdx]} V2 done only`;
        } else {
            quickSummaryText = 'No stages completed';
        }

        const isHighlighted = highlightedWeek === weekStr;

        return (
            <div 
                key={weekStr} 
                id={`week-card-${weekStr}`}
                style={{ 
                    border: isHighlighted ? '3px solid #3b82f6' : '1px solid #e2e8f0', 
                    borderRadius: '12px', 
                    overflow: 'hidden',
                    boxShadow: isHighlighted ? '0 0 24px rgba(59, 130, 246, 0.45)' : 'none',
                    transition: 'all 0.3s ease'
                }}
            >
                <div style={{ backgroundColor: '#1e293b', padding: '0.75rem 1.5rem', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Calendar size={18} style={{ color: '#f5ad42' }} />
                            <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>Shipment Week: {weekStr}</h4>
                        </div>

                        <span style={{
                            backgroundColor: isComplete ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 173, 66, 0.15)',
                            color: isComplete ? '#34d399' : '#fbbf24',
                            border: `1px solid ${isComplete ? '#059669' : '#d97706'}`,
                            padding: '0.25rem 0.75rem',
                            borderRadius: '16px',
                            fontSize: '0.8rem',
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.35rem'
                        }}>
                            <CheckCircle2 size={13} />
                            {quickSummaryText}
                        </span>

                        {isAdmin && weekBufInfo && (
                            <span 
                                title={`Finished Goods Target: ${weekBufInfo.targetFgFormatted} • Projected/Actual FG: ${weekBufInfo.projectedFgFormatted} • Primary Bottleneck: ${weekBufInfo.primaryEaterStage}`}
                                style={{
                                    backgroundColor: weekBufInfo.statusBg,
                                    color: weekBufInfo.statusColor,
                                    border: `1px solid ${weekBufInfo.statusBorder}`,
                                    padding: '0.25rem 0.75rem',
                                    borderRadius: '16px',
                                    fontSize: '0.8rem',
                                    fontWeight: 700,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.35rem'
                                }}
                            >
                                {weekBufInfo.bufferWeeks >= 3.5 ? <ShieldCheck size={13} /> : <ShieldAlert size={13} />}
                                Buffer: {weekBufInfo.bufferWeeks} wks ({weekBufInfo.bufferDays >= 0 ? `${weekBufInfo.bufferDays}d cushion` : `${Math.abs(weekBufInfo.bufferDays)}d breached`})
                            </span>
                        )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', backgroundColor: '#0f172a', padding: '0.35rem 0.75rem', borderRadius: '20px', border: '1px solid #334155' }}>
                        <ProgressRing percentage={pct} />
                        <span style={{ fontSize: '0.9rem', fontWeight: 800, color: isComplete ? '#10b981' : '#f5ad42' }}>
                            {pct}% Completed
                        </span>
                    </div>
                </div>
                
                <div style={{ display: 'flex', padding: '1.5rem', gap: '1rem', overflowX: 'auto', backgroundColor: '#f1f5f9' }}>
                    {EVENT_ORDER.map((eventType, idx) => {
                        const eventRows = rows.filter(r => r["Event Type"] === eventType);
                        
                        const missingPlanVariants = eventRows
                            .filter(row => {
                                const variantKey = (row["Variant Type"] || "").toLowerCase();
                                const maxCompletedIdx = maxNativeCompletedIdxMap[variantKey] ?? -1;
                                const isNativeCompleted = row["Material Covered"] === "Yes" || (row["planned Value"] > 0 && row.completed >= row["planned Value"]);
                                const isBackfilled = !isNativeCompleted && idx < maxCompletedIdx;
                                const isCompleted = isNativeCompleted || isBackfilled;

                                const hasEstDate = row["Estimated Completion Date"] && 
                                                   row["Estimated Completion Date"] !== "None" && 
                                                   row["Estimated Completion Date"] !== "N/A" && 
                                                   row["Estimated Completion Date"].trim() !== "";
                                return !isCompleted && !hasEstDate;
                            })
                            .map(row => {
                                const vType = row["Variant Type"] || "";
                                if (vType.toLowerCase().includes("1")) return "V1";
                                if (vType.toLowerCase().includes("2")) return "V2";
                                return vType;
                            });

                        let criticalMsg = "";
                        if (missingPlanVariants.length > 0) {
                            const uniqueVariants = Array.from(new Set(missingPlanVariants));
                            const variantStr = uniqueVariants.join(" & ");
                            criticalMsg = `${eventType} Plan not available for ${variantStr}`;
                        }

                        const rawBatchDate = eventRows.find(r => r["Last Batch Date"])?.["Last Batch Date"];
                        let cardBatchDate = '';
                        if (rawBatchDate) {
                            try {
                                const d = new Date(rawBatchDate);
                                if (!isNaN(d.getTime())) {
                                    cardBatchDate = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
                                } else {
                                    cardBatchDate = String(rawBatchDate).split(' ')[0];
                                }
                            } catch {
                                cardBatchDate = String(rawBatchDate).split(' ')[0];
                            }
                        }

                        return (
                            <React.Fragment key={eventType}>
                                <div style={{ 
                                    width: '330px',
                                    minWidth: '330px', 
                                    maxWidth: '330px',
                                    flex: '0 0 330px', 
                                    backgroundColor: '#ffffff', 
                                    borderRadius: '10px', 
                                    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    overflow: 'hidden'
                                }}>
                                    <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #f1f5f9', color: '#334155', textAlign: 'center' }}>
                                        <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#1e293b' }}>{eventType}</div>
                                        {cardBatchDate && (
                                            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginTop: '0.25rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}>
                                                <Clock size={12} style={{ color: '#0284c7' }} />
                                                Should be completed on : <span style={{ color: '#0284c7', fontWeight: 700 }}>{cardBatchDate}</span>
                                            </div>
                                        )}
                                    </div>
                                    <div style={{ padding: '1rem', flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
                                        {eventRows.length === 0 ? (
                                            <div style={{ textAlign: 'center', color: '#cbd5e1', fontSize: '0.85rem', marginTop: '1rem' }}>No data</div>
                                        ) : (
                                            eventRows.map(row => {
                                                const variantKey = (row["Variant Type"] || "").toLowerCase();
                                                const maxCompletedIdx = maxNativeCompletedIdxMap[variantKey] ?? -1;
                                                const isNativeCompleted = row["Material Covered"] === "Yes" || (row["planned Value"] > 0 && row.completed >= row["planned Value"]);
                                                const isBackfilled = !isNativeCompleted && idx < maxCompletedIdx;
                                                const backfillSourceStage = isBackfilled ? maxNativeCompletedStageNameMap[variantKey] : '';
                                                const backfillSourceRow = isBackfilled && backfillSourceStage 
                                                    ? rows.find(r => r["Event Type"] === backfillSourceStage && (r["Variant Type"] || "").toLowerCase() === variantKey) 
                                                    : null;
                                                const backfillActualCompDate = backfillSourceRow 
                                                    ? (backfillSourceRow["Actual Completed Date"] || backfillSourceRow["actual_completed_date"]) 
                                                    : undefined;

                                                return renderVariantSection(row, isBackfilled, backfillSourceStage, backfillActualCompDate);
                                            })
                                        )}

                                        {criticalMsg && (
                                            <div style={{
                                                marginTop: 'auto',
                                                padding: '0.6rem 0.75rem',
                                                backgroundColor: '#fef2f2',
                                                border: '1px solid #fecaca',
                                                borderRadius: '6px',
                                                color: '#991b1b',
                                                fontSize: '0.78rem',
                                                fontWeight: 700,
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '0.4rem'
                                            }}>
                                                <AlertCircle size={16} style={{ color: '#ef4444', flexShrink: 0 }} />
                                                <span>{criticalMsg}</span>
                                            </div>
                                        )}

                                        {/* Remarks Section */}
                                        {(() => {
                                            const cardRemarks = remarks
                                                .filter(r => r.shipment_week === weekStr && r.stage === eventType)
                                                .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

                                            return (
                                                <div style={{
                                                    marginTop: '0.85rem',
                                                    paddingTop: '0.65rem',
                                                    borderTop: '1px dashed #e2e8f0',
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    gap: '0.35rem',
                                                    minWidth: 0,
                                                    width: '100%'
                                                }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem', fontWeight: 700, color: '#475569' }}>
                                                            <MessageSquare size={13} style={{ color: '#6366f1' }} />
                                                            <span>Remarks</span>
                                                            {cardRemarks.length > 0 && (
                                                                <span style={{
                                                                    fontSize: '0.65rem',
                                                                    backgroundColor: '#e0e7ff',
                                                                    color: '#4338ca',
                                                                    borderRadius: '9999px',
                                                                    padding: '0.05rem 0.4rem',
                                                                    fontWeight: 800
                                                                }}>
                                                                    {cardRemarks.length}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                                            {cardRemarks.length > 0 && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setActiveModalStage({ weekStr, stage: eventType })}
                                                                    style={{
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        gap: '0.2rem',
                                                                        fontSize: '0.7rem',
                                                                        fontWeight: 600,
                                                                        color: '#475569',
                                                                        backgroundColor: '#f1f5f9',
                                                                        border: '1px solid #cbd5e1',
                                                                        cursor: 'pointer',
                                                                        padding: '0.15rem 0.4rem',
                                                                        borderRadius: '4px'
                                                                    }}
                                                                    title="Expand remarks popup"
                                                                >
                                                                    <Maximize2 size={11} />
                                                                    <span>Expand</span>
                                                                </button>
                                                            )}
                                                            <button
                                                                type="button"
                                                                onClick={() => setActiveModalStage({ weekStr, stage: eventType })}
                                                                style={{
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    gap: '0.2rem',
                                                                    fontSize: '0.7rem',
                                                                    fontWeight: 600,
                                                                    color: '#4f46e5',
                                                                    backgroundColor: '#eef2ff',
                                                                    border: '1px solid #c7d2fe',
                                                                    cursor: 'pointer',
                                                                    padding: '0.15rem 0.4rem',
                                                                    borderRadius: '4px'
                                                                }}
                                                                title="Add or view remarks"
                                                            >
                                                                <Plus size={11} />
                                                                <span>Add</span>
                                                            </button>
                                                        </div>
                                                    </div>

                                                    {/* Preview of latest remark if present */}
                                                    {cardRemarks.length > 0 ? (
                                                        <div
                                                            onClick={() => setActiveModalStage({ weekStr, stage: eventType })}
                                                            style={{
                                                                backgroundColor: '#f8fafc',
                                                                border: '1px solid #e2e8f0',
                                                                borderRadius: '6px',
                                                                padding: '0.4rem 0.5rem',
                                                                fontSize: '0.72rem',
                                                                cursor: 'pointer',
                                                                transition: 'all 0.15s ease',
                                                                width: '100%',
                                                                boxSizing: 'border-box',
                                                                minWidth: 0
                                                            }}
                                                            title="Click to expand remarks in pop-up"
                                                            onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f1f5f9'}
                                                            onMouseLeave={e => e.currentTarget.style.backgroundColor = '#f8fafc'}
                                                        >
                                                            <div style={{
                                                                color: '#1e293b',
                                                                lineHeight: 1.35,
                                                                wordBreak: 'break-all',
                                                                overflowWrap: 'anywhere',
                                                                whiteSpace: 'pre-wrap',
                                                                display: '-webkit-box',
                                                                WebkitLineClamp: 2,
                                                                WebkitBoxOrient: 'vertical',
                                                                overflow: 'hidden'
                                                            }}>
                                                                {cardRemarks[cardRemarks.length - 1].remark}
                                                            </div>
                                                            <div style={{
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'space-between',
                                                                marginTop: '0.25rem',
                                                                fontSize: '0.64rem',
                                                                color: '#64748b'
                                                            }}>
                                                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '180px' }}>
                                                                    By {cardRemarks[cardRemarks.length - 1].created_by?.split('@')[0]}
                                                                </span>
                                                                <span style={{ color: '#4f46e5', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.15rem' }}>
                                                                    {cardRemarks.length > 1 ? `+${cardRemarks.length - 1} more • Expand` : 'Expand'}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div 
                                                            onClick={() => setActiveModalStage({ weekStr, stage: eventType })}
                                                            style={{ 
                                                                fontSize: '0.7rem', 
                                                                color: '#94a3b8', 
                                                                fontStyle: 'italic', 
                                                                cursor: 'pointer',
                                                                padding: '0.2rem 0'
                                                            }}
                                                        >
                                                            + Add remark...
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })()}
                                    </div>
                                </div>
                                
                                {idx < EVENT_ORDER.length - 1 && (
                                    <div style={{ display: 'flex', alignItems: 'center', color: '#94a3b8' }}>
                                        <ArrowRight size={24} />
                                    </div>
                                )}
                            </React.Fragment>
                        );
                    })}
                </div>
            </div>
        );
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '300px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                    <RefreshCw className="animate-spin" size={32} style={{ color: '#3b82f6' }} />
                    <span style={{ color: '#64748b', fontWeight: 600 }}>Loading plan pipeline data...</span>
                </div>
            </div>
        );
    }

    return (
        <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Filter Bar */}
            <div style={{ 
                backgroundColor: '#ffffff', 
                padding: '1rem 1.5rem', 
                borderRadius: '12px', 
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                border: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                gap: '1.5rem',
                flexWrap: 'wrap'
            }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b' }}>Variant Filter</label>
                    <select 
                        value={selectedVariant}
                        onChange={e => setSelectedVariant(e.target.value)}
                        style={{ padding: '0.4rem 0.8rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.9rem' }}
                    >
                        <option value="All">All Variants</option>
                        <option value="Variant 1">Variant 1</option>
                        <option value="Variant 2">Variant 2</option>
                    </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b' }}>From Shipment Date</label>
                    <input 
                        type="date" 
                        value={fromDate}
                        onChange={e => setFromDate(e.target.value)}
                        style={{ padding: '0.4rem 0.8rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.9rem' }}
                    />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b' }}>To Shipment Date</label>
                    <input 
                        type="date" 
                        value={toDate}
                        onChange={e => setToDate(e.target.value)}
                        style={{ padding: '0.4rem 0.8rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.9rem' }}
                    />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b' }}>Sorting (Shipment Week)</label>
                    <button 
                        onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                        style={{ 
                            padding: '0.4rem 0.8rem', 
                            borderRadius: '6px', 
                            border: '1px solid #cbd5e1', 
                            backgroundColor: '#f8fafc',
                            cursor: 'pointer',
                            fontSize: '0.9rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.4rem'
                        }}
                    >
                        <Filter size={14} />
                        {sortOrder === 'asc' ? 'Oldest to Newest' : 'Newest to Oldest'}
                    </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', marginLeft: 'auto' }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b' }}>Pipeline Data</label>
                    <button 
                        onClick={handleRefresh}
                        disabled={isRefreshing || loading}
                        style={{ 
                            padding: '0.4rem 1.2rem', 
                            border: 'none', 
                            borderRadius: '6px', 
                            fontSize: '0.9rem',
                            backgroundColor: (isRefreshing || loading) ? '#94a3b8' : '#3b82f6',
                            color: '#ffffff',
                            fontWeight: 700,
                            cursor: (isRefreshing || loading) ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            boxShadow: '0 2px 4px rgba(59, 130, 246, 0.25)',
                            transition: 'all 0.2s ease'
                        }}
                    >
                        <RefreshCw size={14} style={{ animation: (isRefreshing || loading) ? 'spin 1s linear infinite' : 'none' }} />
                        {isRefreshing ? 'Recalculating...' : 'Recalculate & Refresh'}
                    </button>
                </div>
            </div>

            {/* Overall Stage Completed Summary Cards */}
            <div style={{ marginBottom: '1rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                {overallSummaryCards.map(card => {
                    const isSelected = selectedCoverageStage === card.title;
                    return (
                        <div key={card.title} style={{ 
                            backgroundColor: card.bgColor, 
                            borderRadius: '10px', 
                            padding: '0.9rem 1rem', 
                            border: `2px solid ${isSelected ? card.titleColor : card.borderColor}`,
                            boxShadow: isSelected ? `0 4px 12px ${card.borderColor}` : '0 2px 5px rgba(0,0,0,0.04)',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                            transition: 'all 0.2s ease'
                        }}>
                            <div>
                                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: card.titleColor, textTransform: 'uppercase', marginBottom: '0.6rem' }}>
                                    {card.title}
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginBottom: '0.5rem' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.92rem' }}>
                                        <span style={{ color: card.titleColor, fontWeight: 600 }}>Variant 1:</span>
                                        <strong style={{ fontSize: '1.15rem', fontWeight: 800, color: card.numColor }}>{card.v1.toLocaleString()}</strong>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.92rem' }}>
                                        <span style={{ color: card.titleColor, fontWeight: 600 }}>Variant 2:</span>
                                        <strong style={{ fontSize: '1.15rem', fontWeight: 800, color: card.numColor }}>{card.v2.toLocaleString()}</strong>
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={() => setSelectedCoverageStage(isSelected ? null : card.title)}
                                style={{
                                    marginTop: '0.65rem',
                                    padding: '0.4rem 0.75rem',
                                    fontSize: '0.78rem',
                                    fontWeight: 700,
                                    borderRadius: '6px',
                                    border: `1px solid ${isSelected ? card.titleColor : card.borderColor}`,
                                    backgroundColor: isSelected ? card.titleColor : '#ffffff',
                                    color: isSelected ? '#ffffff' : card.titleColor,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '0.35rem',
                                    width: '100%',
                                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                                    transition: 'all 0.15s ease'
                                }}
                            >
                                <Eye size={13} /> {isSelected ? 'Selected (Click to Clear)' : 'View Coverage'}
                            </button>
                        </div>
                    );
                })}
            </div>

            {/* Milestone Lines Coverage Timeline Section */}
            <div style={{
                backgroundColor: '#ffffff',
                borderRadius: '12px',
                padding: '1.25rem 1.5rem',
                border: '1px solid #e2e8f0',
                boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                marginBottom: '1.5rem'
            }}>
                {/* Project Coverage Percentage Banner */}
                <div style={{
                    backgroundColor: selectedCoverageStage ? '#1e293b' : '#0f172a',
                    borderRadius: '10px',
                    padding: '1rem 1.25rem',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '1rem',
                    flexWrap: 'wrap',
                    marginBottom: '1.25rem',
                    border: '1px solid #334155'
                }}>
                    <div>
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                            {selectedCoverageStage ? `Stage Project Coverage (${projectCoverageStats.stageTitle})` : 'Overall Project Coverage & Progress'}
                        </div>
                        <div style={{ fontSize: '1.3rem', fontWeight: 800, color: selectedCoverageStage ? '#38bdf8' : projectCoverageStats.percent === 100 ? '#34d399' : '#fbbf24', marginTop: '0.25rem' }}>
                            {selectedCoverageStage 
                                ? `${projectCoverageStats.percent}% of total project is covered for ${projectCoverageStats.stageTitle}`
                                : projectCoverageStats.percent === 100 ? '🎉 100% of Total Project Completed' : `Total ${projectCoverageStats.percent}% of Project Completed`
                            }
                        </div>
                    </div>
                    <div style={{ textAlign: 'right', fontSize: '0.82rem', color: '#cbd5e1', backgroundColor: 'rgba(255,255,255,0.05)', padding: '0.5rem 0.85rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
                        <div>{selectedCoverageStage ? 'Covered Weeks:' : 'Completed Weeks:'} <strong style={{ color: '#34d399' }}>{projectCoverageStats.completedWeeksCount}</strong></div>
                        <div style={{ marginTop: '0.15rem' }}>Total Shipment Weeks: <strong style={{ color: '#f8fafc' }}>{projectCoverageStats.totalWeeks}</strong></div>
                    </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <Layers size={20} style={{ color: '#2563eb' }} />
                        <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#1e293b' }}>
                            {selectedCoverageStage ? `${selectedCoverageStage} Coverage Line` : 'Default Shipment Week Milestones'}
                        </h3>
                        {selectedCoverageStage ? (
                            <span style={{
                                fontSize: '0.8rem',
                                fontWeight: 700,
                                padding: '0.25rem 0.75rem',
                                borderRadius: '12px',
                                backgroundColor: MILESTONE_STAGES.find(s => s.title === selectedCoverageStage)?.bg || '#eff6ff',
                                color: MILESTONE_STAGES.find(s => s.title === selectedCoverageStage)?.color || '#2563eb',
                                border: `1px solid ${MILESTONE_STAGES.find(s => s.title === selectedCoverageStage)?.border || '#bfdbfe'}`
                            }}>
                                Showing {selectedCoverageStage} Coverage Line
                            </span>
                        ) : (
                            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b', backgroundColor: '#f1f5f9', padding: '0.25rem 0.75rem', borderRadius: '12px' }}>
                                Showing All 5 Milestone Stage Lines
                            </span>
                        )}
                    </div>

                    {selectedCoverageStage && (
                        <button
                            onClick={() => setSelectedCoverageStage(null)}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.3rem',
                                padding: '0.35rem 0.75rem',
                                borderRadius: '6px',
                                border: '1px solid #cbd5e1',
                                backgroundColor: '#f8fafc',
                                color: '#475569',
                                fontSize: '0.8rem',
                                fontWeight: 600,
                                cursor: 'pointer'
                            }}
                        >
                            <X size={14} /> Clear Filter
                        </button>
                    )}
                </div>

                {/* Render Horizontal Milestone Lines */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    {selectedCoverageStage ? (
                        // Render single stage milestone line when stage coverage card is clicked
                        MILESTONE_STAGES.filter(s => s.title === selectedCoverageStage).map(stage => {
                            const variants = ['Variant 1', 'Variant 2'];
                            return (
                                <div key={stage.title} style={{
                                    backgroundColor: stage.bg,
                                    borderRadius: '10px',
                                    padding: '1rem 1.25rem',
                                    border: `1px solid ${stage.border}`
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                                        <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: stage.color }} />
                                        <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: stage.color }}>
                                            {stage.title} Coverage Milestone Line
                                        </h4>
                                    </div>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                                        {variants.map(variantName => (
                                            <div key={variantName} style={{ backgroundColor: '#ffffff', borderRadius: '8px', padding: '0.85rem 1rem', border: '1px solid #e2e8f0' }}>
                                                <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#334155', marginBottom: '0.75rem' }}>
                                                    {variantName}
                                                </div>

                                                <div style={{ overflowX: 'auto', paddingBottom: '0.5rem' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', minWidth: 'max-content' }}>
                                                        {sortedShipmentWeeks.map((weekStr, idx) => {
                                                            const isCovered = isStageCoveredForWeekVariant(weekStr, variantName, stage.title);
                                                            const targetDate = getTargetDateForWeekVariantStage(weekStr, variantName, stage.title);
                                                            const isLast = idx === sortedShipmentWeeks.length - 1;

                                                            return (
                                                                <div key={weekStr} style={{ display: 'flex', alignItems: 'center' }}>
                                                                    <div 
                                                                        onClick={() => handleWeekClick(weekStr)}
                                                                        title={`Click to scroll to Shipment Week ${weekStr} in pipeline`}
                                                                        style={{ 
                                                                            display: 'flex', 
                                                                            flexDirection: 'column', 
                                                                            alignItems: 'center', 
                                                                            gap: '0.35rem', 
                                                                            minWidth: '110px',
                                                                            cursor: 'pointer',
                                                                            userSelect: 'none',
                                                                            transition: 'transform 0.15s ease'
                                                                        }}
                                                                        onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.08)'}
                                                                        onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                                                                    >
                                                                        <span style={{ fontSize: '0.73rem', fontWeight: 700, color: isCovered ? stage.color : '#64748b' }}>
                                                                            {weekStr}
                                                                        </span>

                                                                        <div style={{
                                                                            width: '28px',
                                                                            height: '28px',
                                                                            borderRadius: '50%',
                                                                            backgroundColor: isCovered ? stage.color : '#f1f5f9',
                                                                            border: `2px solid ${isCovered ? stage.color : '#cbd5e1'}`,
                                                                            display: 'flex',
                                                                            alignItems: 'center',
                                                                            justifyContent: 'center',
                                                                            color: isCovered ? '#ffffff' : '#64748b',
                                                                            boxShadow: isCovered ? `0 2px 6px ${stage.border}` : 'none',
                                                                            transition: 'all 0.2s ease'
                                                                        }}>
                                                                            {isCovered ? (
                                                                                <Check size={16} strokeWidth={3} />
                                                                            ) : (
                                                                                <span style={{ fontSize: '0.7rem', fontWeight: 700 }}>⏳</span>
                                                                            )}
                                                                        </div>

                                                                        <span style={{
                                                                            fontSize: '0.68rem',
                                                                            fontWeight: 700,
                                                                            padding: '0.15rem 0.45rem',
                                                                            borderRadius: '8px',
                                                                            backgroundColor: isCovered ? '#dcfce7' : '#f1f5f9',
                                                                            color: isCovered ? '#15803d' : '#64748b',
                                                                            border: `1px solid ${isCovered ? '#bbf7d0' : '#cbd5e1'}`,
                                                                            textAlign: 'center'
                                                                        }}>
                                                                            {isCovered 
                                                                                ? '✓ Covered' 
                                                                                : targetDate 
                                                                                    ? `Not Covered (Target: ${targetDate})` 
                                                                                    : 'Not Covered'
                                                                            }
                                                                        </span>
                                                                    </div>

                                                                    {!isLast && (
                                                                        <div style={{
                                                                            width: '45px',
                                                                            height: isCovered ? '3px' : '2px',
                                                                            backgroundColor: isCovered ? stage.color : '#cbd5e1',
                                                                            borderStyle: isCovered ? 'solid' : 'dashed',
                                                                            margin: '0 0.2rem',
                                                                            alignSelf: 'center',
                                                                            marginTop: '-0.7rem'
                                                                        }} />
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        // Default View when NO card is selected: Default milestone line showing highest stage completed per week
                        <div style={{
                            backgroundColor: '#f8fafc',
                            borderRadius: '10px',
                            padding: '1rem 1.25rem',
                            border: '1px solid #e2e8f0'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                                <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#0284c7' }} />
                                <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: '#0369a1' }}>
                                    Default Shipment Week Stage Milestone Line
                                </h4>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                                {['Variant 1', 'Variant 2'].map(variantName => (
                                    <div key={variantName} style={{ backgroundColor: '#ffffff', borderRadius: '8px', padding: '0.85rem 1rem', border: '1px solid #e2e8f0' }}>
                                        <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#334155', marginBottom: '0.75rem' }}>
                                            {variantName}
                                        </div>

                                        <div style={{ overflowX: 'auto', paddingBottom: '0.5rem' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', minWidth: 'max-content' }}>
                                                {sortedShipmentWeeks.map((weekStr, idx) => {
                                                    const rows = groupedByWeek[weekStr] || [];
                                                    const { maxNativeCompletedIdxMap } = getWeekBackfillInfo(rows);
                                                    const maxIdx = maxNativeCompletedIdxMap[variantName.toLowerCase()] ?? -1;
                                                    const isCovered = maxIdx >= 0;
                                                    const stageName = isCovered ? EVENT_ORDER[maxIdx] : '';
                                                    const theme = isCovered ? getStageThemeColor(stageName) : null;
                                                    const isLast = idx === sortedShipmentWeeks.length - 1;

                                                    return (
                                                        <div key={weekStr} style={{ display: 'flex', alignItems: 'center' }}>
                                                            <div 
                                                                onClick={() => handleWeekClick(weekStr)}
                                                                title={`Click to scroll to Shipment Week ${weekStr} in pipeline`}
                                                                style={{ 
                                                                    display: 'flex', 
                                                                    flexDirection: 'column', 
                                                                    alignItems: 'center', 
                                                                    gap: '0.35rem', 
                                                                    minWidth: '120px',
                                                                    cursor: 'pointer',
                                                                    userSelect: 'none',
                                                                    transition: 'transform 0.15s ease'
                                                                }}
                                                                onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.08)'}
                                                                onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                                                            >
                                                                <span style={{ fontSize: '0.73rem', fontWeight: 700, color: theme ? theme.color : '#64748b' }}>
                                                                    {weekStr}
                                                                </span>

                                                                <div style={{
                                                                    width: '28px',
                                                                    height: '28px',
                                                                    borderRadius: '50%',
                                                                    backgroundColor: theme ? theme.color : '#f1f5f9',
                                                                    border: `2px solid ${theme ? theme.color : '#cbd5e1'}`,
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'center',
                                                                    color: theme ? '#ffffff' : '#64748b',
                                                                    boxShadow: theme ? `0 2px 6px ${theme.border}` : 'none',
                                                                    transition: 'all 0.2s ease'
                                                                }}>
                                                                    {isCovered ? (
                                                                        <Check size={16} strokeWidth={3} />
                                                                    ) : (
                                                                        <span style={{ fontSize: '0.7rem', fontWeight: 700 }}>⏳</span>
                                                                    )}
                                                                </div>

                                                                <span style={{
                                                                    fontSize: '0.68rem',
                                                                    fontWeight: 700,
                                                                    padding: '0.15rem 0.5rem',
                                                                    borderRadius: '8px',
                                                                    backgroundColor: theme ? theme.bg : '#f1f5f9',
                                                                    color: theme ? theme.text : '#64748b',
                                                                    border: `1px solid ${theme ? theme.border : '#cbd5e1'}`,
                                                                    textAlign: 'center'
                                                                }}>
                                                                    {isCovered ? `✓ ${stageName} done` : 'Not Covered'}
                                                                </span>
                                                            </div>

                                                            {!isLast && (
                                                                <div style={{
                                                                    width: '45px',
                                                                    height: theme ? '3px' : '2px',
                                                                    backgroundColor: theme ? theme.color : '#cbd5e1',
                                                                    borderStyle: theme ? 'solid' : 'dashed',
                                                                    margin: '0 0.2rem',
                                                                    alignSelf: 'center',
                                                                    marginTop: '-0.7rem'
                                                                }} />
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Buffer Available & Risk Analysis Section (Admin Only) */}
            {isAdmin && (
                <div style={{
                    backgroundColor: '#ffffff',
                    borderRadius: '12px',
                    padding: '1.25rem 1.5rem',
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                    marginBottom: '1.5rem'
                }}>
                    {/* Header Banner */}
                    <div style={{
                        backgroundColor: '#0f172a',
                        borderRadius: '10px',
                        padding: '1rem 1.25rem',
                        color: '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '1rem',
                        flexWrap: 'wrap',
                        marginBottom: '1.25rem',
                        border: '1px solid #334155'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <div style={{ backgroundColor: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa', padding: '0.5rem', borderRadius: '8px', display: 'flex' }}>
                                <ShieldAlert size={22} />
                            </div>
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                    <span style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                        Admin Executive Insight
                                    </span>
                                    <span style={{ fontSize: '0.65rem', backgroundColor: '#3b82f6', color: '#ffffff', padding: '0.1rem 0.45rem', borderRadius: '9999px', fontWeight: 800 }}>
                                        🔒 ADMIN ONLY
                                    </span>
                                </div>
                                <h3 style={{ margin: '0.2rem 0 0 0', fontSize: '1.3rem', fontWeight: 800, color: '#f8fafc' }}>
                                    Buffer Available & Execution Risk Analysis
                                </h3>
                                <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.78rem', color: '#94a3b8' }}>
                                    Standard Policy: Cameras must reach Finished Goods <strong>4 weeks (28 days)</strong> before customer shipment date.
                                </p>
                            </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                            <button
                                type="button"
                                onClick={() => setIsBufferSectionOpen(!isBufferSectionOpen)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.35rem',
                                    padding: '0.4rem 0.85rem',
                                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                                    color: '#f8fafc',
                                    border: '1px solid rgba(255, 255, 255, 0.2)',
                                    borderRadius: '6px',
                                    fontSize: '0.78rem',
                                    fontWeight: 700,
                                    cursor: 'pointer'
                                }}
                            >
                                {isBufferSectionOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                {isBufferSectionOpen ? 'Collapse Buffer Panel' : 'Expand Buffer Panel'}
                            </button>
                        </div>
                    </div>

                    {isBufferSectionOpen && (
                        <>
                            {/* KPI Summary Cards Grid */}
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                                gap: '1rem',
                                marginBottom: '1.25rem'
                            }}>
                                {/* Card 1: Avg Buffer Available */}
                                <div style={{
                                    backgroundColor: bufferExecutiveKPIs.avgBufferWeeks >= 3.5 ? '#ecfdf5' : bufferExecutiveKPIs.avgBufferWeeks >= 2.0 ? '#fffbeb' : '#fef2f2',
                                    border: `1px solid ${bufferExecutiveKPIs.avgBufferWeeks >= 3.5 ? '#a7f3d0' : bufferExecutiveKPIs.avgBufferWeeks >= 2.0 ? '#fde68a' : '#fecaca'}`,
                                    borderRadius: '10px',
                                    padding: '1rem',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '0.35rem'
                                }}>
                                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <span>AVG BUFFER IN HAND</span>
                                        <Clock size={15} style={{ color: bufferExecutiveKPIs.avgBufferWeeks >= 3.5 ? '#059669' : '#d97706' }} />
                                    </div>
                                    <div style={{ fontSize: '1.75rem', fontWeight: 900, color: bufferExecutiveKPIs.avgBufferWeeks >= 3.5 ? '#065f46' : bufferExecutiveKPIs.avgBufferWeeks >= 2.0 ? '#92400e' : '#991b1b' }}>
                                        {bufferExecutiveKPIs.avgBufferWeeks} <span style={{ fontSize: '1rem', fontWeight: 700 }}>weeks</span>
                                    </div>
                                    <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                                        {bufferExecutiveKPIs.avgBufferDays} days avg cushion ({bufferExecutiveKPIs.totalWeeks} total shipment batches)
                                    </div>
                                    {/* Mini cushion progress meter */}
                                    <div style={{ marginTop: '0.3rem', width: '100%', height: '6px', backgroundColor: '#e2e8f0', borderRadius: '9999px', overflow: 'hidden' }}>
                                        <div style={{
                                            width: `${Math.min(100, Math.max(0, Math.round((bufferExecutiveKPIs.avgBufferDays / 28) * 100)))}%`,
                                            height: '100%',
                                            backgroundColor: bufferExecutiveKPIs.avgBufferWeeks >= 3.5 ? '#10b981' : bufferExecutiveKPIs.avgBufferWeeks >= 2.0 ? '#f59e0b' : '#ef4444',
                                            borderRadius: '9999px'
                                        }} />
                                    </div>
                                </div>

                                {/* Card 2: Healthy Weeks */}
                                <div style={{
                                    backgroundColor: '#f0fdf4',
                                    border: '1px solid #bbf7d0',
                                    borderRadius: '10px',
                                    padding: '1rem',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '0.35rem'
                                }}>
                                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#166534', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <span>HEALTHY WEEKS</span>
                                        <ShieldCheck size={16} style={{ color: '#16a34a' }} />
                                    </div>
                                    <div style={{ fontSize: '1.75rem', fontWeight: 900, color: '#15803d' }}>
                                        {bufferExecutiveKPIs.healthyCount} <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#166534' }}>/ {bufferExecutiveKPIs.totalWeeks} wks</span>
                                    </div>
                                    <div style={{ fontSize: '0.72rem', color: '#166534' }}>
                                        Full 4-week safety cushion intact (≥ 3.5 wks)
                                    </div>
                                </div>

                                {/* Card 3: At Risk & Depleted Weeks */}
                                <div style={{
                                    backgroundColor: bufferExecutiveKPIs.atRiskCount > 0 ? '#fff7ed' : '#f8fafc',
                                    border: `1px solid ${bufferExecutiveKPIs.atRiskCount > 0 ? '#fed7aa' : '#e2e8f0'}`,
                                    borderRadius: '10px',
                                    padding: '1rem',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '0.35rem'
                                }}>
                                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#9a3412', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <span>BUFFER ERODED (AT RISK)</span>
                                        <TrendingDown size={16} style={{ color: '#ea580c' }} />
                                    </div>
                                    <div style={{ fontSize: '1.75rem', fontWeight: 900, color: '#c2410c' }}>
                                        {bufferExecutiveKPIs.atRiskCount + bufferExecutiveKPIs.consumedCount} <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#9a3412' }}>weeks</span>
                                    </div>
                                    <div style={{ fontSize: '0.72rem', color: '#7c2d12' }}>
                                        {bufferExecutiveKPIs.atRiskCount} critical (&lt; 2 wks) • {bufferExecutiveKPIs.consumedCount} caution (2-3.4 wks)
                                    </div>
                                </div>

                                {/* Card 4: Breached & Top Culprit */}
                                <div style={{
                                    backgroundColor: bufferExecutiveKPIs.breachedCount > 0 ? '#fef2f2' : '#f8fafc',
                                    border: `1px solid ${bufferExecutiveKPIs.breachedCount > 0 ? '#fecaca' : '#e2e8f0'}`,
                                    borderRadius: '10px',
                                    padding: '1rem',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '0.35rem'
                                }}>
                                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#991b1b', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <span>CRITICAL / BREACHED</span>
                                        <AlertCircle size={16} style={{ color: '#dc2626' }} />
                                    </div>
                                    <div style={{ fontSize: '1.75rem', fontWeight: 900, color: '#b91c1c' }}>
                                        {bufferExecutiveKPIs.breachedCount} <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#991b1b' }}>weeks</span>
                                    </div>
                                    <div style={{ fontSize: '0.72rem', color: '#7f1d1d' }}>
                                        Top Eater: <strong>{bufferExecutiveKPIs.topBottleneckStage}</strong> (-{bufferExecutiveKPIs.topBottleneckDays}d)
                                    </div>
                                </div>
                            </div>

                            {/* Stage Attribution Breakdown ("Which Stage is Eating Buffer?") */}
                            <div style={{
                                backgroundColor: '#f8fafc',
                                borderRadius: '10px',
                                border: '1px solid #e2e8f0',
                                padding: '1rem 1.25rem',
                                marginBottom: '1.25rem'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <Activity size={18} style={{ color: '#6366f1' }} />
                                        <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: '#1e293b' }}>
                                            Which Stage is Eating Buffer Time? (Factory Attribution)
                                        </h4>
                                    </div>
                                    {selectedBufferStage && (
                                        <button
                                            type="button"
                                            onClick={() => setSelectedBufferStage(null)}
                                            style={{
                                                fontSize: '0.75rem',
                                                padding: '0.2rem 0.6rem',
                                                borderRadius: '4px',
                                                backgroundColor: '#e2e8f0',
                                                color: '#334155',
                                                border: 'none',
                                                cursor: 'pointer',
                                                fontWeight: 600
                                            }}
                                        >
                                            Clear Stage Filter ({selectedBufferStage})
                                        </button>
                                    )}
                                </div>

                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                                    gap: '0.75rem'
                                }}>
                                    {stageBufferAttribution.map(item => {
                                        const isSelected = selectedBufferStage === item.stage;
                                        const theme = getStageThemeColor(item.stage);
                                        const hasDelay = item.totalDaysEaten > 0;

                                        return (
                                            <div 
                                                key={item.stage}
                                                onClick={() => setSelectedBufferStage(isSelected ? null : item.stage)}
                                                style={{
                                                    backgroundColor: isSelected ? '#eff6ff' : '#ffffff',
                                                    border: `1px solid ${isSelected ? '#3b82f6' : hasDelay ? '#fecaca' : '#e2e8f0'}`,
                                                    borderRadius: '8px',
                                                    padding: '0.75rem',
                                                    cursor: 'pointer',
                                                    transition: 'all 0.15s ease',
                                                    boxShadow: isSelected ? '0 0 0 2px #93c5fd' : '0 1px 3px rgba(0,0,0,0.03)'
                                                }}
                                            >
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                                                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: theme.color }}>
                                                        {item.stage}
                                                    </span>
                                                    <span style={{
                                                        fontSize: '0.7rem',
                                                        fontWeight: 800,
                                                        padding: '0.1rem 0.45rem',
                                                        borderRadius: '9999px',
                                                        backgroundColor: hasDelay ? '#fee2e2' : '#dcfce7',
                                                        color: hasDelay ? '#991b1b' : '#166534'
                                                    }}>
                                                        {hasDelay ? `-${item.totalDaysEaten} days` : '0 days (On Track)'}
                                                    </span>
                                                </div>

                                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#64748b', marginBottom: '0.4rem' }}>
                                                    <span>Impacts: <strong>{item.impactedWeeksCount} shipment batches</strong></span>
                                                    <span>{item.pctShare}% of total delay</span>
                                                </div>

                                                {/* Bar */}
                                                <div style={{ width: '100%', height: '5px', backgroundColor: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
                                                    <div style={{
                                                        width: `${Math.min(100, Math.max(0, item.pctShare))}%`,
                                                        height: '100%',
                                                        backgroundColor: hasDelay ? '#ef4444' : '#10b981',
                                                        borderRadius: '4px'
                                                    }} />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Weekly Buffer Navigation & Strip Controls */}
                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                marginBottom: '0.75rem',
                                flexWrap: 'wrap',
                                gap: '0.75rem'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569' }}>Filter Batches:</span>
                                    
                                    <button
                                        type="button"
                                        onClick={() => setBufferFilter('all')}
                                        style={{
                                            padding: '0.25rem 0.7rem',
                                            fontSize: '0.75rem',
                                            borderRadius: '6px',
                                            border: '1px solid #cbd5e1',
                                            backgroundColor: bufferFilter === 'all' ? '#1e293b' : '#ffffff',
                                            color: bufferFilter === 'all' ? '#ffffff' : '#475569',
                                            fontWeight: 700,
                                            cursor: 'pointer'
                                        }}
                                    >
                                        All Weeks ({weeklyBufferData.length})
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setBufferFilter('at_risk')}
                                        style={{
                                            padding: '0.25rem 0.7rem',
                                            fontSize: '0.75rem',
                                            borderRadius: '6px',
                                            border: '1px solid #fed7aa',
                                            backgroundColor: bufferFilter === 'at_risk' ? '#ea580c' : '#fff7ed',
                                            color: bufferFilter === 'at_risk' ? '#ffffff' : '#9a3412',
                                            fontWeight: 700,
                                            cursor: 'pointer'
                                        }}
                                    >
                                        At Risk (&lt; 2 wks) ({bufferExecutiveKPIs.atRiskCount})
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setBufferFilter('breached')}
                                        style={{
                                            padding: '0.25rem 0.7rem',
                                            fontSize: '0.75rem',
                                            borderRadius: '6px',
                                            border: '1px solid #fecaca',
                                            backgroundColor: bufferFilter === 'breached' ? '#dc2626' : '#fef2f2',
                                            color: bufferFilter === 'breached' ? '#ffffff' : '#991b1b',
                                            fontWeight: 700,
                                            cursor: 'pointer'
                                        }}
                                    >
                                        Breached (≤ 0 wks) ({bufferExecutiveKPIs.breachedCount})
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setBufferFilter('healthy')}
                                        style={{
                                            padding: '0.25rem 0.7rem',
                                            fontSize: '0.75rem',
                                            borderRadius: '6px',
                                            border: '1px solid #a7f3d0',
                                            backgroundColor: bufferFilter === 'healthy' ? '#059669' : '#ecfdf5',
                                            color: bufferFilter === 'healthy' ? '#ffffff' : '#065f46',
                                            fontWeight: 700,
                                            cursor: 'pointer'
                                        }}
                                    >
                                        Healthy (≥ 3.5 wks) ({bufferExecutiveKPIs.healthyCount})
                                    </button>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <span style={{ fontSize: '0.78rem', color: '#64748b' }}>Sort:</span>
                                    <select
                                        value={bufferSortMode}
                                        onChange={e => setBufferSortMode(e.target.value as any)}
                                        style={{
                                            padding: '0.25rem 0.6rem',
                                            fontSize: '0.76rem',
                                            borderRadius: '6px',
                                            border: '1px solid #cbd5e1',
                                            backgroundColor: '#ffffff',
                                            color: '#334155',
                                            fontWeight: 600,
                                            outline: 'none'
                                        }}
                                    >
                                        <option value="least_buffer">Least Buffer First (Highest Risk)</option>
                                        <option value="chronological">Chronological (Shipment Date)</option>
                                    </select>
                                </div>
                            </div>

                            {/* Horizontal / Grid of Shipment Week Buffer Cards */}
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                                gap: '0.85rem',
                                maxHeight: '420px',
                                overflowY: 'auto',
                                padding: '0.5rem',
                                backgroundColor: '#f1f5f9',
                                borderRadius: '10px',
                                border: '1px solid #e2e8f0'
                            }}>
                                {filteredWeeklyBufferList.length === 0 ? (
                                    <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '2rem', color: '#64748b', fontSize: '0.85rem' }}>
                                        No shipment batches match the selected filter criteria.
                                    </div>
                                ) : (
                                    filteredWeeklyBufferList.map(item => {
                                        const bufInfo = weeklyBufferMap.get(item.weekStr);
                                        if (!bufInfo) return null;

                                        return (
                                            <div 
                                                key={item.weekStr}
                                                style={{
                                                    backgroundColor: '#ffffff',
                                                    borderRadius: '8px',
                                                    padding: '0.85rem 1rem',
                                                    border: `1px solid ${bufInfo.statusBorder}`,
                                                    borderLeft: `5px solid ${bufInfo.statusColor}`,
                                                    boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    gap: '0.45rem'
                                                }}
                                            >
                                                {/* Header row */}
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <span style={{ fontSize: '0.88rem', fontWeight: 800, color: '#1e293b' }}>
                                                        {item.weekStr}
                                                    </span>
                                                    <span style={{
                                                        fontSize: '0.72rem',
                                                        fontWeight: 800,
                                                        padding: '0.15rem 0.5rem',
                                                        borderRadius: '12px',
                                                        backgroundColor: bufInfo.statusBg,
                                                        color: bufInfo.statusColor,
                                                        border: `1px solid ${bufInfo.statusBorder}`
                                                    }}>
                                                        Buffer: {item.bufferWeeks} wks
                                                    </span>
                                                </div>

                                                {/* Cushion Details */}
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', fontSize: '0.75rem', color: '#475569' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                        <span>FG Target (S-28d):</span>
                                                        <strong style={{ color: '#0369a1' }}>{bufInfo.targetFgFormatted}</strong>
                                                    </div>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                        <span>FG Projected / Actual:</span>
                                                        <strong style={{ color: item.maxSlippageDays > 0 ? '#b91c1c' : '#166534' }}>
                                                            {bufInfo.projectedFgFormatted}
                                                        </strong>
                                                    </div>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                        <span>Cushion in Hand:</span>
                                                        <strong style={{ color: item.bufferDays >= 0 ? '#166534' : '#b91c1c' }}>
                                                            {item.bufferDays >= 0 ? `${item.bufferDays} days remaining` : `${Math.abs(item.bufferDays)} days overdue`}
                                                        </strong>
                                                    </div>
                                                </div>

                                                {/* Top Eater Tag */}
                                                <div style={{
                                                    fontSize: '0.72rem',
                                                    padding: '0.25rem 0.45rem',
                                                    borderRadius: '4px',
                                                    backgroundColor: item.maxSlippageDays > 0 ? '#fff7ed' : '#ecfdf5',
                                                    border: `1px solid ${item.maxSlippageDays > 0 ? '#fed7aa' : '#a7f3d0'}`,
                                                    color: item.maxSlippageDays > 0 ? '#9a3412' : '#065f46',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'space-between'
                                                }}>
                                                    <span>{item.maxSlippageDays > 0 ? `Top Bottleneck: ${item.primaryEaterStage}` : '✓ All Stages On Track'}</span>
                                                    {item.maxSlippageDays > 0 && <strong>-{item.maxSlippageDays}d</strong>}
                                                </div>

                                                {/* Jump to Week Button */}
                                                <button
                                                    type="button"
                                                    onClick={() => handleWeekClick(item.weekStr)}
                                                    style={{
                                                        marginTop: '0.2rem',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        gap: '0.35rem',
                                                        padding: '0.3rem 0.5rem',
                                                        fontSize: '0.74rem',
                                                        fontWeight: 700,
                                                        backgroundColor: '#f8fafc',
                                                        color: '#2563eb',
                                                        border: '1px solid #bfdbfe',
                                                        borderRadius: '6px',
                                                        cursor: 'pointer'
                                                    }}
                                                >
                                                    <ArrowUpRight size={13} />
                                                    Jump to Pipeline Card ↓
                                                </button>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* Completed in all green Accordion */}
            {completedWeeks.length > 0 && (
                <div style={{ marginBottom: '1rem', border: '1px solid #bbf7d0', borderRadius: '12px', backgroundColor: '#f0fdf4', overflow: 'hidden' }}>
                    <button 
                        onClick={() => setIsCompletedSectionOpen(!isCompletedSectionOpen)}
                        style={{ 
                            width: '100%', 
                            padding: '0.9rem 1.5rem', 
                            backgroundColor: '#dcfce7', 
                            border: 'none', 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'space-between',
                            cursor: 'pointer',
                            color: '#14532d'
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                            <CheckCircle2 size={20} style={{ color: '#16a34a' }} />
                            <span style={{ fontSize: '1rem', fontWeight: 800 }}>
                                Completed in all green ({completedWeeks.length} {completedWeeks.length === 1 ? 'Week' : 'Weeks'} Completed)
                            </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', fontWeight: 700, color: '#15803d' }}>
                            <span>{isCompletedSectionOpen ? 'Hide Completed Weeks' : 'Show Completed Weeks'}</span>
                            <ChevronDown size={18} style={{ transform: isCompletedSectionOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease' }} />
                        </div>
                    </button>
                    
                    {isCompletedSectionOpen && (
                        <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '2rem', backgroundColor: '#f8fafc', borderTop: '1px solid #bbf7d0' }}>
                            {completedWeeks.map(([weekStr, rows, pct]) => renderWeekCardBlock(weekStr, rows, pct))}
                        </div>
                    )}
                </div>
            )}

            {/* Pipeline Visualization (Active / In-Progress Weeks) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                {Object.keys(groupedByWeek).length === 0 ? (
                    <div style={{ textAlign: 'center', color: '#94a3b8', padding: '2rem' }}>No data matches the selected filters.</div>
                ) : activeWeeks.length === 0 && completedWeeks.length > 0 ? (
                    <div style={{ textAlign: 'center', color: '#15803d', padding: '2rem', backgroundColor: '#f0fdf4', borderRadius: '12px', border: '1px solid #bbf7d0', fontWeight: 600 }}>
                        🎉 All shipment weeks are 100% completed and listed under "Completed in all green" above!
                    </div>
                ) : (
                    activeWeeks.map(([weekStr, rows, pct]) => renderWeekCardBlock(weekStr, rows, pct))
                )}
            </div>

            {/* Stage Remarks Pop-up Modal */}
            {activeModalStage && (
                <StageRemarksModal
                    weekStr={activeModalStage.weekStr}
                    stage={activeModalStage.stage}
                    remarks={remarks}
                    onClose={() => setActiveModalStage(null)}
                    onAddRemark={(text) => handleAddRemark(activeModalStage.weekStr, activeModalStage.stage, text)}
                    onUpdateRemark={(id, text) => handleUpdateRemark(id, text)}
                    onDeleteRemark={(id) => handleDeleteRemark(id)}
                    formatDateTime={formatDateTime}
                    onViewHistory={(rm) => setActiveHistoryRemark(rm)}
                />
            )}

            {/* Remark Revision History Modal */}
            {activeHistoryRemark && (
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.55)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 9999,
                    padding: '1rem'
                }}>
                    <div style={{
                        backgroundColor: '#ffffff',
                        borderRadius: '12px',
                        width: '100%',
                        maxWidth: '560px',
                        maxHeight: '85vh',
                        display: 'flex',
                        flexDirection: 'column',
                        boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)',
                        overflow: 'hidden'
                    }}>
                        {/* Modal Header */}
                        <div style={{
                            padding: '1rem 1.25rem',
                            borderBottom: '1px solid #e2e8f0',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            backgroundColor: '#f8fafc'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <div style={{ backgroundColor: '#eff6ff', color: '#2563eb', padding: '0.4rem', borderRadius: '8px', display: 'flex' }}>
                                    <History size={18} />
                                </div>
                                <div>
                                    <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#0f172a' }}>
                                        Remark Revision History
                                    </h3>
                                    <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b' }}>
                                        Week: <strong>{activeHistoryRemark.shipment_week}</strong> • Stage: <strong>{activeHistoryRemark.stage}</strong>
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setActiveHistoryRemark(null)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: '0.25rem', display: 'flex' }}
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Current Active Remark */}
                        <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #e2e8f0', backgroundColor: '#f0fdf4' }}>
                            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#166534', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                                Current Active Remark
                            </div>
                            <div style={{ fontSize: '0.82rem', color: '#1e293b', whiteSpace: 'pre-wrap', wordBreak: 'break-all', overflowWrap: 'anywhere', fontWeight: 500, lineHeight: 1.4 }}>
                                {activeHistoryRemark.remark}
                            </div>
                            <div style={{ fontSize: '0.7rem', color: '#15803d', marginTop: '0.4rem' }}>
                                Last updated by <strong>{activeHistoryRemark.updated_by || activeHistoryRemark.created_by}</strong> on {formatDateTime(activeHistoryRemark.updated_at || activeHistoryRemark.created_at)}
                            </div>
                        </div>

                        {/* Past Revisions List */}
                        <div style={{ padding: '1rem 1.25rem', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                                Past Revisions ({activeHistoryRemark.edit_history?.length || 0})
                            </div>
                            {(activeHistoryRemark.edit_history || []).slice().reverse().map((entry, index) => (
                                <div
                                    key={index}
                                    style={{
                                        border: '1px solid #e2e8f0',
                                        borderRadius: '8px',
                                        padding: '0.75rem',
                                        backgroundColor: '#ffffff'
                                    }}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                                        <span style={{
                                            fontSize: '0.68rem',
                                            fontWeight: 700,
                                            backgroundColor: '#fef3c7',
                                            color: '#92400e',
                                            padding: '0.1rem 0.45rem',
                                            borderRadius: '9999px'
                                        }}>
                                            Edit #{entry.edit_number || ((activeHistoryRemark.edit_history?.length || 0) - index)}
                                        </span>
                                        <span style={{ fontSize: '0.7rem', color: '#64748b' }}>
                                            {formatDateTime(entry.edited_at)}
                                        </span>
                                    </div>
                                    <div style={{ fontSize: '0.8rem', color: '#334155', whiteSpace: 'pre-wrap', wordBreak: 'break-all', overflowWrap: 'anywhere', marginBottom: '0.35rem', lineHeight: 1.4 }}>
                                        {entry.old_text}
                                    </div>
                                    <div style={{ fontSize: '0.68rem', color: '#64748b' }}>
                                        Edited by: <strong style={{ color: '#0f172a' }}>{entry.edited_by}</strong>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Modal Footer */}
                        <div style={{ padding: '0.75rem 1.25rem', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', backgroundColor: '#f8fafc' }}>
                            <button
                                type="button"
                                onClick={() => setActiveHistoryRemark(null)}
                                style={{
                                    padding: '0.4rem 1rem',
                                    backgroundColor: '#e2e8f0',
                                    color: '#334155',
                                    borderRadius: '6px',
                                    border: 'none',
                                    fontSize: '0.8rem',
                                    fontWeight: 600,
                                    cursor: 'pointer'
                                }}
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SymbPipelineView;
