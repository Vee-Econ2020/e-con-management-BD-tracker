import React, { useState, useEffect, useMemo } from 'react';
import { 
    Calendar, Filter, AlertCircle, CalendarDays, ArrowRight, RefreshCw, Clock, 
    CheckCircle2, ChevronDown, Eye, Check, Layers, X, ShieldAlert,
    MessageSquare, History, Send, Edit2, Trash2,
    ShieldCheck, User
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
    "Estimated Completion Date History"?: Array<{
        old_value?: any;
        new_value?: any;
        value?: any;
        edited_by?: string;
        timestamp?: string;
        edit?: number;
    }>;
    "Estimated Completion Date Given By"?: string;
    "Estimated Completion Date Created At"?: string;
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
    variant?: string;
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
    '100% CTB': { color: '#d97706', bg: '#fffbeb', border: '#fde68a', text: '#92400e' },
    'Materials Issued': { color: '#8b5cf6', bg: '#f5f3ff', border: '#ddd6fe', text: '#5b21b6' },
    'Active alignment': { color: '#d97706', bg: '#fffbeb', border: '#fde68a', text: '#92400e' },
    'Production/Assembly': { color: '#0d9488', bg: '#f0fdfa', border: '#99f6e4', text: '#115e59' },
    'FQC': { color: '#4f46e5', bg: '#eef2ff', border: '#c7d2fe', text: '#3730a3' },
    'Finished goods': { color: '#059669', bg: '#ecfdf5', border: '#a7f3d0', text: '#065f46' },
    'Invoice Date': { color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe', text: '#5b21b6' },
    'Shipment Date': { color: '#db2777', bg: '#fdf2f8', border: '#fbcfe8', text: '#9d174d' },
    'customer place': { color: '#0284c7', bg: '#f0f9ff', border: '#bae6fd', text: '#0369a1' }
};

const getStageDisplayName = (stageName: string) => {
    if (stageName === 'All Material Available' || stageName === 'All Materials available') {
        return '100% CTB';
    }
    return stageName;
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

interface VariantDetailsModalProps {
    weekStr: string;
    stage: string;
    variant: string;
    row: SymbPlanRow;
    remarks: StageRemark[];
    onClose: () => void;
    onAddRemark: (text: string) => Promise<void>;
    onUpdateRemark: (remarkId: string, text: string) => Promise<void>;
    onDeleteRemark: (remarkId: string) => Promise<void>;
    formatDateTime: (dateStr?: string) => string;
    onViewHistory: (remark: StageRemark) => void;
}

const VariantDetailsModal: React.FC<VariantDetailsModalProps> = ({
    weekStr,
    stage,
    variant,
    row,
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

    // Filter remarks strictly for this shipment week, stage, and variant
    const variantRemarks = useMemo(() => {
        return remarks
            .filter(r => 
                r.shipment_week === weekStr && 
                r.stage === stage && 
                (r.variant || 'Variant 1').toLowerCase() === variant.toLowerCase()
            )
            .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    }, [remarks, weekStr, stage, variant]);

    // Planned date history
    const dateHistory: Array<{
        old_value?: any;
        new_value?: any;
        value?: any;
        edited_by?: string;
        timestamp?: string;
        edit?: number;
    }> = useMemo(() => {
        const h = row["Estimated Completion Date History"];
        return Array.isArray(h) ? h : [];
    }, [row]);

    const changeCount = dateHistory.length;
    const estDate = row["Estimated Completion Date"];
    const actDate = row["Actual Completed Date"] || row["actual_completed_date"];
    const planGivenBy = row["Estimated Completion Date Given By"];
    const planCreatedAt = row["Estimated Completion Date Created At"];

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
                borderRadius: '14px',
                width: '100%',
                maxWidth: '680px',
                maxHeight: '90vh',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                overflow: 'hidden'
            }}>
                {/* Header */}
                <div style={{
                    padding: '1.1rem 1.4rem',
                    borderBottom: '1px solid #e2e8f0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    backgroundColor: '#f8fafc'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{
                            backgroundColor: '#e0e7ff',
                            color: '#4338ca',
                            padding: '0.55rem',
                            borderRadius: '10px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <CalendarDays size={20} />
                        </div>
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>
                                    {getStageDisplayName(stage)}
                                </h3>
                                <span style={{
                                    backgroundColor: '#4f46e5',
                                    color: '#ffffff',
                                    padding: '0.15rem 0.55rem',
                                    borderRadius: '9999px',
                                    fontSize: '0.75rem',
                                    fontWeight: 700
                                }}>
                                    {variant}
                                </span>
                            </div>
                            <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.78rem', color: '#64748b' }}>
                                Shipment Week: <strong>{weekStr}</strong>
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: '#64748b',
                            padding: '0.35rem',
                            display: 'flex',
                            borderRadius: '6px',
                            transition: 'background 0.15s ease'
                        }}
                        onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f1f5f9'}
                        onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div style={{
                    padding: '1.25rem 1.4rem',
                    overflowY: 'auto',
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1.35rem'
                }}>
                    {/* SECTION 1: Planned Date / "Will be completed by" & History */}
                    <div style={{
                        backgroundColor: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: '10px',
                        padding: '1rem 1.15rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.75rem'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                                <Clock size={16} style={{ color: '#0284c7' }} />
                                <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#0f172a' }}>
                                    "Will be completed by" / Planned Date
                                </span>
                            </div>
                            <span style={{
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                padding: '0.2rem 0.6rem',
                                borderRadius: '9999px',
                                backgroundColor: changeCount > 0 ? '#fef3c7' : '#dcfce7',
                                color: changeCount > 0 ? '#92400e' : '#166534',
                                border: `1px solid ${changeCount > 0 ? '#fde68a' : '#bbf7d0'}`
                            }}>
                                {changeCount > 0 ? `Changed ${changeCount} time${changeCount > 1 ? 's' : ''}` : 'No date changes (0 times changed)'}
                            </span>
                        </div>

                        {/* Current Target Date Box */}
                        <div style={{
                            backgroundColor: '#ffffff',
                            border: '1px solid #cbd5e1',
                            borderRadius: '8px',
                            padding: '0.75rem 0.9rem',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.4rem'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.4rem' }}>
                                <div style={{ fontSize: '0.82rem', color: '#475569' }}>
                                    Current Planned Date: <strong style={{ color: estDate ? '#0284c7' : '#64748b', fontSize: '0.9rem' }}>{estDate || 'Not scheduled'}</strong>
                                </div>
                                {actDate && (
                                    <div style={{ fontSize: '0.82rem', color: '#166534', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                        <CheckCircle2 size={13} style={{ color: '#16a34a' }} />
                                        Actual completed: <strong>{actDate}</strong>
                                    </div>
                                )}
                            </div>

                            {/* Plan Author & Creation Metadata */}
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                flexWrap: 'wrap',
                                gap: '0.4rem',
                                backgroundColor: '#f8fafc',
                                border: '1px solid #e2e8f0',
                                borderRadius: '6px',
                                padding: '0.45rem 0.65rem',
                                fontSize: '0.76rem',
                                color: '#334155'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                    <User size={13} style={{ color: '#6366f1' }} />
                                    <span>
                                        Plan given by: <strong style={{ color: '#1e293b' }}>{planGivenBy || (estDate ? 'System Baseline' : 'Not assigned')}</strong>
                                    </span>
                                </div>
                                {planCreatedAt && (
                                    <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                                        Given on: <strong>{formatDateTime(planCreatedAt)}</strong>
                                    </div>
                                )}
                            </div>

                            {changeCount > 0 && dateHistory[dateHistory.length - 1]?.edited_by && (
                                <div style={{
                                    fontSize: '0.72rem',
                                    color: '#92400e',
                                    backgroundColor: '#fffbeb',
                                    border: '1px solid #fef3c7',
                                    borderRadius: '4px',
                                    padding: '0.3rem 0.5rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.3rem'
                                }}>
                                    <Clock size={11} style={{ color: '#d97706', flexShrink: 0 }} />
                                    <span>
                                        Latest date revised by <strong>{dateHistory[dateHistory.length - 1].edited_by}</strong>
                                        {dateHistory[dateHistory.length - 1].timestamp && ` on ${formatDateTime(dateHistory[dateHistory.length - 1].timestamp)}`}
                                    </span>
                                </div>
                            )}

                            <div style={{ display: 'flex', gap: '1.25rem', fontSize: '0.75rem', color: '#64748b', borderTop: '1px solid #f1f5f9', paddingTop: '0.35rem' }}>
                                <span>Planned Qty: <strong style={{ color: '#1e293b' }}>{Number(row["planned Value"] || 0).toLocaleString()}</strong></span>
                                <span>Completed Qty: <strong style={{ color: '#1e293b' }}>{Number(row.completed || 0).toLocaleString()}</strong></span>
                            </div>
                        </div>

                        {/* Revisions list */}
                        {changeCount > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.2rem' }}>
                                <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                    Planned Date Change Revisions ({changeCount}):
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                                    {dateHistory.slice().reverse().map((entry, idx) => {
                                        const revNum = entry.edit || (changeCount - idx);
                                        return (
                                            <div
                                                key={idx}
                                                style={{
                                                    backgroundColor: '#ffffff',
                                                    border: '1px solid #e2e8f0',
                                                    borderRadius: '6px',
                                                    padding: '0.55rem 0.75rem',
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    gap: '0.25rem',
                                                    fontSize: '0.78rem'
                                                }}
                                            >
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <span style={{
                                                        backgroundColor: '#f1f5f9',
                                                        color: '#334155',
                                                        padding: '0.1rem 0.4rem',
                                                        borderRadius: '4px',
                                                        fontSize: '0.7rem',
                                                        fontWeight: 700
                                                    }}>
                                                        Revision #{revNum}
                                                    </span>
                                                    <span style={{ fontSize: '0.7rem', color: '#64748b' }}>
                                                        {formatDateTime(entry.timestamp)}
                                                    </span>
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.15rem' }}>
                                                    <span style={{ textDecoration: 'line-through', color: '#94a3b8' }}>
                                                        {entry.old_value || 'None'}
                                                    </span>
                                                    <ArrowRight size={12} style={{ color: '#64748b' }} />
                                                    <strong style={{ color: '#0369a1' }}>
                                                        {entry.new_value}
                                                    </strong>
                                                </div>
                                                {entry.edited_by && (
                                                    <div style={{ fontSize: '0.68rem', color: '#64748b', marginTop: '0.1rem' }}>
                                                        Changed by: <strong style={{ color: '#1e293b' }}>{entry.edited_by}</strong>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ) : (
                            <div style={{
                                backgroundColor: '#f0fdf4',
                                border: '1px solid #bbf7d0',
                                borderRadius: '6px',
                                padding: '0.55rem 0.75rem',
                                color: '#166534',
                                fontSize: '0.76rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.4rem'
                            }}>
                                <CheckCircle2 size={14} style={{ color: '#16a34a', flexShrink: 0 }} />
                                <span>No date changes recorded. Planned date has remained <strong>{estDate || 'as planned'}</strong> since initial entry.</span>
                            </div>
                        )}
                    </div>

                    {/* SECTION 2: Variant Remarks */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                                <MessageSquare size={16} style={{ color: '#6366f1' }} />
                                <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#0f172a' }}>
                                    Remarks for {variant}
                                </span>
                            </div>
                            <span style={{
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                padding: '0.15rem 0.5rem',
                                borderRadius: '9999px',
                                backgroundColor: '#e0e7ff',
                                color: '#4338ca'
                            }}>
                                {variantRemarks.length} Remark{variantRemarks.length !== 1 ? 's' : ''}
                            </span>
                        </div>

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
                            <textarea
                                placeholder={`Type a remark for ${variant} (${stage})...`}
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

                        {/* Variant Remarks List */}
                        {variantRemarks.length === 0 ? (
                            <div style={{
                                textAlign: 'center',
                                padding: '1.25rem',
                                color: '#94a3b8',
                                fontSize: '0.8rem',
                                fontStyle: 'italic',
                                backgroundColor: '#f8fafc',
                                borderRadius: '8px'
                            }}>
                                No remarks posted yet for {variant}.
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                                {variantRemarks.map(rm => (
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
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div style={{
                    padding: '0.85rem 1.4rem',
                    borderTop: '1px solid #e2e8f0',
                    display: 'flex',
                    justifyContent: 'flex-end',
                    backgroundColor: '#f8fafc'
                }}>
                    <button
                        type="button"
                        onClick={onClose}
                        style={{
                            padding: '0.45rem 1.2rem',
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

interface SymbPipelineViewProps {
    showBufferData?: boolean;
}

const SymbPipelineView: React.FC<SymbPipelineViewProps> = ({ showBufferData = true }) => {
    const { user } = useAuth();
    const [data, setData] = useState<SymbPlanRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isCompletedSectionOpen, setIsCompletedSectionOpen] = useState(false);
    const [highlightedWeek, setHighlightedWeek] = useState<string | null>(null);
    
    // Remarks State
    const [remarks, setRemarks] = useState<StageRemark[]>([]);
    const [, setLoadingRemarks] = useState(false);
    const [activeVariantModal, setActiveVariantModal] = useState<{
        weekStr: string;
        stage: string;
        variant: string;
        row: SymbPlanRow;
    } | null>(null);
    const [activeHistoryRemark, setActiveHistoryRemark] = useState<StageRemark | null>(null);

    // Coverage Stage Filter State
    const [selectedCoverageStage, setSelectedCoverageStage] = useState<string | null>(null);

    // Filters
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
    const [selectedVariant, setSelectedVariant] = useState<string>('All');
    const isAdmin = user?.role === 'Admin';

    const MILESTONE_STAGES = useMemo(() => [
        { key: 'EBOM covered', title: 'EBOM covered', eventMatch: ['EBOM covered'], color: '#6366f1', bg: '#eef2ff', border: '#c7d2fe' },
        { key: 'PCBA covered', title: 'PCBA covered', eventMatch: ['PCBA covered', 'PCBA Ready'], color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
        { key: 'All Material Available', title: '100% CTB', eventMatch: ['All Material Available'], color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
        { key: 'Materials Issued', title: 'Materials Issued', eventMatch: ['Materials Issued'], color: '#8b5cf6', bg: '#f5f3ff', border: '#ddd6fe' },
        { key: 'Active alignment', title: 'Active alignment', eventMatch: ['Active alignment'], color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
        { key: 'Production/Assembly', title: 'Production/Assembly', eventMatch: ['Production/Assembly'], color: '#0d9488', bg: '#f0fdfa', border: '#99f6e4' },
        { key: 'FQC', title: 'FQC', eventMatch: ['FQC'], color: '#4f46e5', bg: '#eef2ff', border: '#c7d2fe' },
        { key: 'Finished goods', title: 'Finished goods', eventMatch: ['Finished goods'], color: '#059669', bg: '#ecfdf5', border: '#a7f3d0' },
        { key: 'Invoice Date', title: 'Invoice Date', eventMatch: ['Invoice Date'], color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe' },
        { key: 'Shipment Date', title: 'Shipment Date', eventMatch: ['Shipment Date'], color: '#db2777', bg: '#fdf2f8', border: '#fbcfe8' },
        { key: 'customer place', title: 'customer place', eventMatch: ['customer place'], color: '#0284c7', bg: '#f0f9ff', border: '#bae6fd' }
    ], []);

    const fetchRemarks = async () => {
        try {
            setLoadingRemarks(true);
            const res = await fetch('/api/admin/symb-plan/remarks');
            if (res.ok) {
                const json = await res.json();
                setRemarks(json);
            }
        } catch (err) {
            console.error("Failed to fetch symb plan remarks:", err);
        } finally {
            setLoadingRemarks(false);
        }
    };

    useEffect(() => {
        fetchRemarks();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const res = await fetch('/api/admin/symb-plan/transformed');
            if (res.ok) {
                const json = await res.json();
                setData(json);
            }
        } catch (err) {
            console.error("Failed to fetch symb plan data:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleRefresh = async () => {
        try {
            setIsRefreshing(true);
            const res = await fetch('/api/admin/symb-plan/run-pipeline', { method: 'POST' });
            if (res.ok) {
                await fetchData();
                await fetchRemarks();
            }
        } catch (error) {
            console.error("Error refreshing pipeline data:", error);
        } finally {
            setIsRefreshing(false);
        }
    };

    const handleAddRemark = async (shipmentWeek: string, stage: string, variant: string, text: string) => {
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
                    variant: variant,
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
                title: '100% CTB',
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

    const renderVariantSection = (
        row: SymbPlanRow,
        isBackfilled: boolean,
        weekStr: string,
        backfillSourceStage?: string,
        backfillActualCompDate?: string,
        priorStageRows?: Array<SymbPlanRow | null>,
        maxCompletedIdx?: number,
        weekBackfillActualDate?: string
    ) => {
        const isNativeCompleted = row["Material Covered"] === "Yes" || (row["planned Value"] > 0 && row.completed >= row["planned Value"]);
        const isCompleted = isNativeCompleted || isBackfilled;
        const isDelayed = !isCompleted && row["Delayed by days"] > 0;
        const isAutofilled = Boolean(row.is_autofilled || row["is_autofilled"]);
        const unplannedQty = Number(row.unplanned_qty || row["unplanned_qty"] || 0);
        const warningMsg = row.warning_msg || row["warning_msg"] || (unplannedQty > 0 ? `There is no plan for remaining qty (${unplannedQty.toLocaleString()} units). Please update!` : '');
        const actualCompDate = row["Actual Completed Date"] || row["actual_completed_date"] || backfillActualCompDate;

        // Date-sequence check: this stage's estimated completion can't fall before ANY stage
        // earlier than it (e.g. Materials Issued can't finish before PCBA covered does, even if
        // an in-between stage like 100% CTB currently has an even-earlier — itself wrong — date).
        // Also flags the case where the immediately-preceding stage has no completion date at
        // all yet (not completed, no ETA/estimate) — this stage can't reliably have one either.
        // A prior stage that's only "Auto-Completed" via backfill (no native completion of its
        // own, e.g. no plan was ever entered for it) uses the same backfill source's actual date
        // rather than its own — otherwise it would look like it "has no date" and falsely block.
        const isEffectivelyCompleted = (r: SymbPlanRow, j: number): boolean => {
            const rIsNativeCompleted = r["Material Covered"] === "Yes" || (r["planned Value"] > 0 && r.completed >= r["planned Value"]);
            const rIsBackfilled = !rIsNativeCompleted && typeof maxCompletedIdx === 'number' && j < maxCompletedIdx;
            return rIsNativeCompleted || rIsBackfilled;
        };

        const effectiveDateOf = (r: SymbPlanRow, j: number): string | null => {
            const rIsNativeCompleted = r["Material Covered"] === "Yes" || (r["planned Value"] > 0 && r.completed >= r["planned Value"]);
            const rIsBackfilled = !rIsNativeCompleted && typeof maxCompletedIdx === 'number' && j < maxCompletedIdx;
            let raw: any;
            if (rIsNativeCompleted) {
                raw = r["Actual Completed Date"] || r["actual_completed_date"];
            } else if (rIsBackfilled) {
                raw = weekBackfillActualDate;
            } else {
                raw = r["Estimated Completion Date"];
            }
            const str = raw ? String(raw).trim() : '';
            return str && str !== 'None' && str !== 'N/A' ? str : null;
        };

        let dateSequenceIssue: { prevLabel: string; prevDateStr: string | null; currDateStr: string } | null = null;
        if (!isCompleted && row["Estimated Completion Date"] && priorStageRows && priorStageRows.length > 0) {
            const currDate = parseDateSafe(row["Estimated Completion Date"]);
            const immediatePrevIdx = priorStageRows.length - 1;
            const immediatePrev = priorStageRows[immediatePrevIdx];

            if (currDate && immediatePrev) {
                const immediatePrevDateStr = effectiveDateOf(immediatePrev, immediatePrevIdx);
                // Only flag "no date" when the previous stage is genuinely still pending with no
                // ETA. If it's actually completed but just missing its recorded date (a data-entry
                // gap), don't block on that — fall through to the running-max check instead, which
                // will simply skip it since it has no date to contribute.
                if (!immediatePrevDateStr && !isEffectivelyCompleted(immediatePrev, immediatePrevIdx)) {
                    dateSequenceIssue = {
                        prevLabel: getStageDisplayName(immediatePrev["Event Type"] || ''),
                        prevDateStr: null,
                        currDateStr: row["Estimated Completion Date"]
                    };
                } else {
                    let maxDate: Date | null = null;
                    let maxDateStr = '';
                    let maxLabel = '';
                    priorStageRows.forEach((p, j) => {
                        if (!p) return;
                        const pDateStr = effectiveDateOf(p, j);
                        const pDate = pDateStr ? parseDateSafe(pDateStr) : null;
                        if (pDate && (!maxDate || pDate.getTime() > maxDate.getTime())) {
                            maxDate = pDate;
                            maxDateStr = pDateStr!;
                            maxLabel = getStageDisplayName(p["Event Type"] || '');
                        }
                    });
                    if (maxDate && currDate.getTime() < (maxDate as Date).getTime()) {
                        dateSequenceIssue = { prevLabel: maxLabel, prevDateStr: maxDateStr, currDateStr: row["Estimated Completion Date"] };
                    }
                }
            }
        }

        const variantType = row["Variant Type"] || "Variant 1";
        const stageName = row["Event Type"] || "";
        const variantRemarksCount = remarks.filter(
            r => r.shipment_week === weekStr && 
                 r.stage === stageName && 
                 (r.variant || 'Variant 1').toLowerCase() === variantType.toLowerCase()
        ).length;
        const dateHist = Array.isArray(row["Estimated Completion Date History"]) ? row["Estimated Completion Date History"] : [];
        const dateHistCount = dateHist.length;

        return (
            <div 
                key={row.id} 
                onClick={() => setActiveVariantModal({ weekStr, stage: stageName, variant: variantType, row })}
                style={{ 
                    padding: '0.75rem', 
                    backgroundColor: isBackfilled ? '#f1f5f9' : '#f8fafc', 
                    borderRadius: '8px',
                    borderLeft: `4px solid ${unplannedQty > 0 ? '#ef4444' : isNativeCompleted ? '#10b981' : isBackfilled ? '#94a3b8' : isDelayed ? '#ef4444' : '#f59e0b'}`,
                    marginBottom: '0.5rem',
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
                }}
                title={`Click to view ${variantType} date change history and remarks`}
                onMouseEnter={e => {
                    e.currentTarget.style.backgroundColor = isBackfilled ? '#e2e8f0' : '#f1f5f9';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow = '0 4px 8px -2px rgba(0,0,0,0.1)';
                }}
                onMouseLeave={e => {
                    e.currentTarget.style.backgroundColor = isBackfilled ? '#f1f5f9' : '#f8fafc';
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.03)';
                }}
            >
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

                {dateSequenceIssue && (
                    <div style={{ color: '#991b1b', fontSize: '0.73rem', display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.35rem', backgroundColor: '#fef2f2', border: '1px solid #fecaca', padding: '0.3rem 0.5rem', borderRadius: '4px', fontWeight: 700 }}>
                        <ShieldAlert size={14} style={{ color: '#dc2626', flexShrink: 0 }} />
                        {dateSequenceIssue.prevDateStr ? (
                            <span>Planned date needs to be updated: this stage is set to complete on <strong>{dateSequenceIssue.currDateStr}</strong>, which is before {dateSequenceIssue.prevLabel}'s <strong>{dateSequenceIssue.prevDateStr}</strong>.</span>
                        ) : (
                            <span>Planned date needs to be updated: this stage is set to complete on <strong>{dateSequenceIssue.currDateStr}</strong>, but {dateSequenceIssue.prevLabel} doesn't have a completion date yet.</span>
                        )}
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

                {/* Variant Card Footer: Date changes & remarks info & click affordance */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginTop: '0.45rem',
                    paddingTop: '0.35rem',
                    borderTop: '1px dashed #cbd5e1',
                    fontSize: '0.72rem',
                    color: '#64748b'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                        {dateHistCount > 0 && (
                            <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.2rem',
                                backgroundColor: '#fef3c7',
                                color: '#92400e',
                                padding: '0.1rem 0.35rem',
                                borderRadius: '4px',
                                fontWeight: 700,
                                fontSize: '0.67rem'
                            }} title={`Planned date changed ${dateHistCount} time(s)`}>
                                <Clock size={10} />
                                {dateHistCount} date edit{dateHistCount > 1 ? 's' : ''}
                            </span>
                        )}
                        {variantRemarksCount > 0 ? (
                            <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.2rem',
                                backgroundColor: '#e0e7ff',
                                color: '#4338ca',
                                padding: '0.1rem 0.35rem',
                                borderRadius: '4px',
                                fontWeight: 700,
                                fontSize: '0.67rem'
                            }}>
                                <MessageSquare size={10} />
                                {variantRemarksCount} remark{variantRemarksCount > 1 ? 's' : ''}
                            </span>
                        ) : (
                            <span style={{ fontSize: '0.68rem', color: '#94a3b8', fontStyle: 'italic' }}>
                                + Add remark
                            </span>
                        )}
                    </div>
                    <span style={{ color: '#4f46e5', fontWeight: 700, fontSize: '0.69rem', display: 'flex', alignItems: 'center', gap: '0.15rem' }}>
                        Details &rarr;
                    </span>
                </div>
            </div>
        );
    };

    const renderWeekCardBlock = (weekStr: string, rows: SymbPlanRow[], pct: number) => {
        const isComplete = pct === 100;
        const weekBufInfo = (isAdmin && showBufferData) ? weeklyBufferMap.get(weekStr) : undefined;
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

                        {isAdmin && showBufferData && weekBufInfo && (
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
                                        <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#1e293b' }}>{getStageDisplayName(eventType)}</div>
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

                                                // Unlike backfillActualCompDate above (only set when THIS row is backfilled), this is
                                                // always resolved so a backfilled PRIOR stage (used by the date-sequence check) can find
                                                // its effective date too, even when the current row itself isn't backfilled.
                                                const weekBackfillSourceStage = maxNativeCompletedStageNameMap[variantKey];
                                                const weekBackfillSourceRow = weekBackfillSourceStage
                                                    ? rows.find(r => r["Event Type"] === weekBackfillSourceStage && (r["Variant Type"] || "").toLowerCase() === variantKey)
                                                    : null;
                                                const weekBackfillActualDate = weekBackfillSourceRow
                                                    ? (weekBackfillSourceRow["Actual Completed Date"] || weekBackfillSourceRow["actual_completed_date"])
                                                    : undefined;

                                                const priorStageRows = EVENT_ORDER.slice(0, idx).map(evt =>
                                                    rows.find(r => r["Event Type"] === evt && (r["Variant Type"] || "").toLowerCase() === variantKey) || null
                                                );

                                                return renderVariantSection(row, isBackfilled, weekStr, backfillSourceStage, backfillActualCompDate, priorStageRows, maxCompletedIdx, weekBackfillActualDate);
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

            {/* Variant Details & Remarks Pop-up Modal */}
            {activeVariantModal && (
                <VariantDetailsModal
                    weekStr={activeVariantModal.weekStr}
                    stage={activeVariantModal.stage}
                    variant={activeVariantModal.variant}
                    row={activeVariantModal.row}
                    remarks={remarks}
                    onClose={() => setActiveVariantModal(null)}
                    onAddRemark={(text) => handleAddRemark(activeVariantModal.weekStr, activeVariantModal.stage, activeVariantModal.variant, text)}
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
                                        Week: <strong>{activeHistoryRemark.shipment_week}</strong> • Stage: <strong>{activeHistoryRemark.stage}</strong> • Variant: <strong>{activeHistoryRemark.variant || 'Variant 1'}</strong>
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
