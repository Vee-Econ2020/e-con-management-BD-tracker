import { useState, useEffect, Fragment } from 'react';
import { Trash2, RefreshCw, Upload as UploadIcon } from 'lucide-react';
import { getStoredAuth } from '../utils/adminAuth';

interface UploadLog {
    id: string;
    week: number;
    file_date: string;
    file_name: string;
    type: 'weekly' | 'invoice' | 'revenue' | 'gross_margin' | 'services_trend';
    created_at?: string;
}

interface RegionMapping {
    id: string;
    opportunities_owner: string;
    region: string;
    created_at?: string;
}

interface CrmSyncNewRecord {
    record_id: string;
    deal_name: string | null;
    account_name: string | null;
    stage: string | null;
    amount: number | null;
    region: string | null;
    closing_date: string | null;
}

interface CrmSyncFieldChange {
    field: string;
    old: unknown;
    new: unknown;
}

interface CrmSyncUpdatedRecord {
    record_id: string;
    deal_name: string | null;
    account_name: string | null;
    changes: CrmSyncFieldChange[];
}

interface CrmSyncLog {
    _id: string;
    run_type: 'delta_sync' | 'deleted_cleanup';
    trigger_type: 'auto' | 'manual';
    triggered_by: string | null;
    started_at: string;
    ended_at: string | null;
    status: 'running' | 'completed' | 'failed';
    records_scanned: number;
    new_records: number;
    updated_records: number;
    error_message: string | null;
    new_records_detail?: CrmSyncNewRecord[];
    updated_records_detail?: CrmSyncUpdatedRecord[];
}

interface CrmTransformLog {
    _id: string;
    transformed_at: string;
    status: 'running' | 'completed' | 'failed';
    triggered_by: string;
    week: number;
    error_message: string | null;
}

function StatusPill({ status }: { status: 'running' | 'completed' | 'failed' }) {
    const colors: Record<string, { bg: string; fg: string }> = {
        completed: { bg: 'rgba(16, 185, 129, 0.15)', fg: '#10b981' },
        failed: { bg: 'rgba(239, 68, 68, 0.15)', fg: '#ef4444' },
        running: { bg: 'rgba(245, 158, 11, 0.15)', fg: '#f59e0b' },
    };
    const c = colors[status] || colors.running;
    return (
        <span style={{
            display: 'inline-block',
            padding: '0.2rem 0.7rem',
            borderRadius: '999px',
            fontSize: '0.75rem',
            fontWeight: 700,
            textTransform: 'capitalize',
            backgroundColor: c.bg,
            color: c.fg,
        }}>
            {status}
        </span>
    );
}

function TriggerBadge({ triggerType, triggeredBy }: { triggerType: 'auto' | 'manual'; triggeredBy: string | null }) {
    const label = triggerType === 'auto' ? 'Auto' : 'Manual';
    const title = triggerType === 'manual' && triggeredBy ? triggeredBy : (triggerType === 'auto' ? 'System' : '');
    return (
        <span title={title} style={{
            display: 'inline-block',
            padding: '0.2rem 0.6rem',
            borderRadius: '6px',
            fontSize: '0.75rem',
            fontWeight: 600,
            backgroundColor: triggerType === 'auto' ? 'rgba(37,99,235,0.12)' : 'rgba(107,114,128,0.15)',
            color: triggerType === 'auto' ? '#2563eb' : '#4b5563',
        }}>
            {label}
        </span>
    );
}

function formatRelativeTime(iso: string | null): string {
    if (!iso) return '-';
    const date = new Date(iso.endsWith('Z') || iso.includes('+') ? iso : `${iso}Z`);
    if (isNaN(date.getTime())) return iso;
    const diffMin = Math.floor((Date.now() - date.getTime()) / 60000);
    if (diffMin < 1) return 'just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffMin < 1440) return `${Math.floor(diffMin / 60)}h ago`;
    return `${Math.floor(diffMin / 1440)}d ago`;
}

function formatExactTime(iso: string | null): string {
    if (!iso) return '';
    const date = new Date(iso.endsWith('Z') || iso.includes('+') ? iso : `${iso}Z`);
    return isNaN(date.getTime()) ? '' : date.toLocaleString();
}

function formatFieldValue(value: unknown): string {
    if (value === null || value === undefined || value === '') return '—';
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
        const d = new Date(value);
        return isNaN(d.getTime()) ? value : d.toLocaleDateString();
    }
    if (typeof value === 'number') return value.toLocaleString();
    return String(value);
}

