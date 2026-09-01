import { useState, useEffect } from 'react';
import {
    Cpu, ShieldAlert, CheckCircle2, AlertCircle, RefreshCw, Sparkles,
    ThumbsUp, ThumbsDown, MessageSquare, Eye, EyeOff, Search,
    Clock, Database
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { AiStarIcon } from './AiChatbot';

interface ModelOption {
    id: string;
    name: string;
    category?: string;
}

interface ChatLogItem {
    id: string;
    session_id: string;
    user_email: string;
    user_name: string;
    user_prompt: string;
    ai_response: string;
    tools_called: string[];
    tools_executed_details?: Array<{ step: number; tool: string; args: any; result_summary?: string }>;
    latency_ms?: number;
    latency_formatted?: string;
    model_used?: string;
    week?: number;
    region?: string;
    slide_id?: string;
    feedback_rating?: 'useful' | 'not_useful' | null;
    feedback_comment?: string;
    timestamp: string;
}

export function AiAgentConfig() {
    const { token } = useAuth();

    // Config state
    const [apiKey, setApiKey] = useState('');
    const [showApiKey, setShowApiKey] = useState(false);
    const [hasExistingKey, setHasExistingKey] = useState(false);
    const [maskedKey, setMaskedKey] = useState('');
    const [modelName, setModelName] = useState('gemini-3.6-flash');
    const [customModelInput, setCustomModelInput] = useState('');
    const [isCustomModel, setIsCustomModel] = useState(false);
    const [agentName, setAgentName] = useState('e-con BD Analyst');
    const [systemPrompt, setSystemPrompt] = useState('');
    const [visibilityMode, setVisibilityMode] = useState('permitted');
    const [availableModels, setAvailableModels] = useState<ModelOption[]>([]);
    const [isRefreshingModels, setIsRefreshingModels] = useState(false);
    const [lastUpdated, setLastUpdated] = useState<string | null>(null);
    const [updatedBy, setUpdatedBy] = useState<string | null>(null);

    // Testing state
    const [isTesting, setIsTesting] = useState(false);
    const [testResult, setTestResult] = useState<{ status: 'success' | 'error'; message: string; latency?: number } | null>(null);

    // Save state
    const [isSaving, setIsSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

    // Logs state
    const [logs, setLogs] = useState<ChatLogItem[]>([]);
    const [stats, setStats] = useState({ total_queries: 0, useful_count: 0, not_useful_count: 0, satisfaction_rate: '0%' });
    const [logsLoading, setLogsLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [ratingFilter, setRatingFilter] = useState<string>('all');
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

    const fetchConfig = async () => {
        try {
            const res = await fetch('/api/admin/ai/config', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setHasExistingKey(data.has_api_key);
                setMaskedKey(data.api_key_masked || '');
                const mName = data.model_name || 'gemini-2.0-flash';
                setModelName(mName);
                const models: ModelOption[] = data.available_models || [];
                setAvailableModels(models);
                if (!models.some(m => m.id === mName)) {
                    setIsCustomModel(true);
                    setCustomModelInput(mName);
                }
                setAgentName(data.agent_name || 'e-con BD Analyst');
                setSystemPrompt(data.system_prompt || '');
                setVisibilityMode(data.visibility_mode || 'permitted');
                setLastUpdated(data.updated_at || null);
                setUpdatedBy(data.updated_by || null);
            }
        } catch (err) {
            console.error('Failed to fetch AI config:', err);
        }
    };

    const handleRefreshLiveModels = async () => {
        setIsRefreshingModels(true);
        try {
            const res = await fetch('/api/admin/ai/models', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                if (data.models && data.models.length > 0) {
                    setAvailableModels(data.models);
                }
            }
        } catch (err) {
            console.error('Failed to refresh models:', err);
        } finally {
            setIsRefreshingModels(false);
        }
    };

    const fetchLogs = async () => {
        setLogsLoading(true);
        try {
            const params = new URLSearchParams({
                page: String(page),
                page_size: '15',
            });
            if (searchQuery) params.append('search', searchQuery);
            if (ratingFilter !== 'all') params.append('filter_rating', ratingFilter);

            const res = await fetch(`/api/admin/ai/logs?${params.toString()}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setLogs(data.logs || []);
                setStats(data.stats || { total_queries: 0, useful_count: 0, not_useful_count: 0, satisfaction_rate: '0%' });
                setTotalPages(Math.ceil((data.total || 1) / 15));
            }
        } catch (err) {
            console.error('Failed to fetch AI logs:', err);
        } finally {
            setLogsLoading(false);
        }
    };

    useEffect(() => {
        fetchConfig();
    }, [token]);

    useEffect(() => {
        fetchLogs();
    }, [token, page, ratingFilter]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        setSaveStatus(null);

        const effectiveModel = isCustomModel ? customModelInput.trim() : modelName;
        if (!effectiveModel) {
            setSaveStatus({ type: 'error', message: 'Please select or enter a valid model identifier' });
            setIsSaving(false);
            return;
        }

        try {
            const res = await fetch('/api/admin/ai/config', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    api_key: apiKey.trim() || undefined,
                    model_name: effectiveModel,
                    agent_name: agentName,
                    system_prompt: systemPrompt,
                    visibility_mode: visibilityMode
                })
            });

            const data = await res.json();
            if (res.ok) {
                setSaveStatus({ type: 'success', message: 'AI Agent settings saved successfully!' });
                setApiKey('');
                fetchConfig();
            } else {
                setSaveStatus({ type: 'error', message: data.detail || 'Failed to save settings' });
            }
        } catch (err: any) {
            setSaveStatus({ type: 'error', message: err.message || 'Network error' });
        } finally {
            setIsSaving(false);
        }
    };

    const handleTestConnection = async () => {
        setIsTesting(true);
        setTestResult(null);

        const effectiveModel = isCustomModel ? customModelInput.trim() : modelName;

        try {
            const res = await fetch('/api/admin/ai/test-connection', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    api_key: apiKey.trim() || undefined,
                    model_name: effectiveModel
                })
            });

            const data = await res.json();
            if (res.ok) {
                setTestResult({
                    status: 'success',
                    message: `Connection successful! (${data.latency_ms}ms) Model replied: "${data.model_response}"`,
                    latency: data.latency_ms
                });
            } else {
                setTestResult({
                    status: 'error',
                    message: data.detail || 'Test connection failed'
                });
            }
        } catch (err: any) {
            setTestResult({
                status: 'error',
                message: err.message || 'Connection timeout or network error'
            });
        } finally {
            setIsTesting(false);
        }
    };

    return (
        <div style={{ maxWidth: '1280px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
            {/* Header Banner */}
            <div style={{
                backgroundColor: '#ffffff',
                borderRadius: '16px',
                padding: '2rem 2.5rem',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)',
                border: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '1.5rem'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                    <div style={{
                        width: '60px',
                        height: '60px',
                        borderRadius: '16px',
                        backgroundColor: '#eef3ff',
                        border: '1.5px solid #cbd5e1',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 8px 16px rgba(58, 84, 156, 0.15)'
                    }}>
                        <AiStarIcon size={34} color="#3a549c" />
                    </div>
                    <div>
                        <h2 style={{ margin: 0, fontSize: '1.85rem', fontWeight: '800', color: '#0f172a', letterSpacing: '-0.02em' }}>
                            AI Agent & LLM Management
                        </h2>
                        <p style={{ margin: '0.35rem 0 0 0', color: '#64748b', fontSize: '0.95rem' }}>
                            Configure API connections, model selection, live test status, and review user conversation logs.
                        </p>
                    </div>
                </div>

                {lastUpdated && (
                    <div style={{
                        padding: '0.6rem 1rem',
                        backgroundColor: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: '10px',
                        fontSize: '0.82rem',
                        color: '#475569',
                        textAlign: 'right'
                    }}>
                        <div><strong>Last Updated:</strong> {new Date(lastUpdated).toLocaleString()}</div>
                        {updatedBy && <div style={{ color: '#64748b' }}>by {updatedBy}</div>}
                    </div>
                )}
            </div>

            {/* Main Configuration Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)', gap: '2rem' }}>
                {/* Left Card: Core Settings */}
                <div style={{
                    backgroundColor: '#ffffff',
                    borderRadius: '16px',
                    padding: '2rem',
                    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)',
                    border: '1px solid #e2e8f0'
                }}>
                    <h3 style={{ margin: '0 0 1.5rem 0', fontSize: '1.3rem', fontWeight: '800', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <Cpu size={22} color="#3a549c" />
                        API & Model Configuration
                    </h3>

                    <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1.4rem' }}>
                        {/* API Key */}
                        <div>
                            <label style={{ display: 'block', fontWeight: '700', fontSize: '0.9rem', color: '#334155', marginBottom: '0.4rem' }}>
                                Google Gemini API Key
                            </label>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <div style={{ position: 'relative', flex: 1 }}>
                                    <input
                                        type={showApiKey ? 'text' : 'password'}
                                        value={apiKey}
                                        onChange={(e) => setApiKey(e.target.value)}
                                        placeholder={hasExistingKey ? `Configured: ${maskedKey}` : 'Enter your Google Gemini API Key...'}
                                        style={{
                                            width: '100%',
                                            padding: '0.75rem 2.8rem 0.75rem 1rem',
                                            borderRadius: '8px',
                                            border: '1.5px solid #cbd5e1',
                                            fontSize: '0.92rem',
                                            fontFamily: 'monospace',
                                            outline: 'none',
                                            backgroundColor: '#f8fafc',
                                            boxSizing: 'border-box'
                                        }}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowApiKey(!showApiKey)}
                                        style={{
                                            position: 'absolute',
                                            right: '10px',
                                            top: '50%',
                                            transform: 'translateY(-50%)',
                                            background: 'none',
                                            border: 'none',
                                            color: '#64748b',
                                            cursor: 'pointer',
                                            padding: '4px'
                                        }}
                                    >
                                        {showApiKey ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </div>
                            <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.35rem' }}>
                                {hasExistingKey ? (
                                    <span style={{ color: '#16a34a', fontWeight: '600' }}>✓ Active API Key is configured in database. Enter new key only to replace.</span>
                                ) : (
                                    <span style={{ color: '#dc2626', fontWeight: '600' }}>⚠ No API Key configured. Get one from Google AI Studio.</span>
                                )}
                            </div>
                        </div>

                        {/* Model Selector */}
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                                <label style={{ fontWeight: '700', fontSize: '0.9rem', color: '#334155' }}>
                                    Select Google Gemini Model
                                </label>
                                <button
                                    type="button"
                                    onClick={handleRefreshLiveModels}
                                    disabled={isRefreshingModels}
                                    style={{
                                        background: 'none',
                                        border: 'none',
                                        color: '#3a549c',
                                        fontSize: '0.78rem',
                                        fontWeight: '700',
                                        cursor: isRefreshingModels ? 'not-allowed' : 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.3rem',
                                        padding: '2px 6px',
                                        borderRadius: '4px'
                                    }}
                                >
                                    <RefreshCw className={isRefreshingModels ? 'animate-spin' : ''} size={13} />
                                    {isRefreshingModels ? 'Checking API...' : 'Fetch Live Models from Google'}
                                </button>
                            </div>

                            <select
                                value={isCustomModel ? '__custom__' : modelName}
                                onChange={(e) => {
                                    if (e.target.value === '__custom__') {
                                        setIsCustomModel(true);
                                    } else {
                                        setIsCustomModel(false);
                                        setModelName(e.target.value);
                                    }
                                }}
                                style={{
                                    width: '100%',
                                    padding: '0.75rem 1rem',
                                    borderRadius: '8px',
                                    border: '1.5px solid #cbd5e1',
                                    fontSize: '0.92rem',
                                    backgroundColor: '#ffffff',
                                    fontWeight: '600',
                                    color: '#0f172a',
                                    outline: 'none',
                                    boxSizing: 'border-box'
                                }}
                            >
                                {Array.from(new Set(availableModels.map(m => m.category || 'All Models'))).map(cat => (
                                    <optgroup key={cat} label={`── ${cat} ──`}>
                                        {availableModels.filter(m => (m.category || 'All Models') === cat).map(m => (
                                            <option key={m.id} value={m.id}>
                                                {m.name}
                                            </option>
                                        ))}
                                    </optgroup>
                                ))}
                                <optgroup label="── Custom & Future Releases ──">
                                    <option value="__custom__">➕ Custom Model Name / Identifier (Type manually)...</option>
                                </optgroup>
                            </select>

                            {isCustomModel && (
                                <div style={{ marginTop: '0.6rem' }}>
                                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', color: '#3a549c', marginBottom: '0.25rem' }}>
                                        Enter Exact Gemini Model Identifier:
                                    </label>
                                    <input
                                        type="text"
                                        value={customModelInput}
                                        onChange={(e) => setCustomModelInput(e.target.value)}
                                        placeholder="e.g. gemini-3.5-flash, gemini-2.5-pro, gemini-3.0-flash"
                                        style={{
                                            width: '100%',
                                            padding: '0.65rem 0.9rem',
                                            borderRadius: '8px',
                                            border: '1.5px solid #3a549c',
                                            fontSize: '0.88rem',
                                            fontFamily: 'monospace',
                                            backgroundColor: '#f8fafc',
                                            outline: 'none',
                                            boxSizing: 'border-box'
                                        }}
                                    />
                                    <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>
                                        Enter any valid Gemini model name released by Google.
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Agent Title */}
                        <div>
                            <label style={{ display: 'block', fontWeight: '700', fontSize: '0.9rem', color: '#334155', marginBottom: '0.4rem' }}>
                                Agent Name / Persona Title
                            </label>
                            <input
                                type="text"
                                value={agentName}
                                onChange={(e) => setAgentName(e.target.value)}
                                placeholder="e.g. e-con BD Analyst"
                                style={{
                                    width: '100%',
                                    padding: '0.75rem 1rem',
                                    borderRadius: '8px',
                                    border: '1.5px solid #cbd5e1',
                                    fontSize: '0.92rem',
                                    backgroundColor: '#ffffff',
                                    color: '#0f172a',
                                    outline: 'none',
                                    boxSizing: 'border-box'
                                }}
                            />
                        </div>

                        {/* Visibility & Testing Mode */}
                        <div>
                            <label style={{ display: 'block', fontWeight: '700', fontSize: '0.9rem', color: '#334155', marginBottom: '0.4rem' }}>
                                Chat Access & Testing Mode
                            </label>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                                {[
                                    { id: 'admin_only', label: '🔒 Admin Only (Testing)', desc: 'Only Admin role can view & test the chat' },
                                    { id: 'permitted', label: '👥 Permitted Users', desc: 'Users with AI Agent access or Admin' },
                                    { id: 'all', label: '🌐 All Users', desc: 'Open to all authenticated viewers' },
                                    { id: 'disabled', label: '⛔ Disabled', desc: 'Chat completely turned off' }
                                ].map(opt => (
                                    <div
                                        key={opt.id}
                                        onClick={() => setVisibilityMode(opt.id)}
                                        style={{
                                            padding: '0.85rem',
                                            borderRadius: '10px',
                                            border: visibilityMode === opt.id ? '2px solid #3a549c' : '1px solid #cbd5e1',
                                            backgroundColor: visibilityMode === opt.id ? '#eef3ff' : '#ffffff',
                                            cursor: 'pointer',
                                            transition: 'all 0.15s ease'
                                        }}
                                    >
                                        <div style={{ fontWeight: '800', fontSize: '0.88rem', color: visibilityMode === opt.id ? '#3a549c' : '#1e293b' }}>
                                            {opt.label}
                                        </div>
                                        <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.2rem' }}>
                                            {opt.desc}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* System Prompt Customization */}
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                                <label style={{ fontWeight: '700', fontSize: '0.9rem', color: '#334155' }}>
                                    System Instructions & Domain Guardrails
                                </label>
                                <span style={{ fontSize: '0.75rem', color: '#3a9c6b', fontWeight: '700' }}>
                                    Live Database Grounding
                                </span>
                            </div>
                            <textarea
                                rows={5}
                                value={systemPrompt}
                                onChange={(e) => setSystemPrompt(e.target.value)}
                                placeholder="Custom system instructions for the LLM..."
                                style={{
                                    width: '100%',
                                    padding: '0.75rem 1rem',
                                    borderRadius: '8px',
                                    border: '1.5px solid #cbd5e1',
                                    fontSize: '0.85rem',
                                    fontFamily: 'monospace',
                                    backgroundColor: '#f8fafc',
                                    outline: 'none',
                                    resize: 'vertical',
                                    boxSizing: 'border-box'
                                }}
                            />
                        </div>

                        {/* Feedback & Save Actions */}
                        {saveStatus && (
                            <div style={{
                                padding: '0.85rem 1rem',
                                borderRadius: '8px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                backgroundColor: saveStatus.type === 'success' ? '#dcfce7' : '#fee2e2',
                                color: saveStatus.type === 'success' ? '#15803d' : '#b91c1c',
                                fontSize: '0.9rem',
                                fontWeight: '700'
                            }}>
                                {saveStatus.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                                {saveStatus.message}
                            </div>
                        )}

                        <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                            <button
                                type="submit"
                                disabled={isSaving}
                                style={{
                                    flex: 1,
                                    padding: '0.85rem 1.5rem',
                                    backgroundColor: '#3a549c',
                                    color: '#ffffff',
                                    border: 'none',
                                    borderRadius: '8px',
                                    fontWeight: '800',
                                    fontSize: '1rem',
                                    cursor: isSaving ? 'not-allowed' : 'pointer',
                                    boxShadow: '0 4px 12px rgba(58, 84, 156, 0.25)',
                                    transition: 'all 0.2s ease',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '0.5rem'
                                }}
                                onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#2e437c'}
                                onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#3a549c'}
                            >
                                {isSaving ? <RefreshCw className="animate-spin" size={20} /> : <CheckCircle2 size={20} />}
                                {isSaving ? 'Saving...' : 'Save AI Configuration'}
                            </button>
                        </div>
                    </form>
                </div>

                {/* Right Card: Connection Test & Security Guardrails */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    {/* Live Connectivity Test */}
                    <div style={{
                        backgroundColor: '#ffffff',
                        borderRadius: '16px',
                        padding: '1.75rem',
                        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)',
                        border: '1px solid #e2e8f0'
                    }}>
                        <h4 style={{ margin: '0 0 1rem 0', fontSize: '1.15rem', fontWeight: '800', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Sparkles size={20} color="#3b82f6" />
                            Live API Connectivity Test
                        </h4>
                        <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '0 0 1.25rem 0' }}>
                            Send an immediate ping to the Google Gemini API to test the active key, model responsiveness, and network latency.
                        </p>

                        <button
                            type="button"
                            onClick={handleTestConnection}
                            disabled={isTesting}
                            style={{
                                width: '100%',
                                padding: '0.8rem',
                                backgroundColor: '#0284c7',
                                color: '#ffffff',
                                border: 'none',
                                borderRadius: '8px',
                                fontWeight: '700',
                                fontSize: '0.92rem',
                                cursor: isTesting ? 'not-allowed' : 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '0.5rem'
                            }}
                        >
                            {isTesting ? <RefreshCw className="animate-spin" size={18} /> : <Sparkles size={18} />}
                            {isTesting ? 'Pinging Gemini API...' : 'Test Connection Now'}
                        </button>

                        {testResult && (
                            <div style={{
                                marginTop: '1rem',
                                padding: '0.85rem',
                                borderRadius: '8px',
                                backgroundColor: testResult.status === 'success' ? '#f0fdf4' : '#fef2f2',
                                border: testResult.status === 'success' ? '1px solid #bbf7d0' : '1px solid #fecaca',
                                color: testResult.status === 'success' ? '#15803d' : '#dc2626',
                                fontSize: '0.85rem',
                                fontWeight: '600'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.2rem' }}>
                                    {testResult.status === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                                    <strong>{testResult.status === 'success' ? 'Ping Successful' : 'Ping Failed'}</strong>
                                </div>
                                <div>{testResult.message}</div>
                            </div>
                        )}
                    </div>

                    {/* Grounded Read-Only Database Safeguards */}
                    <div style={{
                        backgroundColor: '#ffffff',
                        borderRadius: '16px',
                        padding: '1.75rem',
                        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)',
                        border: '1px solid #e2e8f0'
                    }}>
                        <h4 style={{ margin: '0 0 0.8rem 0', fontSize: '1.15rem', fontWeight: '800', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <ShieldAlert size={20} color="#10b981" />
                            Grounded Read-Only Safeguards
                        </h4>
                        <ul style={{ margin: 0, paddingLeft: '1.25rem', color: '#475569', fontSize: '0.85rem', lineHeight: '1.6' }}>
                            <li><strong>Strict Read-Only:</strong> AI agent cannot insert, mutate, or delete any record in tracker tables.</li>
                            <li><strong>Full-text Company Search:</strong> Automatically searches CRM pipelines, free-text manual notes, and Whale accounts for company/client queries.</li>
                            <li><strong>Strict Out-of-Scope Blocker:</strong> System prompt actively rejects general web trivia, politics, and unrelated prompts.</li>
                            <li><strong>Full Audit Trail:</strong> All prompts, answers, and user feedback are stored for performance review.</li>
                        </ul>
                    </div>
                </div>
            </div>

            {/* Conversation Audit Logs & Feedback Section */}
            <div style={{
                backgroundColor: '#ffffff',
                borderRadius: '16px',
                padding: '2rem 2.5rem',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)',
                border: '1px solid #e2e8f0'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
                    <div>
                        <h3 style={{ margin: 0, fontSize: '1.4rem', fontWeight: '800', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                            <MessageSquare size={24} color="#3a549c" />
                            User Questions & Feedback Audit Log
                        </h3>
                        <p style={{ margin: '0.25rem 0 0 0', color: '#64748b', fontSize: '0.88rem' }}>
                            Monitor what users are asking the AI Assistant, which data tools were executed, and user satisfaction ratings.
                        </p>
                    </div>

                    {/* Stats Badges */}
                    <div style={{ display: 'flex', gap: '1rem' }}>
                        <div style={{ padding: '0.5rem 1rem', backgroundColor: '#f1f5f9', borderRadius: '10px', textAlign: 'center' }}>
                            <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '700', textTransform: 'uppercase' }}>Total Queries</div>
                            <div style={{ fontSize: '1.25rem', fontWeight: '800', color: '#0f172a' }}>{stats.total_queries}</div>
                        </div>
                        <div style={{ padding: '0.5rem 1rem', backgroundColor: '#dcfce7', borderRadius: '10px', textAlign: 'center' }}>
                            <div style={{ fontSize: '0.75rem', color: '#15803d', fontWeight: '700', textTransform: 'uppercase' }}>Useful (👍)</div>
                            <div style={{ fontSize: '1.25rem', fontWeight: '800', color: '#16a34a' }}>{stats.useful_count}</div>
                        </div>
                        <div style={{ padding: '0.5rem 1rem', backgroundColor: '#fee2e2', borderRadius: '10px', textAlign: 'center' }}>
                            <div style={{ fontSize: '0.75rem', color: '#b91c1c', fontWeight: '700', textTransform: 'uppercase' }}>Not Useful (👎)</div>
                            <div style={{ fontSize: '1.25rem', fontWeight: '800', color: '#dc2626' }}>{stats.not_useful_count}</div>
                        </div>
                    </div>
                </div>

                {/* Filters */}
                <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
                    <div style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
                        <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && fetchLogs()}
                            placeholder="Search user query, email, or response..."
                            style={{
                                width: '100%',
                                padding: '0.65rem 1rem 0.65rem 2.4rem',
                                borderRadius: '8px',
                                border: '1px solid #cbd5e1',
                                fontSize: '0.88rem',
                                outline: 'none',
                                boxSizing: 'border-box'
                            }}
                        />
                    </div>

                    <select
                        value={ratingFilter}
                        onChange={(e) => setRatingFilter(e.target.value)}
                        style={{
                            padding: '0.65rem 1rem',
                            borderRadius: '8px',
                            border: '1px solid #cbd5e1',
                            fontSize: '0.88rem',
                            fontWeight: '600',
                            color: '#334155',
                            backgroundColor: '#ffffff'
                        }}
                    >
                        <option value="all">All Feedback Ratings</option>
                        <option value="useful">👍 Useful Only</option>
                        <option value="not_useful">👎 Not Useful Only</option>
                    </select>

                    <button
                        onClick={fetchLogs}
                        style={{
                            padding: '0.65rem 1.2rem',
                            backgroundColor: '#f1f5f9',
                            border: '1px solid #cbd5e1',
                            borderRadius: '8px',
                            fontWeight: '700',
                            fontSize: '0.88rem',
                            color: '#334155',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.4rem'
                        }}
                    >
                        <RefreshCw size={16} className={logsLoading ? 'animate-spin' : ''} />
                        Refresh
                    </button>
                </div>

                {/* Logs Table */}
                {logsLoading ? (
                    <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
                        <RefreshCw className="animate-spin" size={28} style={{ margin: '0 auto 0.5rem auto' }} />
                        <div>Loading conversation history...</div>
                    </div>
                ) : logs.length === 0 ? (
                    <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8', backgroundColor: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
                        <MessageSquare size={36} style={{ margin: '0 auto 0.5rem auto', opacity: 0.5 }} />
                        <div style={{ fontWeight: '700', fontSize: '1rem', color: '#64748b' }}>No AI Chat Logs Found</div>
                        <div style={{ fontSize: '0.85rem' }}>Questions asked by users in the Weekly Tracker will appear here automatically.</div>
                    </div>
                ) : (
                    <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '12px' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
                            <thead>
                                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1.5px solid #e2e8f0', color: '#475569', fontWeight: '800' }}>
                                    <th style={{ padding: '0.85rem 1rem' }}>User / Time</th>
                                    <th style={{ padding: '0.85rem 1rem' }}>Question Asked</th>
                                    <th style={{ padding: '0.85rem 1rem' }}>Tools Called</th>
                                    <th style={{ padding: '0.85rem 1rem' }}>Time Taken</th>
                                    <th style={{ padding: '0.85rem 1rem' }}>Feedback</th>
                                    <th style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {logs.map((log) => {
                                    const isExpanded = expandedLogId === log.id;
                                    return (
                                        <tr key={log.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                            <td style={{ padding: '0.85rem 1rem', verticalAlign: 'top', minWidth: '180px' }}>
                                                <div style={{ fontWeight: '700', color: '#0f172a' }}>{log.user_name || 'User'}</div>
                                                <div style={{ fontSize: '0.78rem', color: '#64748b' }}>{log.user_email}</div>
                                                <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.2rem' }}>
                                                    {new Date(log.timestamp).toLocaleString()}
                                                </div>
                                            </td>

                                            <td style={{ padding: '0.85rem 1rem', verticalAlign: 'top', maxWidth: '340px' }}>
                                                <div style={{ fontWeight: '700', color: '#1e293b' }}>
                                                    "{log.user_prompt}"
                                                </div>
                                                {isExpanded && (
                                                    <div style={{
                                                        marginTop: '0.85rem',
                                                        padding: '1rem',
                                                        backgroundColor: '#f8fafc',
                                                        borderRadius: '10px',
                                                        border: '1px solid #e2e8f0',
                                                        fontSize: '0.84rem',
                                                        color: '#334155',
                                                        display: 'flex',
                                                        flexDirection: 'column',
                                                        gap: '0.85rem'
                                                    }}>
                                                        {/* Executive AI Response */}
                                                        <div>
                                                            <div style={{ fontWeight: '800', color: '#1e293b', marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                                                <Sparkles size={14} color="#3a549c" /> AI Response:
                                                            </div>
                                                            <div style={{
                                                                backgroundColor: '#ffffff',
                                                                padding: '0.75rem 1rem',
                                                                borderRadius: '8px',
                                                                border: '1px solid #cbd5e1',
                                                                whiteSpace: 'pre-wrap',
                                                                lineHeight: '1.5',
                                                                maxHeight: '260px',
                                                                overflowY: 'auto'
                                                            }}>
                                                                {log.ai_response}
                                                            </div>
                                                        </div>

                                                        {/* Execution & Thought Trace */}
                                                        {log.tools_executed_details && log.tools_executed_details.length > 0 && (
                                                            <div>
                                                                <div style={{ fontWeight: '800', color: '#1e293b', marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                                                    <Database size={14} color="#2563eb" /> Execution & Query Trace:
                                                                </div>
                                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                                                    {log.tools_executed_details.map((tStep, sIdx) => (
                                                                        <div
                                                                            key={sIdx}
                                                                            style={{
                                                                                backgroundColor: '#ffffff',
                                                                                padding: '0.6rem 0.75rem',
                                                                                borderRadius: '6px',
                                                                                border: '1px solid #e2e8f0'
                                                                            }}
                                                                        >
                                                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                                                                                <span style={{ fontWeight: '800', fontSize: '0.78rem', color: '#0f172a' }}>
                                                                                    Step #{tStep.step || sIdx + 1}: <code style={{ backgroundColor: '#e2e8f0', padding: '0.1rem 0.35rem', borderRadius: '4px' }}>{tStep.tool}</code>
                                                                                </span>
                                                                            </div>

                                                                            {tStep.args && Object.keys(tStep.args).length > 0 && (
                                                                                <div style={{ marginTop: '0.25rem' }}>
                                                                                    <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: '700' }}>Query Arguments:</div>
                                                                                    <pre style={{
                                                                                        margin: '0.15rem 0 0 0',
                                                                                        padding: '0.4rem 0.55rem',
                                                                                        backgroundColor: '#0f172a',
                                                                                        color: '#e2e8f0',
                                                                                        borderRadius: '4px',
                                                                                        fontSize: '0.72rem',
                                                                                        fontFamily: 'monospace',
                                                                                        overflowX: 'auto'
                                                                                    }}>
                                                                                        {JSON.stringify(tStep.args, null, 2)}
                                                                                    </pre>
                                                                                </div>
                                                                            )}

                                                                            {tStep.result_summary && (
                                                                                <div style={{ marginTop: '0.35rem' }}>
                                                                                    <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: '700' }}>Returned Data Preview:</div>
                                                                                    <div style={{
                                                                                        fontSize: '0.72rem',
                                                                                        fontFamily: 'monospace',
                                                                                        color: '#475569',
                                                                                        backgroundColor: '#f1f5f9',
                                                                                        padding: '0.35rem 0.5rem',
                                                                                        borderRadius: '4px',
                                                                                        overflowX: 'auto'
                                                                                    }}>
                                                                                        {tStep.result_summary}
                                                                                    </div>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* Metadata strip */}
                                                        <div style={{
                                                            display: 'flex',
                                                            flexWrap: 'wrap',
                                                            gap: '0.75rem',
                                                            fontSize: '0.74rem',
                                                            color: '#64748b',
                                                            paddingTop: '0.35rem',
                                                            borderTop: '1px solid #e2e8f0'
                                                        }}>
                                                            <span><strong>Model:</strong> {log.model_used || 'gemini-3.6-flash'}</span>
                                                            <span><strong>Latency:</strong> {log.latency_formatted || (log.latency_ms ? `${(log.latency_ms / 1000).toFixed(2)}s` : 'N/A')}</span>
                                                            <span><strong>Week:</strong> {log.week ?? 'N/A'}</span>
                                                            <span><strong>Region:</strong> {log.region || 'Overall'}</span>
                                                            <span><strong>Session:</strong> <code>{log.session_id.substring(0, 8)}...</code></span>
                                                        </div>
                                                    </div>
                                                )}
                                            </td>

                                            <td style={{ padding: '0.85rem 1rem', verticalAlign: 'top' }}>
                                                {log.tools_called && log.tools_called.length > 0 ? (
                                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                                                        {log.tools_called.map((tool, idx) => (
                                                            <span
                                                                key={idx}
                                                                style={{
                                                                    backgroundColor: '#eff6ff',
                                                                    color: '#2563eb',
                                                                    fontSize: '0.72rem',
                                                                    fontWeight: '700',
                                                                    padding: '0.15rem 0.5rem',
                                                                    borderRadius: '6px',
                                                                    fontFamily: 'monospace'
                                                                }}
                                                            >
                                                                {tool}
                                                            </span>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>None</span>
                                                )}
                                            </td>

                                            {/* Time Taken / Latency Column */}
                                            <td style={{ padding: '0.85rem 1rem', verticalAlign: 'top', whiteSpace: 'nowrap' }}>
                                                <span style={{
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '0.25rem',
                                                    fontWeight: '700',
                                                    color: '#0f766e',
                                                    backgroundColor: '#f0fdfa',
                                                    padding: '0.2rem 0.55rem',
                                                    borderRadius: '6px',
                                                    fontSize: '0.76rem',
                                                    border: '1px solid #ccfbf1'
                                                }}>
                                                    <Clock size={12} /> {log.latency_formatted || (log.latency_ms ? `${(log.latency_ms / 1000).toFixed(2)}s` : '< 1s')}
                                                </span>
                                            </td>

                                            <td style={{ padding: '0.85rem 1rem', verticalAlign: 'top' }}>
                                                {log.feedback_rating === 'useful' ? (
                                                    <span style={{
                                                        backgroundColor: '#dcfce7',
                                                        color: '#15803d',
                                                        fontWeight: '800',
                                                        fontSize: '0.75rem',
                                                        padding: '0.2rem 0.6rem',
                                                        borderRadius: '9999px',
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '0.25rem'
                                                    }}>
                                                        <ThumbsUp size={12} /> Useful
                                                    </span>
                                                ) : log.feedback_rating === 'not_useful' ? (
                                                    <span style={{
                                                        backgroundColor: '#fee2e2',
                                                        color: '#b91c1c',
                                                        fontWeight: '800',
                                                        fontSize: '0.75rem',
                                                        padding: '0.2rem 0.6rem',
                                                        borderRadius: '9999px',
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '0.25rem'
                                                    }}>
                                                        <ThumbsDown size={12} /> Not Useful
                                                    </span>
                                                ) : (
                                                    <span style={{ color: '#94a3b8', fontSize: '0.78rem' }}>No Rating</span>
                                                )}
                                            </td>

                                            <td style={{ padding: '0.85rem 1rem', verticalAlign: 'top', textAlign: 'right' }}>
                                                <button
                                                    onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                                                    style={{
                                                        backgroundColor: isExpanded ? '#f1f5f9' : 'transparent',
                                                        border: '1px solid #cbd5e1',
                                                        padding: '0.35rem 0.75rem',
                                                        borderRadius: '6px',
                                                        fontSize: '0.78rem',
                                                        fontWeight: '700',
                                                        color: '#475569',
                                                        cursor: 'pointer'
                                                    }}
                                                >
                                                    {isExpanded ? 'Hide Trace' : 'View Answer & Trace'}
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Pagination */}
                {totalPages > 1 && (
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.25rem' }}>
                        <button
                            disabled={page <= 1}
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            style={{
                                padding: '0.4rem 0.8rem',
                                borderRadius: '6px',
                                border: '1px solid #cbd5e1',
                                backgroundColor: '#ffffff',
                                cursor: page <= 1 ? 'not-allowed' : 'pointer',
                                fontWeight: '700',
                                fontSize: '0.82rem',
                                opacity: page <= 1 ? 0.5 : 1
                            }}
                        >
                            Previous
                        </button>
                        <span style={{ padding: '0.4rem 0.8rem', fontSize: '0.82rem', fontWeight: '700', color: '#64748b' }}>
                            Page {page} of {totalPages}
                        </span>
                        <button
                            disabled={page >= totalPages}
                            onClick={() => setPage(p => p + 1)}
                            style={{
                                padding: '0.4rem 0.8rem',
                                borderRadius: '6px',
                                border: '1px solid #cbd5e1',
                                backgroundColor: '#ffffff',
                                cursor: page >= totalPages ? 'not-allowed' : 'pointer',
                                fontWeight: '700',
                                fontSize: '0.82rem',
                                opacity: page >= totalPages ? 0.5 : 1
                            }}
                        >
                            Next
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
