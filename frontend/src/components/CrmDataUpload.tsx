import { useState, useEffect } from 'react';
import { Trash2 } from 'lucide-react';

interface UploadLog {
    id: string;
    week: number;
    file_date: string;
    file_name: string;
    type: 'weekly' | 'revenue' | 'gross_margin' | 'services_trend';
    created_at?: string;
}

interface RegionMapping {
    id: string;
    opportunities_owner: string;
    region: string;
    created_at?: string;
}

export function CrmDataUpload() {
    const [activeTab, setActiveTab] = useState<'weekly' | 'revenue' | 'region' | 'gross_margin' | 'services_trend' | 'symb_tracker' | 'symb_reference'>('weekly');
    const [file, setFile] = useState<File | null>(null);
    const [logs, setLogs] = useState<UploadLog[]>([]);
    const [regionMappings, setRegionMappings] = useState<RegionMapping[]>([]);
    const [statusMsg, setStatusMsg] = useState('');

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
            const res = await fetch(`/api/admin/upload-logs?type=${activeTab}`);
            if (res.ok) {
                setLogs(await res.json());
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

    const handleSymbSoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
            } else {
                setStatusMsg(`Error: ${data.detail}`);
            }
        } catch (err: any) {
            setStatusMsg(`Error: ${err.message}`);
        }
    };

    const handleJabilUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
            } else {
                setStatusMsg(`Error: ${data.detail}`);
            }
        } catch (err: any) {
            setStatusMsg(`Error: ${err.message}`);
        }
    };

    const handleProductionProgressUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;
        const file = e.target.files[0];
        const formData = new FormData();
        formData.append('file', file);
        try {
            setStatusMsg('Uploading SYMB Production Progress CSV...');
            const res = await fetch('/api/admin/symb-production-progress/upload', {
                method: 'POST',
                body: formData
            });
            const data = await res.json();
            if (res.ok) {
                setStatusMsg(`Success: ${data.message}`);
            } else {
                setStatusMsg(`Error: ${data.detail}`);
            }
        } catch (err: any) {
            setStatusMsg(`Error: ${err.message}`);
        }
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

        // 2. Validate Filename Format
        // "weekly-tracker_26-01-2026.csv" or "Gross-margin_23-03-2026.csv"
        // Regex: prefix_DD-MM-YYYY or prefix_DD-MM-YY
        const prefix = getUploadPrefix();
        const regex = new RegExp(`^${prefix}_(\\d{2}-\\d{2}-(\\d{4}|\\d{2}))\\.csv$`, 'i');

        const match = file.name.match(regex);
        if (!match) {
            setStatusMsg(`Invalid filename. Expected format: '${prefix}_DD-MM-YYYY.csv'`);
            return;
        }

        const dateStr = match[1]; // "26-01-2026" or "26-01-26"
        const parts = dateStr.split('-');
        let [day, month, year] = parts.map(Number);
        if (year < 100) year += 2000; // Handle YY -> 20YY
        const dateObj = new Date(year, month - 1, day);

        if (isNaN(dateObj.getTime())) {
            setStatusMsg("Invalid date in filename.");
            return;
        }

        const weekNum = getSimpleWeekNumber(dateObj);

        // 3. Confirm
        if (!window.confirm(`Process file for Week ${weekNum}?`)) {
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

    const handleDelete = async (id: string, week: number) => {
        if (!confirm(`Are you sure you want to delete logs for Week ${week}?`)) return;
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
                backgroundColor: '#9ca3af', // Greyish background from image
                padding: '4rem',
                minHeight: '600px',
                position: 'relative'
            }}>
                {/* Upload Section */}
                <div style={{
                    backgroundColor: activeTab === 'symb_tracker' || activeTab === 'symb_reference' ? '#7c2d12' : '#6b7280',
                    padding: '3rem',
                    borderRadius: '4px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '1rem',
                    marginBottom: '4rem',
                    boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                }}>
                    <div style={{
                        fontSize: '1.2rem',
                        fontWeight: '700',
                        color: 'white',
                        textAlign: 'center'
                    }}>
                        {activeTab === 'region'
                            ? 'Region Mapping Table Upload'
                            : activeTab === 'gross_margin'
                                ? 'Gross Margin data upload'
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
                        color: '#d1d5db',
                        marginBottom: '1rem',
                        textAlign: 'center',
                        maxWidth: '600px'
                    }}>
                        {activeTab === 'region'
                            ? 'CSV must have two columns: "Opportunities Owner" and "Region"'
                            : activeTab === 'services_trend'
                                ? 'Services Trend data is automatically generated every time a Weekly Tracker CSV is uploaded. Click below to manually re-sync.'
                                : activeTab === 'symb_reference'
                                    ? 'Upload SYMB SO Numbers and Jabil Production List Price reference CSV files below (uploaded once, updated anytime).'
                                    : `file name format: "${getUploadPrefix()}_dd-mm-yyyy.csv"`
                        }
                    </div>

                    {activeTab === 'symb_reference' ? (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1.5rem', width: '100%', maxWidth: '950px', backgroundColor: 'rgba(0,0,0,0.2)', padding: '1.5rem', borderRadius: '8px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', color: 'white' }}>
                                <label style={{ fontWeight: '700', fontSize: '0.95rem' }}>1. SYMB SO Numbers (.csv)</label>
                                <span style={{ fontSize: '0.8rem', color: '#cbd5e1' }}>Contains column "SO NUMBER"</span>
                                <input type="file" accept=".csv" onChange={handleSymbSoUpload} style={{ marginTop: '0.4rem', color: 'white' }} />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', color: 'white' }}>
                                <label style={{ fontWeight: '700', fontSize: '0.95rem' }}>2. Jabil Production (.csv)</label>
                                <span style={{ fontSize: '0.8rem', color: '#cbd5e1' }}>Contains columns "SO Number", "Total"</span>
                                <input type="file" accept=".csv" onChange={handleJabilUpload} style={{ marginTop: '0.4rem', color: 'white' }} />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', color: 'white' }}>
                                <label style={{ fontWeight: '700', fontSize: '0.95rem' }}>3. Production Progress (V1/V2) (.csv)</label>
                                <span style={{ fontSize: '0.8rem', color: '#cbd5e1' }}>Contains "Customer Name", "completed", "Data category"</span>
                                <input type="file" accept=".csv" onChange={handleProductionProgressUpload} style={{ marginTop: '0.4rem', color: 'white' }} />
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
                            <input
                                id="csv-upload"
                                type="file"
                                accept=".csv"
                                onChange={handleFileChange}
                                style={{ color: 'white' }}
                            />

                            {/* Submit / Confirm Button Group */}
                            <div style={{
                                display: 'flex',
                                backgroundColor: '#4b5563',
                                borderRadius: '9999px',
                                padding: '4px',
                                border: '1px solid #374151'
                            }}>
                                <button
                                    onClick={activeTab === 'region' ? handleRegionUpload : validateAndUpload}
                                    style={{
                                        backgroundColor: '#3b82f6', // Blue
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '9999px',
                                        padding: '0.6rem 2.5rem',
                                        fontWeight: '700',
                                        fontSize: '1.2rem',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    Submit
                                </button>
                                <div style={{
                                    padding: '0.6rem 2rem',
                                    color: '#9ca3af',
                                    fontWeight: '700',
                                    fontSize: '1.2rem',
                                    display: 'flex',
                                    alignItems: 'center'
                                }}>
                                    confirm
                                </div>
                            </div>
                            
                            {/* CRM Report Link Button */}
                            <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'center', width: '100%' }}>
                                <a 
                                    href="https://crm.zoho.com/crm/org1644714/tab/Reports/38660000432721500" 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    style={{
                                        backgroundColor: '#3b82f6',
                                        color: 'white',
                                        padding: '0.6rem 2.5rem',
                                        borderRadius: '9999px',
                                        fontWeight: '700',
                                        fontSize: '1.2rem',
                                        textDecoration: 'none',
                                        display: 'inline-block',
                                        textAlign: 'center',
                                        transition: 'all 0.2s',
                                        border: 'none',
                                        cursor: 'pointer'
                                    }}
                                >
                                    GET CRM REPORT FROM HERE
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
                            backgroundColor: 'rgba(255,255,255,0.1)',
                            borderRadius: '8px'
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
                                    color: '#a5b4fc',
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
                            fontSize: '1rem',
                            color: statusMsg.includes('Error') ? '#ef4444' : '#10b981',
                            textAlign: 'center',
                            fontWeight: '500'
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
                                        <th style={{ padding: '1rem', color: 'white', fontWeight: '700' }}>Opportunities Owner</th>
                                        <th style={{ padding: '1rem', color: 'white', fontWeight: '700' }}>Region</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {regionMappings.map(mapping => (
                                        <tr key={mapping.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
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
                                        <th style={{ padding: '1rem', color: 'white', fontWeight: '700' }}>Week</th>
                                        <th style={{ padding: '1rem', color: 'white', fontWeight: '700' }}>Date</th>
                                        <th style={{ padding: '1rem', color: 'white', fontWeight: '700' }}>File name</th>
                                        <th style={{ padding: '1rem', color: 'white', fontWeight: '700' }}>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {logs.map(log => (
                                        <tr key={log.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                                            <td style={{ padding: '1rem', color: '#1f2937', fontWeight: '600' }}>Week {log.week}</td>
                                            <td style={{ padding: '1rem', color: '#1f2937', fontWeight: '600' }}>{log.file_date}</td>
                                            <td style={{ padding: '1rem', color: '#1f2937', fontWeight: '600' }}>{log.file_name}</td>
                                            <td style={{ padding: '1rem' }}>
                                                <button
                                                    onClick={() => handleDelete(log.id, log.week)}
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
