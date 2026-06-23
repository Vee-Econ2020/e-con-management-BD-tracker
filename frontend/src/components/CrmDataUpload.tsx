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
    const [activeTab, setActiveTab] = useState<'weekly' | 'revenue' | 'region' | 'gross_margin' | 'services_trend'>('weekly');
    const [file, setFile] = useState<File | null>(null);
    const [timelineFile, setTimelineFile] = useState<File | null>(null);
    const [oppFile, setOppFile] = useState<File | null>(null);
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
    } | null>(null);




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


    useEffect(() => {
        if (activeTab === 'region') {
            fetchRegionMappings();
        } else {
            fetchLogs();
        }
    }, [activeTab]);

    const getUploadPrefix = (): string => {
        switch (activeTab) {
            case 'weekly': return 'weekly-tracker';
            case 'revenue': return 'revenue-tracker';
            case 'gross_margin': return 'Gross-margin';
            case 'services_trend': return 'services-trend';
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

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setFile(e.target.files[0]);
            setStatusMsg('');
        }
    };

    const handleServicesTrendFileChange = (kind: 'timeline' | 'opp', fileList: FileList | null) => {
        const selectedFile = fileList?.[0] || null;
        if (kind === 'timeline') setTimelineFile(selectedFile);
        if (kind === 'opp') setOppFile(selectedFile);
        setStatusMsg('');
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
                    progressPercent: progress.progress_percent
                });

                // Check if completed or error
                if (progress.status === 'completed') {
                    clearInterval(pollInterval);
                    setStatusMsg(progress.message || `Success! Week ${weekNum} processed.`);
                    setUploadProgress(null);
                    setFile(null);
                    setTimelineFile(null);
                    setOppFile(null);
                    fetchLogs();
                    const fileInput = document.getElementById('csv-upload') as HTMLInputElement;
                    if (fileInput) fileInput.value = '';
                    const timelineInput = document.getElementById('services-timeline-upload') as HTMLInputElement;
                    if (timelineInput) timelineInput.value = '';
                    const oppInput = document.getElementById('services-opp-upload') as HTMLInputElement;
                    if (oppInput) oppInput.value = '';
                } else if (progress.status === 'error') {
                    clearInterval(pollInterval);
                    setStatusMsg(`Error: ${progress.error || progress.message}`);
                    setUploadProgress(null);
                }
            } catch (error) {
                console.error('Polling error:', error);
                clearInterval(pollInterval);
                setUploadProgress(null);
            }
        }, 500);  // Poll every 500ms
    };

    const validateServicesTrendAndUpload = async () => {
        if (!timelineFile || !oppFile) {
            setStatusMsg('Please select both Services trend files.');
            return;
        }

        if (!timelineFile.name.toLowerCase().endsWith('.csv') || !oppFile.name.toLowerCase().endsWith('.csv')) {
            setStatusMsg('Invalid file type. Only .csv allowed.');
            return;
        }

        const timelineRegex = /^timeline_filtered_moneyball_FY2027_(\d{2}-\d{2}-(\d{4}|\d{2}))\.csv$/i;
        const oppRegex = /^closed_won_opportunities_moneyball_(\d{2}-\d{2}-(\d{4}|\d{2}))\.csv$/i;
        const timelineMatch = timelineFile.name.match(timelineRegex);
        const oppMatch = oppFile.name.match(oppRegex);

        if (!timelineMatch) {
            setStatusMsg('Invalid timeline filename. Expected: timeline_filtered_moneyball_FY2027_DD-MM-YYYY.csv');
            return;
        }
        if (!oppMatch) {
            setStatusMsg('Invalid opportunity filename. Expected: closed_won_opportunities_moneyball_DD-MM-YYYY.csv');
            return;
        }
        if (timelineMatch[1] !== oppMatch[1]) {
            setStatusMsg('Both Services trend files must use the same date in the filename.');
            return;
        }

        const dateStr = timelineMatch[1];
        const [dayRaw, monthRaw, yearRaw] = dateStr.split('-').map(Number);
        const year = yearRaw < 100 ? yearRaw + 2000 : yearRaw;
        const dateObj = new Date(year, monthRaw - 1, dayRaw);
        if (isNaN(dateObj.getTime())) {
            setStatusMsg('Invalid date in filename.');
            return;
        }

        const weekNum = getSimpleWeekNumber(dateObj);
        if (!window.confirm(`Process Services trend files for Week ${weekNum}?`)) return;

        try {
            const formData = new FormData();
            formData.append('week', weekNum.toString());
            formData.append('file_date', dateStr);
            formData.append('timeline_file_name', timelineFile.name);
            formData.append('opp_file_name', oppFile.name);
            formData.append('timeline_file', timelineFile);
            formData.append('opp_file', oppFile);

            setUploadProgress({
                isUploading: true,
                step: 0,
                totalSteps: 6,
                stepName: 'Starting',
                message: 'Initiating Services trend upload...',
                progressPercent: 0
            });
            setStatusMsg('');

            const res = await fetch('/api/admin/upload-services-trend', {
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
                    backgroundColor: '#6b7280', // Darker grey box
                    padding: '3rem',
                    borderRadius: '4px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '1rem', // Reduced gap to accommodate format line
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
                                    ? 'Services trend data upload'
                                    : `${activeTab} tracker data upload`}
                    </div>
                    <div style={{
                        fontSize: '0.9rem',
                        color: '#d1d5db',
                        marginBottom: '1rem'
                    }}>
                        {activeTab === 'region'
                            ? 'CSV must have two columns: "Opportunities Owner" and "Region"'
                            : activeTab === 'services_trend'
                                ? 'file name formats: "timeline_filtered_moneyball_FY2027_dd-mm-yyyy.csv" and "closed_won_opportunities_moneyball_dd-mm-yyyy.csv"'
                                : `file name format: "${getUploadPrefix()}_dd-mm-yyyy.csv"`
                        }
                    </div>

                    {activeTab === 'services_trend' ? (
                        <div style={{ display: 'grid', gap: '0.75rem', width: '100%', maxWidth: '680px' }}>
                            <label style={{ color: 'white', fontWeight: 700, display: 'grid', gap: '0.35rem' }}>
                                Timeline CSV
                                <input
                                    id="services-timeline-upload"
                                    type="file"
                                    accept=".csv"
                                    onChange={(e) => handleServicesTrendFileChange('timeline', e.target.files)}
                                    style={{ color: 'white' }}
                                />
                            </label>
                            <label style={{ color: 'white', fontWeight: 700, display: 'grid', gap: '0.35rem' }}>
                                Closed Won Opportunities CSV
                                <input
                                    id="services-opp-upload"
                                    type="file"
                                    accept=".csv"
                                    onChange={(e) => handleServicesTrendFileChange('opp', e.target.files)}
                                    style={{ color: 'white' }}
                                />
                            </label>
                        </div>
                    ) : (
                        <input
                            id="csv-upload"
                            type="file"
                            accept=".csv"
                            onChange={handleFileChange}
                            style={{ color: 'white' }}
                        />
                    )}

                    {/* Submit / Confirm Button Group */}
                    <div style={{
                        display: 'flex',
                        backgroundColor: '#4b5563',
                        borderRadius: '9999px',
                        padding: '4px',
                        border: '1px solid #374151'
                    }}>
                        <button
                            onClick={activeTab === 'region' ? handleRegionUpload : activeTab === 'services_trend' ? validateServicesTrendAndUpload : validateAndUpload}
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
                            <div style={{
                                marginTop: '0.5rem',
                                color: 'rgba(255,255,255,0.8)',
                                fontSize: '0.85rem',
                                fontStyle: 'italic'
                            }}>
                                {uploadProgress.message}
                            </div>
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