export function CrmDataUpload() {
    const [activeTab, setActiveTab] = useState<'weekly' | 'invoice' | 'revenue' | 'region' | 'gross_margin' | 'services_trend' | 'symb_tracker' | 'symb_reference'>('weekly');
    const [file, setFile] = useState<File | null>(null);
    const [logs, setLogs] = useState<UploadLog[]>([]);
    const [refLogs, setRefLogs] = useState<Record<string, UploadLog>>({});
    const [regionMappings, setRegionMappings] = useState<RegionMapping[]>([]);
    const [statusMsg, setStatusMsg] = useState('');

    // CRM sync (Zoho API) state
    const [weeklySubTab, setWeeklySubTab] = useState<'uploads' | 'sync' | 'transform'>('sync');
    const [showCsvUpload, setShowCsvUpload] = useState(false);
    const [syncLogs, setSyncLogs] = useState<CrmSyncLog[]>([]);
    const [transformLogs, setTransformLogs] = useState<CrmTransformLog[]>([]);
    const [syncLogsHasMore, setSyncLogsHasMore] = useState(false);
    const [transformLogsHasMore, setTransformLogsHasMore] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [isTransforming, setIsTransforming] = useState(false);
    const [expandedErrorId, setExpandedErrorId] = useState<string | null>(null);
    const [expandedDetailId, setExpandedDetailId] = useState<string | null>(null);
    const [syncLogDetails, setSyncLogDetails] = useState<Record<string, CrmSyncLog>>({});
    const [loadingDetailId, setLoadingDetailId] = useState<string | null>(null);
    const [detailSubView, setDetailSubView] = useState<'new' | 'updated'>('new');
    const [detailSearchQuery, setDetailSearchQuery] = useState('');

    // Progress tracking state
    const [uploadProgress, setUploadProgress] = useState<{
        isUploading: boolean;
        step: number;
        totalSteps: number;
        stepName: string;
        message: string;
        progressPercent: number;
        startTimeStr?: string;
        estCompletionTimeStr?: string;
        timeRemainingStr?: string;
        itemsProcessed?: number;
        itemsTotal?: number;
    } | null>(null);

    const [terminalLogs, setTerminalLogs] = useState<{time: string, msg: string}[]>([]);
    const [frontendTimerStartedAt, setFrontendTimerStartedAt] = useState<number | null>(null);
    const [frontendTimerTotalSecs, setFrontendTimerTotalSecs] = useState<number | null>(null);
    const [frontendTimerRemaining, setFrontendTimerRemaining] = useState<number | null>(null);

    // Run a fast frontend timer
    useEffect(() => {
        if (frontendTimerTotalSecs !== null && frontendTimerStartedAt !== null && uploadProgress) {
            const timer = setInterval(() => {
                const elapsedSecs = Math.floor((Date.now() - frontendTimerStartedAt) / 1000);
                const remaining = frontendTimerTotalSecs - elapsedSecs;
                setFrontendTimerRemaining(remaining > 0 ? remaining : 0);
            }, 1000);
            return () => clearInterval(timer);
        }
    }, [frontendTimerTotalSecs, frontendTimerStartedAt, uploadProgress]);

    // ISO week calculation: Weeks run Monday-Sunday.
    // Week 1 is the first week containing a Thursday (or containing Jan 4).
    const getSimpleWeekNumber = (date: Date) => {
        // Create a copy to avoid modifying the original date
        const tempDate = new Date(date.getTime());

        // Set to nearest Thursday: current date + 4 - current day number
        // Make Sunday = 7, not 0
        const dayOfWeek = tempDate.getDay() || 7;
        tempDate.setDate(tempDate.getDate() + 4 - dayOfWeek);

        // Get first day of year
        const yearStart = new Date(tempDate.getFullYear(), 0, 1);

        // Calculate full weeks to nearest Thursday
        const weekNo = Math.ceil((((tempDate.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);

        return weekNo;
    };


    const checkActiveUpload = async () => {
        try {
            const res = await fetch('/api/admin/active-upload');
            if (res.ok) {
                const data = await res.json();
                if (data.active && data.upload_id) {
                    const savedStart = localStorage.getItem('active_upload_started_at');
                    if (savedStart) {
                        setFrontendTimerStartedAt(parseInt(savedStart, 10));
                    }
                    setUploadProgress({
                        isUploading: true,
                        step: data.step,
                        totalSteps: data.total_steps,
                        stepName: data.step_name,
                        message: data.message,
                        progressPercent: data.progress_percent,
                        startTimeStr: data.start_time_str,
                        estCompletionTimeStr: data.est_completion_time_str,
                        timeRemainingStr: data.time_remaining_str,
                        itemsProcessed: data.items_processed,
                        itemsTotal: data.items_total,
                    });
                    pollProgress(data.upload_id, 0);
                }
            }
        } catch (err) {
            console.error('Check active upload error:', err);
        }
    };

    useEffect(() => {
        if (activeTab === 'region') {
            fetchRegionMappings();
        } else {
            fetchLogs();
            checkActiveUpload();
        }
    }, [activeTab]);

    useEffect(() => {
        if (activeTab !== 'weekly') return;
        if (weeklySubTab === 'sync') fetchSyncLogs();
        else if (weeklySubTab === 'transform') fetchTransformLogs();
    }, [activeTab, weeklySubTab]);

    const getUploadPrefix = (): string => {
        switch (activeTab) {
            case 'weekly': return 'weekly-tracker';
            case 'revenue': return 'revenue-tracker';
            case 'gross_margin': return 'Gross-margin';
            case 'services_trend': return 'services-trend';
            case 'symb_tracker': return 'symb-tracker';
            default: return '';
        }
    };

    const fetchLogs = async () => {
        try {
            const fetchType = activeTab === 'symb_reference' ? 'symb_reference' : activeTab;
            const res = await fetch(`/api/admin/upload-logs?type=${fetchType}`);
            if (res.ok) {
                const data: UploadLog[] = await res.json();
                setLogs(data);
                if (activeTab === 'symb_reference') {
                    const resMap: Record<string, UploadLog> = {};
                    for (const log of data) {
                        if (!resMap[log.type]) {
                            resMap[log.type] = log;
                        }
                    }
                    setRefLogs(resMap);
                }
            }
        } catch (error) {
            console.error(error);
        }
    };

    const fetchRegionMappings = async () => {
        try {
            const res = await fetch('/api/admin/region-mapping');
            if (res.ok) {
                setRegionMappings(await res.json());
            }
        } catch (error) {
            console.error(error);
        }
    };

    const fetchSyncLogs = async () => {
        try {
            const res = await fetch('/api/admin/crm-sync/logs?limit=20');
            if (res.ok) {
                const data = await res.json();
                setSyncLogs(data.logs || []);
                setSyncLogsHasMore(!!data.has_more);
            }
        } catch (error) {
            console.error(error);
        }
    };

    const toggleSyncLogDetail = async (logId: string) => {
        if (expandedDetailId === logId) {
            setExpandedDetailId(null);
            return;
        }
        setExpandedDetailId(logId);
        setDetailSubView('new');
        setDetailSearchQuery('');
        if (syncLogDetails[logId]) return;
        setLoadingDetailId(logId);
        try {
            const res = await fetch(`/api/admin/crm-sync/logs/${logId}`);
            if (res.ok) {
                const data: CrmSyncLog = await res.json();
                setSyncLogDetails(prev => ({ ...prev, [logId]: data }));
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoadingDetailId(null);
        }
    };

    const fetchTransformLogs = async () => {
        try {
            const res = await fetch('/api/admin/crm-transform/logs?limit=20');
            if (res.ok) {
                const data = await res.json();
                setTransformLogs(data.logs || []);
                setTransformLogsHasMore(!!data.has_more);
            }
        } catch (error) {
            console.error(error);
        }
    };

    const getAuthHeaders = (): Record<string, string> => {
        const stored = getStoredAuth();
        return stored?.token ? { Authorization: `Bearer ${stored.token}` } : {};
    };

    const handleResyncNow = async () => {
        setIsSyncing(true);
        setStatusMsg('Running Zoho CRM sync...');
        try {
            const res = await fetch('/api/admin/crm-sync/run', { method: 'POST', headers: getAuthHeaders() });
            const data = await res.json();
            if (res.ok) {
                setStatusMsg(`Sync complete: ${data.new_records} new, ${data.updated_records} updated. Transform ${data.transform?.status || 'skipped'}.`);
            } else {
                setStatusMsg(`Error: ${data.detail || 'Sync failed'}`);
            }
        } catch (err: any) {
            setStatusMsg(`Error: ${err.message}`);
        } finally {
            setIsSyncing(false);
            fetchSyncLogs();
            fetchTransformLogs();
        }
    };

    const handleTransformNow = async () => {
        setIsTransforming(true);
        setStatusMsg('Running Transform...');
        try {
            const res = await fetch('/api/admin/crm-transform/run', { method: 'POST', headers: getAuthHeaders() });
            const data = await res.json();
            if (res.ok) {
                setStatusMsg(data.status === 'completed' ? `Transform complete: ${data.records} records for week ${data.week}.` : `Transform failed: ${data.error_message}`);
            } else {
                setStatusMsg(`Error: ${data.detail || 'Transform failed'}`);
            }
        } catch (err: any) {
            setStatusMsg(`Error: ${err.message}`);
        } finally {
            setIsTransforming(false);
            fetchTransformLogs();
        }
    };

    /*
    const _handleSymbSoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;
        const file = e.target.files[0];
        const formData = new FormData();
        formData.append('file', file);
        try {
            setStatusMsg('Uploading SYMB SO Numbers...');
            const res = await fetch('/api/admin/symb-so-numbers/upload', {
                method: 'POST',
                body: formData
            });
            const data = await res.json();
            if (res.ok) {
                setStatusMsg(`Success: ${data.message}`);
                fetchLogs();
            } else {
                setStatusMsg(`Error: ${data.detail}`);
            }
        } catch (err: any) {
            setStatusMsg(`Error: ${err.message}`);
        }
    };

    const _handleJabilUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;
        const file = e.target.files[0];
        const formData = new FormData();
        formData.append('file', file);
        try {
            setStatusMsg('Uploading Jabil Production List Price...');
            const res = await fetch('/api/admin/symb-jabil-production/upload', {
                method: 'POST',
                body: formData
            });
            const data = await res.json();
            if (res.ok) {
                setStatusMsg(`Success: ${data.message}`);
                fetchLogs();
            } else {
                setStatusMsg(`Error: ${data.detail}`);
            }
        } catch (err: any) {
            setStatusMsg(`Error: ${err.message}`);
        }
    };

    const _handleSymbPlanUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;
        const file = e.target.files[0];
        const formData = new FormData();
        formData.append('file', file);
        try {
            setStatusMsg('Uploading SYMB Plan CSV...');
            const res = await fetch('/api/admin/symb-plan/upload', { method: 'POST', body: formData });
            const data = await res.json();
            if (res.ok) { setStatusMsg(`Success: ${data.message}`); fetchLogs(); } else { setStatusMsg(`Error: ${data.detail}`); }
        } catch (err: any) { setStatusMsg(`Error: ${err.message}`); }
    };
    */

    const handleErpMechUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;
        const file = e.target.files[0];
        const formData = new FormData();
        formData.append('file', file);
        try {
            setStatusMsg('Uploading ERP MECH Excel...');
            const res = await fetch('/api/admin/symb-erp-mech/upload', { method: 'POST', body: formData });
            const data = await res.json();
            if (res.ok) { setStatusMsg(`Success: ${data.message}`); fetchLogs(); } else { setStatusMsg(`Error: ${data.detail}`); }
        } catch (err: any) { setStatusMsg(`Error: ${err.message}`); }
    };



    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setFile(e.target.files[0]);
            setStatusMsg('');
        }
    };

    const validateAndUpload = async () => {
        if (!file) {
            setStatusMsg("Please select a file.");
            return;
        }

        // 1. Validate extension
        if (!file.name.toLowerCase().endsWith('.csv')) {
            setStatusMsg("Invalid file type. Only .csv allowed.");
            return;
        }

        let dateStr = '';
        let weekNum = 0;

        if (activeTab === 'invoice') {
            // For invoice, filename can be anything as long as columns match
            // Attempt to extract date from filename if present (e.g. invoice_26-01-2026.csv)
            const dateMatch = file.name.match(/(\d{2}-\d{2}-(\d{4}|\d{2}))\.csv$/i);
            if (dateMatch) {
                dateStr = dateMatch[1];
                const parts = dateStr.split('-');
                let [day, month, year] = parts.map(Number);
                if (year < 100) year += 2000;
                const dateObj = new Date(year, month - 1, day);
                if (!isNaN(dateObj.getTime())) {
                    weekNum = getSimpleWeekNumber(dateObj);
                }
            }
            if (!dateStr || !weekNum) {
                const now = new Date();
                const dd = String(now.getDate()).padStart(2, '0');
                const mm = String(now.getMonth() + 1).padStart(2, '0');
                dateStr = `${dd}-${mm}-${now.getFullYear()}`;
                weekNum = getSimpleWeekNumber(now);
            }

            // Client-side CSV column check
            try {
                const textHeader = await file.slice(0, 2048).text();
                const firstLine = textHeader.split('\n')[0].toLowerCase();
                const requiredCols = ['record id', 'account name', 'grand total', 'econ-region', 'invoice date'];
                const missing = requiredCols.filter(col => !firstLine.includes(col));
                if (missing.length > 0) {
                    setStatusMsg(`Invalid CSV columns. Missing: ${missing.join(', ')}. Required: Record Id, Account Name, Grand Total, econ-Region, Invoice Date.`);
                    return;
                }
            } catch (colErr) {
                console.warn("Could not pre-read CSV headers:", colErr);
            }
        } else {
            // 2. Validate Filename Format for standard tabs
            // "weekly-tracker_26-01-2026.csv" or "Gross-margin_23-03-2026.csv"
            const prefix = getUploadPrefix();
            const regex = new RegExp(`^${prefix}_(\\d{2}-\\d{2}-(\\d{4}|\\d{2}))\\.csv$`, 'i');

            const match = file.name.match(regex);
            if (!match) {
                setStatusMsg(`Invalid filename. Expected format: '${prefix}_DD-MM-YYYY.csv'`);
                return;
            }

            dateStr = match[1]; // "26-01-2026" or "26-01-26"
            const parts = dateStr.split('-');
            let [day, month, year] = parts.map(Number);
            if (year < 100) year += 2000; // Handle YY -> 20YY
            const dateObj = new Date(year, month - 1, day);

            if (isNaN(dateObj.getTime())) {
                setStatusMsg("Invalid date in filename.");
                return;
            }

            weekNum = getSimpleWeekNumber(dateObj);
        }

        // 3. Confirm
        if (!window.confirm(`Process file for ${activeTab === 'invoice' ? 'Invoice Data' : 'Week ' + weekNum}?`)) {
            return;
        }

        // 4. Submit File to Backend using FormData
        try {
            // CREATE FORMDATA with actual file
            const formData = new FormData();
            formData.append('week', weekNum.toString());
            formData.append('file_date', dateStr);
            formData.append('file_name', file.name);
            formData.append('type', activeTab);
            formData.append('file', file);  // ← ACTUAL CSV FILE

            // Start upload
            localStorage.setItem('active_upload_started_at', Date.now().toString());
            setUploadProgress({
                isUploading: true,
                step: 0,
                totalSteps: 11,
                stepName: 'Starting',
                message: 'Initiating upload...',
                progressPercent: 0
            });
            setStatusMsg('');

            const res = await fetch('/api/admin/upload-logs', {
                method: 'POST',
                body: formData
            });

            if (res.ok) {
                const result = await res.json();
                const uploadId = result.upload_id;

                // Start polling for progress
                pollProgress(uploadId, weekNum);
            } else {
                const err = await res.json();
                setStatusMsg(`Error: ${err.detail}`);
                setUploadProgress(null);
            }
        } catch (error) {
            console.error(error);
            setStatusMsg("Failed to connect to server.");
            setUploadProgress(null);
        }
    };

    const pollProgress = async (uploadId: string, weekNum: number) => {
        const pollInterval = setInterval(async () => {
            try {
                const res = await fetch(`/api/admin/upload-progress/${uploadId}`);

                if (!res.ok) {
                    clearInterval(pollInterval);
                    setStatusMsg("Progress tracking lost");
                    setUploadProgress(null);
                    return;
                }

                const progress = await res.json();

                setUploadProgress({
                    isUploading: progress.status === 'processing',
                    step: progress.step,
                    totalSteps: progress.total_steps,
                    stepName: progress.step_name,
                    message: progress.message,
                    progressPercent: progress.progress_percent,
                    startTimeStr: progress.start_time_str,
                    estCompletionTimeStr: progress.est_completion_time_str,
                    timeRemainingStr: progress.time_remaining_str,
                    itemsProcessed: progress.items_processed,
                    itemsTotal: progress.items_total,
                });

                if (progress.message) {
                    setTerminalLogs(prev => {
                        const newLogs = progress.message.split('\n').map((m: string) => m.trim()).filter((m: string) => m.length > 0);
                        let updated = [...prev];
                        let changed = false;
                        
                        const existingMsgs = new Set(prev.map(l => l.msg));
                        for (const m of newLogs) {
                            if (!existingMsgs.has(m)) {
                                updated.push({ time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'}), msg: m });
                                changed = true;
                                existingMsgs.add(m);
                            }
                        }
                        return changed ? updated : prev;
                    });
                    
                    const preparedMatch = progress.message.match(/Prepared (\d+) closed won\/lost opportunity records/i);
                    const fetchingMatch = progress.message.match(/Fetching \d+\/(\d+) records/i);
                    
                    let totalRecords = 0;
                    if (preparedMatch) {
                        totalRecords = parseInt(preparedMatch[1], 10);
                    } else if (fetchingMatch) {
                        totalRecords = parseInt(fetchingMatch[1], 10);
                    }
            
                    if (totalRecords > 0) {
                        setFrontendTimerTotalSecs(prev => {
                            if (prev === null) {
                                const secs = Math.ceil(totalRecords * 1.2);
                                setFrontendTimerStartedAt(Date.now());
                                return secs;
                            }
                            return prev;
                        });
                    }
                }

                // Check if completed or error
                if (progress.status === 'completed') {
                    localStorage.removeItem('active_upload_started_at');
                    clearInterval(pollInterval);
                    setStatusMsg(progress.message || `Success! Week ${weekNum} processed.`);
                    setUploadProgress(null);
                    setFile(null);
                    fetchLogs();
                    const fileInput = document.getElementById('csv-upload') as HTMLInputElement;
                    if (fileInput) fileInput.value = '';
                } else if (progress.status === 'error') {
                    localStorage.removeItem('active_upload_started_at');
                    clearInterval(pollInterval);
                    setStatusMsg(`Error: ${progress.error || progress.message}`);
                    setUploadProgress(null);
                }
            } catch (error) {
                console.error('Polling error:', error);
                clearInterval(pollInterval);
                setUploadProgress(null);
            }
        }, 2000);  // Poll every 2000ms
    };
    const triggerAutomatedServicesTrendSync = async (weekToSync?: number) => {
        let weekNum = weekToSync;
        if (!weekNum) {
            const weeklyLog = logs.find(l => l.type === 'weekly');
            if (weeklyLog) {
                weekNum = weeklyLog.week;
            }
        }
        if (!weekNum) {
            setStatusMsg("No weekly tracker uploads found to sync.");
            return;
        }

        if (!window.confirm(`Run automated Services Trend sync for Week ${weekNum}?`)) return;

        try {
            const formData = new FormData();
            formData.append('week', weekNum.toString());

            setUploadProgress({
                isUploading: true,
                step: 0,
                totalSteps: 5,
                stepName: 'Starting',
                message: 'Initiating automated Services Trend sync...',
                progressPercent: 0
            });
            setStatusMsg('');

            const res = await fetch('/api/admin/trigger-services-trend-sync', {
                method: 'POST',
                body: formData
            });

            if (res.ok) {
                const result = await res.json();
                pollProgress(result.upload_id, weekNum);
            } else {
                const err = await res.json();
                setStatusMsg(`Error: ${err.detail}`);
                setUploadProgress(null);
            }
        } catch (error) {
            console.error(error);
            setStatusMsg('Failed to connect to server.');
            setUploadProgress(null);
        }
    };

    const handleDelete = async (id: string, week?: number, fileName?: string) => {
        const confirmMsg = week && week > 0
            ? `Are you sure you want to delete logs for Week ${week}?`
            : `Are you sure you want to delete log and data for ${fileName || 'this upload'}?`;
        if (!confirm(confirmMsg)) return;
        try {
            const res = await fetch(`/api/admin/upload-logs/${id}`, { method: 'DELETE' });
            if (res.ok) fetchLogs();
        } catch (error) {
            console.error(error);
        }
    };

    const handleRegionUpload = async () => {
        if (!file) {
            setStatusMsg("Please select a file.");
            return;
        }

        // Validate extension
        if (!file.name.toLowerCase().endsWith('.csv')) {
            setStatusMsg("Invalid file type. Only .csv allowed.");
            return;
        }

        // Confirm upload
        if (!window.confirm(`Upload this region mapping file? This will replace all existing mappings.`)) {
            return;
        }

        try {
            const formData = new FormData();
            formData.append('file', file);

            setStatusMsg('Uploading...');
            const res = await fetch('/api/admin/region-mapping/upload', {
                method: 'POST',
                body: formData
            });

            if (res.ok) {
                const result = await res.json();
                setStatusMsg(result.message || 'Upload successful!');
                setFile(null);
                const fileInput = document.getElementById('csv-upload') as HTMLInputElement;
                if (fileInput) fileInput.value = '';
                fetchRegionMappings();
            } else {
                const err = await res.json();
                setStatusMsg(`Error: ${err.detail}`);
            }
        } catch (error) {
            console.error(error);
            setStatusMsg("Failed to connect to server.");
        }
    };

    return (
        <div style={{ marginTop: '2rem' }}>
            {/* Tabs */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0' }}>
                <button
                    onClick={() => setActiveTab('weekly')}
                    style={{
                        backgroundColor: activeTab === 'weekly' ? '#333333' : '#6b7280', // Dark grey active, light inactive
                        color: 'white',
                        border: 'none',
                        padding: '0.8rem 2rem',
                        fontSize: '1rem',
                        fontWeight: '700',
                        clipPath: 'polygon(0 0, 90% 0, 100% 100%, 0 100%)',
                        cursor: 'pointer',
                        minWidth: '150px',
                        textAlign: 'left'
                    }}
                >
                    Weekly
                </button>
                <button
                    onClick={() => setActiveTab('invoice')}
                    style={{
                        backgroundColor: activeTab === 'invoice' ? '#333333' : '#6b7280',
                        color: 'white',
                        border: 'none',
                        padding: '0.8rem 2rem',
                        fontSize: '1rem',
                        fontWeight: '700',
                        clipPath: 'polygon(0 0, 90% 0, 100% 100%, 0 100%)',
                        cursor: 'pointer',
                        minWidth: '150px',
                        textAlign: 'left'
                    }}
                >
                    Invoice
                </button>
                <button
                    onClick={() => setActiveTab('revenue')}
                    style={{
                        backgroundColor: activeTab === 'revenue' ? '#333333' : '#6b7280',
                        color: 'white',
                        border: 'none',
                        padding: '0.8rem 2rem',
                        fontSize: '1rem',
                        fontWeight: '700',
                        clipPath: 'polygon(0 0, 90% 0, 100% 100%, 0 100%)',
                        cursor: 'pointer',
                        minWidth: '150px',
                        textAlign: 'left'
                    }}
                >
                    Revenue
                </button>
                <button
                    onClick={() => setActiveTab('region')}
                    style={{
                        backgroundColor: activeTab === 'region' ? '#333333' : '#6b7280',
                        color: 'white',
                        border: 'none',
                        padding: '0.8rem 2rem',
                        fontSize: '1rem',
                        fontWeight: '700',
                        clipPath: 'polygon(0 0, 90% 0, 100% 100%, 0 100%)',
                        cursor: 'pointer',
                        minWidth: '150px',
                        textAlign: 'left'
                    }}
                >
                    Region Mapping
                </button>
                <button
                    onClick={() => setActiveTab('gross_margin')}
                    style={{
                        backgroundColor: activeTab === 'gross_margin' ? '#333333' : '#6b7280',
                        color: 'white',
                        border: 'none',
                        padding: '0.8rem 2rem',
                        fontSize: '1rem',
                        fontWeight: '700',
                        clipPath: 'polygon(0 0, 90% 0, 100% 100%, 0 100%)',
                        cursor: 'pointer',
                        minWidth: '150px',
                        textAlign: 'left'
                    }}
                >
                    Gross Margin
                </button>
                <button
                    onClick={() => setActiveTab('services_trend')}
                    style={{
                        backgroundColor: activeTab === 'services_trend' ? '#333333' : '#6b7280',
                        color: 'white',
                        border: 'none',
                        padding: '0.8rem 2rem',
                        fontSize: '1rem',
                        fontWeight: '700',
                        clipPath: 'polygon(0 0, 90% 0, 100% 100%, 0 100%)',
                        cursor: 'pointer',
                        minWidth: '150px',
                        textAlign: 'left'
                    }}
                >
                    Services Trend
                </button>
                <button
                    onClick={() => setActiveTab('symb_tracker')}
                    style={{
                        backgroundColor: activeTab === 'symb_tracker' ? '#f5ad42' : '#6b7280',
                        color: activeTab === 'symb_tracker' ? '#000000' : 'white',
                        border: 'none',
                        padding: '0.8rem 2rem',
                        fontSize: '1rem',
                        fontWeight: '700',
                        clipPath: 'polygon(0 0, 90% 0, 100% 100%, 0 100%)',
                        cursor: 'pointer',
                        minWidth: '150px',
                        textAlign: 'left'
                    }}
                >
                    SYMB Tracker
                </button>
                <button
                    onClick={() => setActiveTab('symb_reference')}
                    style={{
                        backgroundColor: activeTab === 'symb_reference' ? '#d97706' : '#6b7280',
                        color: 'white',
                        border: 'none',
                        padding: '0.8rem 2rem',
                        fontSize: '1rem',
                        fontWeight: '700',
                        clipPath: 'polygon(0 0, 90% 0, 100% 100%, 0 100%)',
                        cursor: 'pointer',
                        minWidth: '150px',
                        textAlign: 'left'
                    }}
                >
                    SYMB References
                </button>
            </div>

            {/* Main Content Area */}
            <div style={{
                backgroundColor: '#f1f5f9',
                padding: '3rem',
                minHeight: '600px',
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
            }}>
                {/* Upload Section */}
                <div style={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #e2e8f0',
                    padding: '2.5rem 3rem',
                    borderRadius: '16px',
                    display: activeTab === 'weekly' && !showCsvUpload ? 'none' : 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '1rem',
                    marginBottom: '2.5rem',
                    order: activeTab === 'weekly' ? 2 : 0,
                    boxShadow: '0 1px 2px rgba(15,23,42,0.04), 0 8px 24px rgba(15,23,42,0.06)'
                }}>
                    <div style={{
                        fontSize: '1.3rem',
                        fontWeight: '800',
                        color: '#0f172a',
                        textAlign: 'center'
                    }}>
                        {activeTab === 'region'
                            ? 'Region Mapping Table Upload'
                            : activeTab === 'gross_margin'
                                ? 'Gross Margin data upload'
                                : activeTab === 'invoice'
                                    ? 'Invoice Data Upload'
                                    : activeTab === 'services_trend'
                                        ? 'Services Trend Automated Pipeline'
                                        : activeTab === 'symb_tracker'
                                            ? 'SYMB Mass Orders Data Upload'
                                            : activeTab === 'symb_reference'
                                                ? 'SYMB One-Time Reference Tables Upload'
                                                : `${activeTab} tracker data upload`}
                    </div>
                    <div style={{
                        fontSize: '0.9rem',
                        color: '#64748b',
                        marginBottom: '1rem',
                        textAlign: 'center',
                        maxWidth: '600px'
                    }}>
                        {activeTab === 'region'
                            ? 'CSV must have two columns: "Opportunities Owner" and "Region"'
                            : activeTab === 'invoice'
                                ? 'Upload Invoice Data CSV. Required columns: "Record Id", "Account Name", "Grand Total", "econ-Region", "Invoice Date"'
                                : activeTab === 'services_trend'
                                    ? 'Services Trend data is automatically generated every time a Weekly Tracker CSV is uploaded. Click below to manually re-sync.'
                                    : activeTab === 'symb_reference'
                                        ? 'Upload ERP MECH Excel reference file below (uploaded once, updated anytime).'
                                        : activeTab === 'symb_tracker'
                                            ? 'Upload daily SYMB Mass Orders CSV. Duplicate uploads are restricted per DATE (file_date), allowing daily uploads.'
                                            : `file name format: "${getUploadPrefix()}_dd-mm-yyyy.csv"`
                        }
                    </div>

                    {activeTab === 'symb_reference' ? (
                        <div style={{ display: 'flex', justifyContent: 'center', width: '100%', maxWidth: '500px', backgroundColor: 'rgba(0,0,0,0.2)', padding: '1.5rem', borderRadius: '8px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', color: 'white', width: '100%' }}>
                                <label style={{ fontWeight: '700', fontSize: '0.95rem' }}>ERP MECH (.xlsx)</label>
                                <span style={{ fontSize: '0.8rem', color: '#cbd5e1' }}>CTB Tracker Excel file</span>
                                <input type="file" accept=".xlsx,.xls" onChange={handleErpMechUpload} style={{ marginTop: '0.4rem', color: 'white' }} />
                                {refLogs['symb_ref_erp'] ? (
                                    <div style={{ marginTop: '0.5rem', padding: '0.5rem', backgroundColor: 'rgba(34, 197, 94, 0.15)', borderRadius: '6px', border: '1px solid rgba(34, 197, 94, 0.3)', fontSize: '0.75rem', color: '#86efac' }}>
                                        <div><strong>Last Uploaded:</strong> {refLogs['symb_ref_erp'].file_name}</div>
                                        <div><strong>Date:</strong> {refLogs['symb_ref_erp'].file_date || (refLogs['symb_ref_erp'].created_at ? new Date(refLogs['symb_ref_erp'].created_at).toLocaleDateString() : '')}</div>
                                    </div>
                                ) : (
                                    <span style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '0.3rem' }}>No upload history recorded yet</span>
                                )}
                            </div>
                        </div>
                    ) : activeTab === 'services_trend' ? (
                        <div style={{ textAlign: 'center', padding: '1rem' }}>
                            <button
                                onClick={() => triggerAutomatedServicesTrendSync()}
                                style={{
                                    backgroundColor: '#22c55e',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '8px',
                                    padding: '0.8rem 2.5rem',
                                    fontWeight: '700',
                                    fontSize: '1.1rem',
                                    cursor: 'pointer',
                                    boxShadow: '0 4px 6px rgba(0,0,0,0.15)'
                                }}
                            >
                                ⚡ Run Automated Services Trend Sync
                            </button>
                        </div>
                    ) : (
                        <>
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '1rem',
                                backgroundColor: '#f8fafc',
                                border: '1px dashed #cbd5e1',
                                borderRadius: '12px',
                                padding: '1rem 1.25rem',
                                width: '100%',
                                maxWidth: '480px',
                            }}>
                                <input
                                    id="csv-upload"
                                    type="file"
                                    accept=".csv"
                                    onChange={handleFileChange}
                                    style={{ color: '#334155', fontSize: '0.9rem', flex: 1 }}
                                />
                            </div>

                            <button
                                onClick={activeTab === 'region' ? handleRegionUpload : validateAndUpload}
                                style={{
                                    backgroundColor: activeTab === 'weekly' ? 'transparent' : '#2563eb',
                                    color: activeTab === 'weekly' ? '#475569' : 'white',
                                    border: activeTab === 'weekly' ? '1px solid #cbd5e1' : 'none',
                                    outline: 'none',
                                    borderRadius: '10px',
                                    padding: '0.75rem 3rem',
                                    fontWeight: '700',
                                    fontSize: '1.05rem',
                                    cursor: 'pointer',
                                    boxShadow: activeTab === 'weekly' ? 'none' : '0 4px 10px rgba(37,99,235,0.25)',
                                }}
                            >
                                Submit
                            </button>

                            {activeTab === 'weekly' && (
                                <button
                                    onClick={() => setShowCsvUpload(false)}
                                    style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '0.8rem', cursor: 'pointer', textDecoration: 'underline' }}
                                >
                                    Hide upload panel
                                </button>
                            )}

                            {/* CRM Report Link Button */}
                            <div style={{ marginTop: '0.5rem', display: 'flex', justifyContent: 'center', width: '100%' }}>
                                <a
                                    href={activeTab === 'invoice' ? "https://crm.zoho.com/crm/org1644714/tab/Reports/38660000622435104" : "https://crm.zoho.com/crm/org1644714/tab/Reports/38660000432721500"}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{
                                        backgroundColor: 'transparent',
                                        color: '#475569',
                                        padding: '0.5rem 1rem',
                                        borderRadius: '8px',
                                        fontWeight: '700',
                                        fontSize: '0.9rem',
                                        textDecoration: 'none',
                                        display: 'inline-block',
                                        textAlign: 'center',
                                        border: '1px solid #cbd5e1',
                                        cursor: 'pointer'
                                    }}
                                >
                                    Get CRM report from here ↗
                                </a>
                            </div>
                        </>
                    )}

                    {/* Progress Bar - shown when uploading */}
                    {uploadProgress && (
                        <div style={{
                            width: '100%',
                            marginTop: '1rem',
                            padding: '1rem',
                            backgroundColor: '#1e293b',
                            borderRadius: '12px'
                        }}>
                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                marginBottom: '0.5rem',
                                color: 'white',
                                fontSize: '0.9rem'
                            }}>
                                <span style={{ fontWeight: '600' }}>
                                    Step {uploadProgress.step} of {uploadProgress.totalSteps}: {uploadProgress.stepName}
                                </span>
                                <span>{uploadProgress.progressPercent}%</span>
                            </div>
                            <div style={{
                                width: '100%',
                                height: '24px',
                                backgroundColor: 'rgba(0,0,0,0.3)',
                                borderRadius: '12px',
                                overflow: 'hidden',
                                position: 'relative'
                            }}>
                                <div style={{
                                    width: `${uploadProgress.progressPercent}%`,
                                    height: '100%',
                                    backgroundColor: '#3b82f6',
                                    transition: 'width 0.3s ease',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}></div>
                            </div>
                            {frontendTimerRemaining !== null && frontendTimerStartedAt !== null ? (
                                <div style={{
                                    marginTop: '0.85rem',
                                    backgroundColor: 'rgba(15, 23, 42, 0.75)',
                                    border: '1px solid rgba(59, 130, 246, 0.4)',
                                    borderRadius: '8px',
                                    padding: '0.85rem 1.1rem',
                                    display: 'grid',
                                    gap: '0.6rem'
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#60a5fa', fontWeight: 600, fontSize: '0.92rem' }}>
                                        <span>⚡ Automated Services Trend Extraction</span>
                                        <span style={{ backgroundColor: '#1d4ed8', color: 'white', padding: '0.15rem 0.55rem', borderRadius: '10px', fontSize: '0.75rem', fontWeight: 600 }}>
                                            ~1.2s / record
                                        </span>
                                    </div>
                                    <div style={{
                                        display: 'flex',
                                        flexWrap: 'wrap',
                                        gap: '1.2rem',
                                        backgroundColor: 'rgba(0, 0, 0, 0.3)',
                                        padding: '0.55rem 0.9rem',
                                        borderRadius: '6px',
                                        fontSize: '0.88rem',
                                        color: '#e5e7eb'
                                    }}>
                                        <span>🕒 <strong>Started:</strong> {new Date(frontendTimerStartedAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                        <span style={{ color: '#fbbf24', fontWeight: 700 }}>
                                            ⏳ <strong>Remaining:</strong> {Math.floor(frontendTimerRemaining / 60)}m {frontendTimerRemaining % 60}s
                                        </span>
                                    </div>
                                </div>
                            ) : uploadProgress.startTimeStr ? (
                                <div style={{
                                    marginTop: '0.85rem',
                                    backgroundColor: 'rgba(15, 23, 42, 0.75)',
                                    border: '1px solid rgba(59, 130, 246, 0.4)',
                                    borderRadius: '8px',
                                    padding: '0.85rem 1.1rem',
                                    display: 'grid',
                                    gap: '0.6rem'
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#60a5fa', fontWeight: 600, fontSize: '0.92rem' }}>
                                        <span>⚡ {uploadProgress.itemsProcessed !== undefined && uploadProgress.itemsTotal !== undefined ? `Fetching Zoho Timelines (${uploadProgress.itemsProcessed} / ${uploadProgress.itemsTotal} records)` : "Processing"}</span>
                                    </div>
                                    <div style={{
                                        display: 'flex',
                                        flexWrap: 'wrap',
                                        gap: '1.2rem',
                                        backgroundColor: 'rgba(0, 0, 0, 0.3)',
                                        padding: '0.55rem 0.9rem',
                                        borderRadius: '6px',
                                        fontSize: '0.88rem',
                                        color: '#e5e7eb'
                                    }}>
                                        <span>🕒 <strong>Started:</strong> {uploadProgress.startTimeStr}</span>
                                        <span>🏁 <strong>Est. Completion:</strong> {uploadProgress.estCompletionTimeStr}</span>
                                        {uploadProgress.timeRemainingStr && (
                                            <span style={{ color: '#fbbf24', fontWeight: 700 }}>
                                                ⏳ <strong>Remaining:</strong> {uploadProgress.timeRemainingStr}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div style={{
                                    marginTop: '0.5rem',
                                    color: 'rgba(255,255,255,0.8)',
                                    fontSize: '0.85rem',
                                    fontStyle: 'italic'
                                }}>
                                    {uploadProgress.message}
                                </div>
                            )}

                            {/* Terminal Logs */}
                            {terminalLogs.length > 0 && (
                                <div style={{
                                    marginTop: '1rem',
                                    backgroundColor: '#0f172a',
                                    borderRadius: '6px',
                                    padding: '0.75rem',
                                    border: '1px solid #334155',
                                    maxHeight: '180px',
                                    overflowY: 'auto',
                                    fontFamily: 'monospace',
                                    fontSize: '0.8rem',
                                    color: '#93c5fd',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '4px'
                                }}>
                                    {terminalLogs.map((log, i) => (
                                        <div key={i}><span style={{ color: '#4ade80' }}>[{log.time}]</span> {log.msg}</div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Status Message */}
                    {statusMsg && (
                        <div style={{
                            fontSize: '0.9rem',
                            color: statusMsg.includes('Error') ? '#dc2626' : '#059669',
                            backgroundColor: statusMsg.includes('Error') ? '#fef2f2' : '#f0fdf4',
                            border: `1px solid ${statusMsg.includes('Error') ? '#fecaca' : '#bbf7d0'}`,
                            borderRadius: '10px',
                            padding: '0.6rem 1.2rem',
                            textAlign: 'center',
                            fontWeight: '600'
                        }}>
                            {statusMsg}
                        </div>
                    )}
                </div>

                {/* Logs or Region Mapping Table Section */}
                {activeTab === 'region' ? (
                    <>
                        <h3 style={{ fontSize: '1.8rem', fontWeight: '800', color: '#374151', marginBottom: '2rem' }}>
                            Current Region Mappings
                        </h3>

                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                                <thead>
                                    <tr>
                                        <th style={{ padding: '0.85rem 1rem', color: '#475569', fontWeight: '700', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '2px solid #e2e8f0' }}>Opportunities Owner</th>
                                        <th style={{ padding: '0.85rem 1rem', color: '#475569', fontWeight: '700', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '2px solid #e2e8f0' }}>Region</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {regionMappings.map(mapping => (
                                        <tr key={mapping.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                                            <td style={{ padding: '1rem', color: '#1f2937', fontWeight: '600' }}>{mapping.opportunities_owner}</td>
                                            <td style={{ padding: '1rem', color: '#1f2937', fontWeight: '600' }}>{mapping.region}</td>
                                        </tr>
                                    ))}
                                    {regionMappings.length === 0 && (
                                        <tr>
                                            <td colSpan={2} style={{ padding: '2rem', textAlign: 'center', color: '#4b5563' }}>
                                                No region mappings yet.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </>
                ) : activeTab === 'weekly' ? (
                    <div style={{ order: 1, display: 'flex', flexDirection: 'column' }}>
                        {/* CRM Sync controls: Resync now / Transform buttons */}
                        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem' }}>
                            <button
                                onClick={handleResyncNow}
                                disabled={isSyncing}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    padding: '0.7rem 1.5rem',
                                    borderRadius: '8px',
                                    border: 'none',
                                    outline: 'none',
                                    fontWeight: 700,
                                    fontSize: '0.95rem',
                                    cursor: isSyncing ? 'not-allowed' : 'pointer',
                                    backgroundColor: isSyncing ? '#94a3b8' : '#2563eb',
                                    color: 'white',
                                    boxShadow: '0 4px 10px rgba(37,99,235,0.25)',
                                }}
                            >
                                <RefreshCw size={16} />
                                {isSyncing ? 'Syncing…' : 'Resync now'}
                            </button>
                            <button
                                onClick={handleTransformNow}
                                disabled={isTransforming}
                                style={{
                                    padding: '0.7rem 1.4rem',
                                    borderRadius: '8px',
                                    border: '1px solid #cbd5e1',
                                    outline: 'none',
                                    fontWeight: 700,
                                    fontSize: '0.95rem',
                                    cursor: isTransforming ? 'not-allowed' : 'pointer',
                                    backgroundColor: 'transparent',
                                    color: '#475569',
                                }}
                            >
                                {isTransforming ? 'Transforming…' : 'Transform'}
                            </button>
                            {!showCsvUpload && (
                                <button
                                    onClick={() => setShowCsvUpload(true)}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.5rem',
                                        backgroundColor: 'transparent',
                                        color: '#475569',
                                        border: '1px solid #cbd5e1',
                                        outline: 'none',
                                        borderRadius: '8px',
                                        padding: '0.7rem 1.4rem',
                                        fontWeight: 700,
                                        fontSize: '0.95rem',
                                        cursor: 'pointer',
                                    }}
                                >
                                    <UploadIcon size={16} />
                                    Manual CSV upload
                                </button>
                            )}
                        </div>

                        {/* Sub-tabs: Uploads / Sync History / Transform History */}
                        <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1.5rem' }}>
                            {(['sync', 'transform', 'uploads'] as const).map(tab => (
                                <button
                                    key={tab}
                                    onClick={() => setWeeklySubTab(tab)}
                                    style={{
                                        padding: '0.6rem 1.4rem',
                                        borderRadius: '6px',
                                        border: 'none',
                                        outline: 'none',
                                        background: weeklySubTab === tab ? '#333333' : '#6b7280',
                                        fontWeight: 700,
                                        fontSize: '0.9rem',
                                        color: 'white',
                                        cursor: 'pointer',
                                    }}
                                >
                                    {tab === 'uploads' ? 'Uploads' : tab === 'sync' ? 'Sync History' : 'Transform History'}
                                </button>
                            ))}
                        </div>

                        {weeklySubTab === 'uploads' && (
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                                    <thead>
                                        <tr>
                                            <th style={{ padding: '0.85rem 1rem', color: '#475569', fontWeight: '700', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '2px solid #e2e8f0' }}>Week</th>
                                            <th style={{ padding: '0.85rem 1rem', color: '#475569', fontWeight: '700', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '2px solid #e2e8f0' }}>Date</th>
                                            <th style={{ padding: '0.85rem 1rem', color: '#475569', fontWeight: '700', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '2px solid #e2e8f0' }}>File name</th>
                                            <th style={{ padding: '0.85rem 1rem', color: '#475569', fontWeight: '700', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '2px solid #e2e8f0' }}>Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {logs.map(log => (
                                            <tr key={log.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                                                <td style={{ padding: '1rem', color: '#1f2937', fontWeight: '600' }}>
                                                    {log.week && log.week > 0 ? `Week ${log.week}` : 'Reference Table'}
                                                </td>
                                                <td style={{ padding: '1rem', color: '#1f2937', fontWeight: '600' }}>{log.file_date}</td>
                                                <td style={{ padding: '1rem', color: '#1f2937', fontWeight: '600' }}>{log.file_name}</td>
                                                <td style={{ padding: '1rem' }}>
                                                    <button
                                                        onClick={() => handleDelete(log.id, log.week, log.file_name)}
                                                        style={{
                                                            background: 'none',
                                                            border: 'none',
                                                            cursor: 'pointer',
                                                            color: '#ef4444'
                                                        }}
                                                    >
                                                        <Trash2 size={20} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                        {logs.length === 0 && (
                                            <tr>
                                                <td colSpan={4} style={{ padding: '2rem', textAlign: 'center', color: '#4b5563' }}>
                                                    No uploads yet.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {weeklySubTab === 'sync' && (
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                                    <thead>
                                        <tr>
                                            <th style={{ padding: '0.85rem 1rem', color: '#475569', fontWeight: '700', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '2px solid #e2e8f0' }}>Started</th>
                                            <th style={{ padding: '0.85rem 1rem', color: '#475569', fontWeight: '700', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '2px solid #e2e8f0' }}>Run Type</th>
                                            <th style={{ padding: '0.85rem 1rem', color: '#475569', fontWeight: '700', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '2px solid #e2e8f0' }}>Trigger</th>
                                            <th style={{ padding: '0.85rem 1rem', color: '#475569', fontWeight: '700', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '2px solid #e2e8f0' }}>Status</th>
                                            <th style={{ padding: '0.85rem 1rem', color: '#475569', fontWeight: '700', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '2px solid #e2e8f0' }}>Scanned</th>
                                            <th style={{ padding: '0.85rem 1rem', color: '#475569', fontWeight: '700', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '2px solid #e2e8f0' }}>New</th>
                                            <th style={{ padding: '0.85rem 1rem', color: '#475569', fontWeight: '700', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '2px solid #e2e8f0' }}>Updated</th>
                                            <th style={{ padding: '0.85rem 1rem', color: '#475569', fontWeight: '700', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '2px solid #e2e8f0' }}></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {syncLogs.map(log => {
                                            const hasCounts = log.new_records > 0 || log.updated_records > 0;
                                            const detail = syncLogDetails[log._id];
                                            const isExpanded = expandedDetailId === log._id;
                                            return (
                                            <Fragment key={log._id}>
                                                <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                                                    <td style={{ padding: '1rem', color: '#1f2937', fontWeight: '600' }} title={formatRelativeTime(log.started_at)}>{formatExactTime(log.started_at)}</td>
                                                    <td style={{ padding: '1rem', color: '#1f2937', fontWeight: '600' }}>{log.run_type === 'delta_sync' ? 'Delta Sync' : 'Deleted Cleanup'}</td>
                                                    <td style={{ padding: '1rem' }}><TriggerBadge triggerType={log.trigger_type} triggeredBy={log.triggered_by} /></td>
                                                    <td style={{ padding: '1rem' }}>
                                                        <StatusPill status={log.status} />
                                                        {log.status === 'failed' && log.error_message && (
                                                            <button
                                                                onClick={() => setExpandedErrorId(expandedErrorId === log._id ? null : log._id)}
                                                                style={{ marginLeft: '0.5rem', background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.75rem', textDecoration: 'underline' }}
                                                            >
                                                                {expandedErrorId === log._id ? 'hide' : 'details'}
                                                            </button>
                                                        )}
                                                    </td>
                                                    <td style={{ padding: '1rem', color: '#1f2937', fontWeight: '600' }}>{log.records_scanned}</td>
                                                    <td style={{ padding: '1rem', color: '#1f2937', fontWeight: '600' }}>{log.new_records}</td>
                                                    <td style={{ padding: '1rem', color: '#1f2937', fontWeight: '600' }}>{log.updated_records}</td>
                                                    <td style={{ padding: '1rem' }}>
                                                        {hasCounts && log.run_type === 'delta_sync' && (
                                                            <button
                                                                onClick={() => toggleSyncLogDetail(log._id)}
                                                                style={{
                                                                    background: isExpanded ? '#334155' : '#e2e8f0',
                                                                    color: isExpanded ? 'white' : '#334155',
                                                                    border: 'none',
                                                                    outline: 'none',
                                                                    borderRadius: '6px',
                                                                    padding: '0.4rem 0.9rem',
                                                                    fontSize: '0.78rem',
                                                                    fontWeight: 700,
                                                                    cursor: 'pointer',
                                                                    whiteSpace: 'nowrap',
                                                                }}
                                                            >
                                                                {isExpanded ? 'Hide detail' : 'Show detail'}
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                                {expandedErrorId === log._id && log.error_message && (
                                                    <tr>
                                                        <td colSpan={8} style={{ padding: '0.75rem 1rem', color: '#ef4444', fontFamily: 'monospace', fontSize: '0.8rem', backgroundColor: 'rgba(239,68,68,0.06)' }}>
                                                            {log.error_message}
                                                        </td>
                                                    </tr>
                                                )}
                                                {isExpanded && (
                                                    <tr>
                                                        <td colSpan={8} style={{ padding: 0, backgroundColor: '#f8fafc' }}>
                                                            {loadingDetailId === log._id ? (
                                                                <div style={{ padding: '1.5rem', textAlign: 'center', color: '#64748b', fontSize: '0.85rem' }}>Loading detail…</div>
                                                            ) : !detail ? (
                                                                <div style={{ padding: '1.5rem', textAlign: 'center', color: '#64748b', fontSize: '0.85rem' }}>Could not load detail.</div>
                                                            ) : (
                                                                <div style={{ padding: '1.25rem 1.5rem' }}>
                                                                    {(() => {
                                                                        const q = detailSearchQuery.trim().toLowerCase();
                                                                        const matches = (recordId: string, dealName: string | null, accountName: string | null) =>
                                                                            !q ||
                                                                            recordId.toLowerCase().includes(q) ||
                                                                            (dealName || '').toLowerCase().includes(q) ||
                                                                            (accountName || '').toLowerCase().includes(q);
                                                                        const filteredNew = (detail.new_records_detail ?? []).filter(rec => matches(rec.record_id, rec.deal_name, rec.account_name));
                                                                        const filteredUpdated = (detail.updated_records_detail ?? []).filter(rec => matches(rec.record_id, rec.deal_name, rec.account_name));

                                                                        return (
                                                                    <>
                                                                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
                                                                        <button
                                                                            onClick={() => setDetailSubView('new')}
                                                                            style={{
                                                                                padding: '0.4rem 1rem', borderRadius: '999px', border: 'none', outline: 'none',
                                                                                background: detailSubView === 'new' ? '#0f172a' : '#e2e8f0',
                                                                                color: detailSubView === 'new' ? 'white' : '#334155',
                                                                                fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer',
                                                                            }}
                                                                        >
                                                                            New ({filteredNew.length})
                                                                        </button>
                                                                        <button
                                                                            onClick={() => setDetailSubView('updated')}
                                                                            style={{
                                                                                padding: '0.4rem 1rem', borderRadius: '999px', border: 'none', outline: 'none',
                                                                                background: detailSubView === 'updated' ? '#0f172a' : '#e2e8f0',
                                                                                color: detailSubView === 'updated' ? 'white' : '#334155',
                                                                                fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer',
                                                                            }}
                                                                        >
                                                                            Changes made ({filteredUpdated.length})
                                                                        </button>
                                                                    </div>

                                                                    <input
                                                                        type="text"
                                                                        value={detailSearchQuery}
                                                                        onChange={(e) => setDetailSearchQuery(e.target.value)}
                                                                        placeholder="Search by company name, record id, or opportunity name…"
                                                                        style={{
                                                                            width: '100%',
                                                                            padding: '0.55rem 0.9rem',
                                                                            marginBottom: '0.9rem',
                                                                            border: '1px solid #cbd5e1',
                                                                            borderRadius: '8px',
                                                                            fontSize: '0.85rem',
                                                                            color: '#0f172a',
                                                                            outline: 'none',
                                                                        }}
                                                                    />

                                                                    <div style={{ maxHeight: '360px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '10px', backgroundColor: 'white' }}>
                                                                        {detailSubView === 'new' ? (
                                                                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                                                                                <thead>
                                                                                    <tr style={{ position: 'sticky', top: 0, backgroundColor: 'white' }}>
                                                                                        <th style={{ padding: '0.6rem 0.9rem', color: '#64748b', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.03em', borderBottom: '1px solid #e2e8f0' }}>Deal Name</th>
                                                                                        <th style={{ padding: '0.6rem 0.9rem', color: '#64748b', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.03em', borderBottom: '1px solid #e2e8f0' }}>Account Name</th>
                                                                                        <th style={{ padding: '0.6rem 0.9rem', color: '#64748b', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.03em', borderBottom: '1px solid #e2e8f0' }}>Record Id</th>
                                                                                        <th style={{ padding: '0.6rem 0.9rem', color: '#64748b', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.03em', borderBottom: '1px solid #e2e8f0' }}>Stage</th>
                                                                                        <th style={{ padding: '0.6rem 0.9rem', color: '#64748b', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.03em', borderBottom: '1px solid #e2e8f0' }}>Amount</th>
                                                                                        <th style={{ padding: '0.6rem 0.9rem', color: '#64748b', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.03em', borderBottom: '1px solid #e2e8f0' }}>Region</th>
                                                                                        <th style={{ padding: '0.6rem 0.9rem', color: '#64748b', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.03em', borderBottom: '1px solid #e2e8f0' }}>Closing Date</th>
                                                                                    </tr>
                                                                                </thead>
                                                                                <tbody>
                                                                                    {filteredNew.map(rec => (
                                                                                        <tr key={rec.record_id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                                                            <td style={{ padding: '0.6rem 0.9rem', color: '#0f172a', fontWeight: 600, fontSize: '0.85rem' }}>{rec.deal_name || '—'}</td>
                                                                                            <td style={{ padding: '0.6rem 0.9rem', color: '#334155', fontSize: '0.85rem' }}>{rec.account_name || '—'}</td>
                                                                                            <td style={{ padding: '0.6rem 0.9rem', color: '#94a3b8', fontSize: '0.78rem', fontFamily: 'monospace' }}>{rec.record_id}</td>
                                                                                            <td style={{ padding: '0.6rem 0.9rem', color: '#334155', fontSize: '0.85rem' }}>{formatFieldValue(rec.stage)}</td>
                                                                                            <td style={{ padding: '0.6rem 0.9rem', color: '#334155', fontSize: '0.85rem' }}>{formatFieldValue(rec.amount)}</td>
                                                                                            <td style={{ padding: '0.6rem 0.9rem', color: '#334155', fontSize: '0.85rem' }}>{formatFieldValue(rec.region)}</td>
                                                                                            <td style={{ padding: '0.6rem 0.9rem', color: '#334155', fontSize: '0.85rem' }}>{formatFieldValue(rec.closing_date)}</td>
                                                                                        </tr>
                                                                                    ))}
                                                                                    {filteredNew.length === 0 && (
                                                                                        <tr><td colSpan={7} style={{ padding: '1.5rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>{q ? 'No matching records.' : 'No new records in this run.'}</td></tr>
                                                                                    )}
                                                                                </tbody>
                                                                            </table>
                                                                        ) : (
                                                                            <div style={{ padding: '0.5rem' }}>
                                                                                {filteredUpdated.length === 0 && (
                                                                                    <div style={{ padding: '1rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>{q ? 'No matching records.' : 'No updated records in this run.'}</div>
                                                                                )}
                                                                                {filteredUpdated.map(rec => (
                                                                                    <div key={rec.record_id} style={{ padding: '0.75rem 0.9rem', borderBottom: '1px solid #f1f5f9' }}>
                                                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                                                                                            <span style={{
                                                                                                fontFamily: 'monospace', fontSize: '0.7rem', color: '#64748b',
                                                                                                backgroundColor: '#f1f5f9', border: '1px solid #e2e8f0',
                                                                                                borderRadius: '5px', padding: '0.15rem 0.5rem',
                                                                                            }} title="Record Id">{rec.record_id}</span>
                                                                                            <span style={{
                                                                                                fontSize: '0.72rem', fontWeight: 700, color: '#1d4ed8',
                                                                                                backgroundColor: '#eff6ff', border: '1px solid #bfdbfe',
                                                                                                borderRadius: '5px', padding: '0.15rem 0.55rem',
                                                                                            }} title="Account Name">{rec.account_name || 'Unknown account'}</span>
                                                                                            <span style={{ color: '#0f172a', fontWeight: 700, fontSize: '0.9rem' }} title="Opportunities Name">{rec.deal_name || '—'}</span>
                                                                                        </div>
                                                                                        {rec.changes.length === 0 ? (
                                                                                            <span style={{ color: '#94a3b8', fontSize: '0.78rem', fontStyle: 'italic' }}>No tracked field changes (only Modified Time updated)</span>
                                                                                        ) : (
                                                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                                                                                                {rec.changes.map((c, i) => (
                                                                                                    <div key={i} style={{
                                                                                                        display: 'flex', alignItems: 'center', gap: '0.4rem',
                                                                                                        backgroundColor: '#f1f5f9', borderRadius: '6px',
                                                                                                        padding: '0.35rem 0.7rem', fontSize: '0.76rem', color: '#334155',
                                                                                                    }}>
                                                                                                        <strong style={{ minWidth: '160px' }}>{c.field}:</strong>
                                                                                                        <span style={{ color: '#dc2626' }}>{formatFieldValue(c.old)}</span>
                                                                                                        →
                                                                                                        <span style={{ color: '#16a34a' }}>{formatFieldValue(c.new)}</span>
                                                                                                    </div>
                                                                                                ))}
                                                                                            </div>
                                                                                        )}
                                                                                    </div>
                                                                                ))}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                    </>
                                                                        );
                                                                    })()}
                                                                </div>
                                                            )}
                                                        </td>
                                                    </tr>
                                                )}
                                            </Fragment>
                                            );
                                        })}
                                        {syncLogs.length === 0 && (
                                            <tr>
                                                <td colSpan={8} style={{ padding: '2rem', textAlign: 'center', color: '#4b5563' }}>
                                                    No sync runs yet.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                                {syncLogsHasMore && (
                                    <div style={{ textAlign: 'center', padding: '1rem', color: '#9ca3af', fontSize: '0.85rem' }}>
                                        Showing most recent 20 runs.
                                    </div>
                                )}
                            </div>
                        )}

                        {weeklySubTab === 'transform' && (
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                                    <thead>
                                        <tr>
                                            <th style={{ padding: '0.85rem 1rem', color: '#475569', fontWeight: '700', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '2px solid #e2e8f0' }}>Transformed</th>
                                            <th style={{ padding: '0.85rem 1rem', color: '#475569', fontWeight: '700', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '2px solid #e2e8f0' }}>Week</th>
                                            <th style={{ padding: '0.85rem 1rem', color: '#475569', fontWeight: '700', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '2px solid #e2e8f0' }}>Trigger</th>
                                            <th style={{ padding: '0.85rem 1rem', color: '#475569', fontWeight: '700', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '2px solid #e2e8f0' }}>Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {transformLogs.map(log => (
                                            <Fragment key={log._id}>
                                                <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                                                    <td style={{ padding: '1rem', color: '#1f2937', fontWeight: '600' }} title={formatRelativeTime(log.transformed_at)}>{formatExactTime(log.transformed_at)}</td>
                                                    <td style={{ padding: '1rem', color: '#1f2937', fontWeight: '600' }}>Week {log.week}</td>
                                                    <td style={{ padding: '1rem' }}>
                                                        <TriggerBadge triggerType={log.triggered_by === 'auto' ? 'auto' : 'manual'} triggeredBy={log.triggered_by} />
                                                    </td>
                                                    <td style={{ padding: '1rem' }}>
                                                        <StatusPill status={log.status} />
                                                        {log.status === 'failed' && log.error_message && (
                                                            <button
                                                                onClick={() => setExpandedErrorId(expandedErrorId === log._id ? null : log._id)}
                                                                style={{ marginLeft: '0.5rem', background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.75rem', textDecoration: 'underline' }}
                                                            >
                                                                {expandedErrorId === log._id ? 'hide' : 'details'}
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                                {expandedErrorId === log._id && log.error_message && (
                                                    <tr>
                                                        <td colSpan={4} style={{ padding: '0.75rem 1rem', color: '#ef4444', fontFamily: 'monospace', fontSize: '0.8rem', backgroundColor: 'rgba(239,68,68,0.06)' }}>
                                                            {log.error_message}
                                                        </td>
                                                    </tr>
                                                )}
                                            </Fragment>
                                        ))}
                                        {transformLogs.length === 0 && (
                                            <tr>
                                                <td colSpan={4} style={{ padding: '2rem', textAlign: 'center', color: '#4b5563' }}>
                                                    No transform runs yet.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                                {transformLogsHasMore && (
                                    <div style={{ textAlign: 'center', padding: '1rem', color: '#9ca3af', fontSize: '0.85rem' }}>
                                        Showing most recent 20 runs.
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                ) : (
                    <>
                        {/* Logs Section */}
                        <h3 style={{ fontSize: '1.8rem', fontWeight: '800', color: '#374151', marginBottom: '2rem' }}>
                            Uploads Log
                        </h3>

                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                                <thead>
                                    <tr>
                                        <th style={{ padding: '0.85rem 1rem', color: '#475569', fontWeight: '700', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '2px solid #e2e8f0' }}>Week</th>
                                        <th style={{ padding: '0.85rem 1rem', color: '#475569', fontWeight: '700', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '2px solid #e2e8f0' }}>Date</th>
                                        <th style={{ padding: '0.85rem 1rem', color: '#475569', fontWeight: '700', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '2px solid #e2e8f0' }}>File name</th>
                                        <th style={{ padding: '0.85rem 1rem', color: '#475569', fontWeight: '700', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '2px solid #e2e8f0' }}>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {logs.map(log => (
                                        <tr key={log.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                                            <td style={{ padding: '1rem', color: '#1f2937', fontWeight: '600' }}>
                                                {log.week && log.week > 0 ? `Week ${log.week}` : 'Reference Table'}
                                            </td>
                                            <td style={{ padding: '1rem', color: '#1f2937', fontWeight: '600' }}>{log.file_date}</td>
                                            <td style={{ padding: '1rem', color: '#1f2937', fontWeight: '600' }}>{log.file_name}</td>
                                            <td style={{ padding: '1rem' }}>
                                                <button
                                                    onClick={() => handleDelete(log.id, log.week, log.file_name)}
                                                    style={{
                                                        background: 'none',
                                                        border: 'none',
                                                        cursor: 'pointer',
                                                        color: '#ef4444'
                                                    }}
                                                >
                                                    <Trash2 size={20} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {logs.length === 0 && (
                                        <tr>
                                            <td colSpan={4} style={{ padding: '2rem', textAlign: 'center', color: '#4b5563' }}>
                                                No uploads yet.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
