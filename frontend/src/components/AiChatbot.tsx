import { useState, useEffect, useRef, useMemo } from 'react';
import {
    Send, X, Plus, MessageSquare,
    ThumbsUp, ThumbsDown, Copy, Check, RefreshCw,
    Database, User, ChevronDown, ChevronUp, Activity, Clock, ShieldAlert
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface AiChatbotProps {
    currentWeek?: number | null;
    activeRegion?: string;
    activeSlideId?: string;
    fy?: string;
}

interface MessageItem {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    tools_called?: Array<{ tool: string; args: any; step?: number; result_summary?: string }>;
    latency_ms?: number;
    latency_formatted?: string;
    feedback_rating?: 'useful' | 'not_useful' | null;
    timestamp: string;
}

interface SessionItem {
    session_id: string;
    title: string;
    created_at: string;
    updated_at: string;
    message_count: number;
}

// ─── TOOL EXECUTION VIEWER COMPONENT (Expandable details of what AI executed) ───
function ToolExecutionViewer({ tools, latency }: { tools: Array<{ tool: string; args: any; step?: number; result_summary?: string }>; latency?: string }) {
    const [isExpanded, setIsExpanded] = useState(false);

    if (!tools || tools.length === 0) return null;

    const toolLabels: Record<string, string> = {
        search_company_or_deal: 'Company & Deal Search',
        get_dashboard_summary: 'Dashboard Executive KPIs',
        run_mongo_aggregation: 'Dynamic MongoDB Aggregation',
        execute_pandas_analytics: 'Python / Pandas Analytics',
        get_slide_data: 'Slide Computed Data',
        search_user_inputs: 'Manual Slide Notes Search',
        search_whale_accounts: 'Whale Accounts DB',
        search_pipeline_data: 'CRM Pipeline Search',
        get_target_settings: 'Target Settings',
        get_order_backlogs: 'Order Backlogs',
        get_services_snapshots: 'Services Snapshots',
        get_invoicing_data: 'Invoicing DB'
    };

    return (
        <div style={{
            marginBottom: '0.85rem',
            borderRadius: '10px',
            border: '1px solid #e2e8f0',
            backgroundColor: '#ffffff',
            overflow: 'hidden',
            fontSize: '0.82rem'
        }}>
            {/* Header bar with toggle */}
            <div
                onClick={() => setIsExpanded(!isExpanded)}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.5rem 0.75rem',
                    backgroundColor: '#f8fafc',
                    cursor: 'pointer',
                    userSelect: 'none',
                    transition: 'background-color 0.15s ease'
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                    <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.3rem',
                        color: '#2563eb',
                        fontWeight: '700',
                        fontSize: '0.78rem'
                    }}>
                        <Database size={13} /> {tools.length === 1 ? '1 Tool Executed' : `${tools.length} Tools Executed`}
                    </span>

                    {latency && (
                        <>
                            <span style={{ color: '#cbd5e1' }}>•</span>
                            <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.2rem',
                                color: '#0f766e',
                                backgroundColor: '#f0fdfa',
                                border: '1px solid #ccfbf1',
                                fontSize: '0.7rem',
                                fontWeight: '700',
                                padding: '0.1rem 0.45rem',
                                borderRadius: '4px'
                            }}>
                                <Clock size={10} /> {latency}
                            </span>
                        </>
                    )}

                    <span style={{ color: '#cbd5e1' }}>•</span>
                    <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                        {tools.map((t, idx) => (
                            <span
                                key={idx}
                                style={{
                                    backgroundColor: '#f0fdf4',
                                    color: '#166534',
                                    border: '1px solid #bbf7d0',
                                    fontSize: '0.7rem',
                                    fontWeight: '700',
                                    padding: '0.1rem 0.45rem',
                                    borderRadius: '4px',
                                    fontFamily: 'monospace'
                                }}
                            >
                                {t.tool}
                            </span>
                        ))}
                    </div>
                </div>

                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                        color: '#475569',
                        fontSize: '0.75rem',
                        fontWeight: '600'
                    }}
                >
                    {isExpanded ? (
                        <>Hide details <ChevronUp size={14} /></>
                    ) : (
                        <>View what happened <ChevronDown size={14} /></>
                    )}
                </div>
            </div>

            {/* Expanded Tool Details */}
            {isExpanded && (
                <div style={{
                    padding: '0.75rem',
                    borderTop: '1px solid #e2e8f0',
                    backgroundColor: '#ffffff',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.65rem'
                }}>
                    {tools.map((t, idx) => {
                        const label = toolLabels[t.tool] || t.tool;
                        return (
                            <div
                                key={idx}
                                style={{
                                    borderRadius: '8px',
                                    border: '1px solid #e2e8f0',
                                    backgroundColor: '#f8fafc',
                                    padding: '0.6rem 0.75rem'
                                }}
                            >
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    marginBottom: '0.35rem'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                        <span style={{
                                            fontWeight: '800',
                                            color: '#1e293b',
                                            fontSize: '0.8rem'
                                        }}>
                                            #{idx + 1} {label}
                                        </span>
                                        <code style={{
                                            fontSize: '0.72rem',
                                            color: '#64748b',
                                            backgroundColor: '#e2e8f0',
                                            padding: '0.1rem 0.35rem',
                                            borderRadius: '4px'
                                        }}>
                                            {t.tool}
                                        </code>
                                    </div>
                                </div>

                                {t.args && Object.keys(t.args).length > 0 ? (
                                    <pre style={{
                                        margin: 0,
                                        padding: '0.5rem 0.65rem',
                                        backgroundColor: '#0f172a',
                                        color: '#e2e8f0',
                                        borderRadius: '6px',
                                        fontSize: '0.74rem',
                                        fontFamily: 'monospace',
                                        overflowX: 'auto',
                                        lineHeight: '1.4'
                                    }}>
                                        {JSON.stringify(t.args, null, 2)}
                                    </pre>
                                ) : (
                                    <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontStyle: 'italic' }}>
                                        Executed with active dashboard context
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

// ─── AI STAR ICON COMPONENT (Matching User's Specified AI Star Representation) ───
export function AiStarIcon({ size = 24, color = "#3a549c", className = "" }: { size?: number; color?: string; className?: string }) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke={color}
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
            style={{ display: 'inline-block', verticalAlign: 'middle' }}
        >
            {/* 4-pointed curved star */}
            <path d="M12 2C12 7.2 16.2 11.5 21.5 12C16.2 12.5 12 16.8 12 22C12 16.8 7.8 12.5 2.5 12C7.8 11.5 12 7.2 12 2Z" fill={color} fillOpacity="0.15" />
            {/* Small circle bottom-left */}
            <circle cx="5" cy="19" r="1.5" fill={color} stroke="none" />
            {/* Small plus top-right */}
            <path d="M19 4v4M17 6h4" strokeWidth="2" />
        </svg>
    );
}

// ─── SIMPLE MARKDOWN TO HTML RENDERER ──────────────────────────────────────
function renderMarkdown(content: string) {
    if (!content) return '';

    const lines = content.split('\n');
    let inTable = false;
    let tableRows: string[] = [];
    let processedLines: string[] = [];

    const flushTable = () => {
        if (!inTable || tableRows.length === 0) return '';
        let html = '<div style="overflow-x: auto; margin: 1rem 0; border-radius: 8px; border: 1px solid #e2e8f0;"><table style="width: 100%; border-collapse: collapse; font-size: 0.88rem; text-align: left;">';
        
        tableRows.forEach((row, idx) => {
            const isHeader = idx === 0;
            const isDivider = row.includes('---');
            if (isDivider) return;

            const cells = row.split('|').map(c => c.trim()).filter((_, cellIdx, arr) => cellIdx > 0 && cellIdx < arr.length - 1);
            if (cells.length === 0) return;

            html += `<tr style="border-bottom: 1px solid #e2e8f0; ${isHeader ? 'background-color: #f1f5f9; font-weight: 800; color: #1e293b;' : 'background-color: #ffffff;'}">`;
            cells.forEach(cell => {
                const Tag = isHeader ? 'th' : 'td';
                html += `<${Tag} style="padding: 0.65rem 0.9rem;">${formatInlineMarkdown(cell)}</${Tag}>`;
            });
            html += '</tr>';
        });

        html += '</table></div>';
        inTable = false;
        tableRows = [];
        return html;
    };

    lines.forEach((line) => {
        const trimmed = line.trim();
        if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
            inTable = true;
            tableRows.push(trimmed);
        } else {
            if (inTable) {
                processedLines.push(flushTable());
            }

            if (trimmed.startsWith('### ')) {
                processedLines.push(`<h4 style="font-size: 1.1rem; font-weight: 800; color: #1e293b; margin: 1.2rem 0 0.5rem 0;">${formatInlineMarkdown(trimmed.slice(4))}</h4>`);
            } else if (trimmed.startsWith('## ')) {
                processedLines.push(`<h3 style="font-size: 1.25rem; font-weight: 800; color: #0f172a; margin: 1.4rem 0 0.6rem 0;">${formatInlineMarkdown(trimmed.slice(3))}</h3>`);
            } else if (trimmed.startsWith('# ')) {
                processedLines.push(`<h2 style="font-size: 1.4rem; font-weight: 800; color: #0f172a; margin: 1.6rem 0 0.75rem 0;">${formatInlineMarkdown(trimmed.slice(2))}</h2>`);
            } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
                processedLines.push(`<div style="display: flex; gap: 0.5rem; margin-bottom: 0.35rem; line-height: 1.5;"><span style="color: #3a9c6b; font-weight: bold;">•</span><span>${formatInlineMarkdown(trimmed.slice(2))}</span></div>`);
            } else if (/^\d+\.\s/.test(trimmed)) {
                const numMatch = trimmed.match(/^(\d+)\.\s(.*)$/);
                if (numMatch) {
                    processedLines.push(`<div style="display: flex; gap: 0.5rem; margin-bottom: 0.35rem; line-height: 1.5;"><span style="color: #3a549c; font-weight: 800;">${numMatch[1]}.</span><span>${formatInlineMarkdown(numMatch[2])}</span></div>`);
                }
            } else if (trimmed === '') {
                processedLines.push('<div style="height: 0.5rem;"></div>');
            } else {
                processedLines.push(`<p style="margin: 0 0 0.6rem 0; line-height: 1.6;">${formatInlineMarkdown(line)}</p>`);
            }
        }
    });

    if (inTable) {
        processedLines.push(flushTable());
    }

    return processedLines.join('');
}

function formatInlineMarkdown(text: string): string {
    return text
        .replace(/\*\*(.*?)\*\*/g, '<strong style="color: #0f172a; font-weight: 700;">$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/`([^`]+)`/g, '<code style="background-color: #f1f5f9; color: #3a549c; padding: 0.15rem 0.4rem; border-radius: 4px; font-family: monospace; font-size: 0.88em;">$1</code>');
}

export function AiChatbot({ currentWeek, activeRegion, activeSlideId, fy = 'FY2027' }: AiChatbotProps) {
    const { token, user } = useAuth();
    const isAdmin = user?.role === 'Admin' || user?.role?.toLowerCase() === 'admin';

    // Access permissions
    const [hasAccess, setHasAccess] = useState<boolean>(true);

    // State for modal / workspace
    const [isOpen, setIsOpen] = useState(false);
    const [sessions, setSessions] = useState<SessionItem[]>([]);
    const [hasMoreSessions, setHasMoreSessions] = useState(false);
    const [isLoadingMoreSessions, setIsLoadingMoreSessions] = useState(false);
    const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
    const [messages, setMessages] = useState<MessageItem[]>([]);
    const [inputText, setInputText] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);

    const chatEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    // Dynamic Example Question Chips
    const promptChips = useMemo(() => {
        const reg = activeRegion && activeRegion !== 'Overall' ? activeRegion : null;
        const currentFy = fy || 'FY2027';
        return [
            {
                label: '📊 Executive KPI Summary & Targets',
                prompt: `What is the total PO won, pipeline forecast, base vs stretch targets, and invoiced revenue in ${currentFy}?`
            },
            {
                label: reg ? `🐋 Whale Accounts in ${reg}` : '🐋 Major Whale Accounts Status',
                prompt: reg ? `Summarize the Whale accounts status, latest executive notes, and updates for ${reg}.` : 'What is the latest status of major Whale Accounts across all regions?'
            },
            {
                label: reg ? `🏆 POs Won (>50K) in ${reg}` : '🏆 Key POs Won Across Regions',
                prompt: reg ? `Show all PO's Won (>50K) and recent deals in ${reg} for week ${currentWeek || 'current'}.` : `What are the key PO's Won (>50K) across all regions for week ${currentWeek || 'current'}?`
            },
            {
                label: '📦 Order Backlog Summary',
                prompt: `What is the current total and regional order backlog for week ${currentWeek || 'current'}?`
            },
            {
                label: '🔍 Customer & Opportunity Search',
                prompt: 'Search all slide notes, CRM deals, and whale accounts for updates on Exotec, Liebherr, and Cubic.'
            },
            {
                label: '📨 RFQs & Proposals Summary',
                prompt: `What is the total number of RFQs received and proposals given across regions?`
            }
        ];
    }, [activeRegion, currentWeek, fy]);

    // Check access status
    const checkAccess = async () => {
        try {
            const res = await fetch('/api/ai/access-status', {
                headers: token ? { 'Authorization': `Bearer ${token}` } : {}
            });
            if (res.ok) {
                const data = await res.json();
                setHasAccess(data.has_access);
            }
        } catch (err) {
            console.error('Failed to check AI access:', err);
        }
    };

    // Fetch user sessions (top 10 most recent, with load-more pagination)
    const fetchSessions = async (isLoadMore = false) => {
        try {
            if (isLoadMore) {
                setIsLoadingMoreSessions(true);
            }
            const skip = isLoadMore ? sessions.length : 0;
            const res = await fetch(`/api/ai/sessions?limit=10&skip=${skip}`, {
                headers: token ? { 'Authorization': `Bearer ${token}` } : {}
            });
            if (res.ok) {
                const data = await res.json();
                const newSessions = data.sessions || [];
                if (isLoadMore) {
                    setSessions(prev => [...prev, ...newSessions]);
                } else {
                    setSessions(newSessions);
                }
                setHasMoreSessions(Boolean(data.has_more));
            }
        } catch (err) {
            console.error('Failed to fetch sessions:', err);
        } finally {
            setIsLoadingMoreSessions(false);
        }
    };

    // Load active session messages
    const loadSession = async (sessionId: string) => {
        try {
            const res = await fetch(`/api/ai/sessions/${sessionId}`, {
                headers: token ? { 'Authorization': `Bearer ${token}` } : {}
            });
            if (res.ok) {
                const data = await res.json();
                setMessages(data.messages || []);
                setActiveSessionId(sessionId);
            }
        } catch (err) {
            console.error('Failed to load session:', err);
        }
    };

    useEffect(() => {
        checkAccess();
    }, [token]);

    useEffect(() => {
        if (isOpen) {
            fetchSessions();
            if (!activeSessionId && sessions.length > 0) {
                loadSession(sessions[0].session_id);
            }
            setTimeout(() => inputRef.current?.focus(), 150);
        }
    }, [isOpen]);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isLoading]);

    const [loadingStep, setLoadingStep] = useState(0);

    const LOADING_STEPS = [
        "Analyzing question & connecting to live database...",
        "Executing MongoDB aggregations & query tools...",
        "Computing metrics, targets & regional summaries...",
        "Synthesizing executive business insights..."
    ];

    useEffect(() => {
        let interval: any = null;
        if (isLoading) {
            setLoadingStep(0);
            interval = setInterval(() => {
                setLoadingStep(prev => (prev + 1) % LOADING_STEPS.length);
            }, 1800);
        } else {
            setLoadingStep(0);
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [isLoading]);

    const handleSendMessage = async (textToSend?: string) => {
        const text = (textToSend || inputText).trim();
        if (!text || isLoading) return;

        setInputText('');
        setIsLoading(true);

        const tempUserMsg: MessageItem = {
            id: 'temp-' + Date.now(),
            role: 'user',
            content: text,
            timestamp: new Date().toISOString()
        };
        setMessages(prev => [...prev, tempUserMsg]);

        try {
            const res = await fetch('/api/ai/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                body: JSON.stringify({
                    session_id: activeSessionId || undefined,
                    message: text,
                    week: currentWeek || undefined,
                    active_region: activeRegion || undefined,
                    active_slide_id: activeSlideId || undefined,
                    fy: fy || 'FY2027'
                })
            });

            if (res.ok) {
                const data = await res.json();
                setActiveSessionId(data.session_id);
                setMessages(prev => {
                    const withoutTemp = prev.filter(m => m.id !== tempUserMsg.id);
                    return [...withoutTemp, data.user_message, data.assistant_message];
                });
                fetchSessions();
            } else {
                let errMessage = 'Failed to generate response';
                try {
                    const contentType = res.headers.get('content-type') || '';
                    if (contentType.includes('application/json')) {
                        const errData = await res.json();
                        errMessage = errData.detail || errMessage;
                    } else {
                        const text = await res.text();
                        errMessage = text || `Server error (${res.status})`;
                    }
                } catch {
                    errMessage = `Server returned status ${res.status}`;
                }
                const errAssistantMsg: MessageItem = {
                    id: 'err-' + Date.now(),
                    role: 'assistant',
                    content: `⚠️ Error: ${errMessage}`,
                    timestamp: new Date().toISOString()
                };
                setMessages(prev => [...prev, errAssistantMsg]);
            }
        } catch (err: any) {
            const errAssistantMsg: MessageItem = {
                id: 'err-' + Date.now(),
                role: 'assistant',
                content: `⚠️ Network error: ${err.message || 'Unable to communicate with the AI agent.'}`,
                timestamp: new Date().toISOString()
            };
            setMessages(prev => [...prev, errAssistantMsg]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleFeedback = async (msgId: string, rating: 'useful' | 'not_useful') => {
        if (!activeSessionId) return;

        setMessages(prev => prev.map(m => m.id === msgId ? { ...m, feedback_rating: rating } : m));

        try {
            await fetch('/api/ai/feedback', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                body: JSON.stringify({
                    session_id: activeSessionId,
                    message_id: msgId,
                    rating: rating
                })
            });
        } catch (err) {
            console.error('Failed to submit feedback:', err);
        }
    };

    const handleCopy = (text: string, id: string) => {
        navigator.clipboard.writeText(text);
        setCopiedMsgId(id);
        setTimeout(() => setCopiedMsgId(null), 2000);
    };

    const handleNewChat = () => {
        setActiveSessionId(null);
        setMessages([]);
        setTimeout(() => inputRef.current?.focus(), 50);
    };

    if (!isAdmin || !hasAccess) {
        return null;
    }

    return (
        <>
            {/* ── 1. LAUNCH CARD (Embedded below Regional Clusters) ── */}
            <div style={{ marginLeft: '1rem', marginBottom: '3.5rem', maxWidth: '1200px' }}>
                <div style={{
                    background: 'linear-gradient(135deg, #273766 0%, #3a549c 68%, #3a9c6b 100%)',
                    borderRadius: '20px',
                    padding: '2rem 2.5rem',
                    color: '#ffffff',
                    boxShadow: '0 12px 35px -5px rgba(58, 84, 156, 0.35)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '1.5rem',
                    position: 'relative',
                    overflow: 'hidden',
                    border: '1.5px solid rgba(255, 255, 255, 0.18)'
                }}>
                    {/* Test Label in the top-right corner */}
                    <div style={{
                        position: 'absolute',
                        top: '14px',
                        right: '18px',
                        backgroundColor: 'rgba(255, 255, 255, 0.15)',
                        border: '1px solid rgba(255, 255, 255, 0.28)',
                        color: '#ffffff',
                        fontSize: '0.68rem',
                        fontWeight: '800',
                        letterSpacing: '0.08em',
                        padding: '0.22rem 0.65rem',
                        borderRadius: '9999px',
                        textTransform: 'uppercase',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        backdropFilter: 'blur(6px)',
                        zIndex: 3
                    }}>
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#facc15', boxShadow: '0 0 6px #facc15' }} />
                        TEST / ADMIN PREVIEW
                    </div>

                    {/* Decorative subtle gradient background glow */}
                    <div style={{
                        position: 'absolute',
                        right: '-40px',
                        top: '-40px',
                        width: '220px',
                        height: '220px',
                        borderRadius: '50%',
                        background: 'radial-gradient(circle, rgba(58, 156, 107, 0.35) 0%, rgba(255, 255, 255, 0) 70%)',
                        pointerEvents: 'none'
                    }} />

                    <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', zIndex: 2 }}>
                        {/* Custom Star Icon Box matching user uploaded style */}
                        <div style={{
                            width: '64px',
                            height: '64px',
                            borderRadius: '18px',
                            backgroundColor: '#ffffff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 8px 20px rgba(0, 0, 0, 0.15)',
                            flexShrink: 0
                        }}>
                            <AiStarIcon size={34} color="#3a549c" />
                        </div>

                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.35rem' }}>
                                <h3 style={{ margin: 0, fontSize: '1.65rem', fontWeight: '800', letterSpacing: '-0.01em' }}>
                                    Weekly Tracker AI Assistant
                                </h3>
                            </div>

                            <p style={{ margin: 0, fontSize: '0.95rem', color: '#e2e8f0', maxWidth: '650px', lineHeight: '1.5' }}>
                                Ask questions, search free-text slide notes, query POs Won, examine Whale Accounts, or analyze revenue vs targets in natural language with live database grounding.
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={() => setIsOpen(true)}
                        style={{
                            backgroundColor: '#ffffff',
                            color: '#3a549c',
                            border: 'none',
                            padding: '1rem 2.2rem',
                            borderRadius: '9999px',
                            fontWeight: '800',
                            fontSize: '1.05rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 8px 20px rgba(0, 0, 0, 0.18)',
                            transition: 'all 0.2s ease',
                            zIndex: 2,
                            flexShrink: 0
                        }}
                        onMouseOver={(e) => {
                            e.currentTarget.style.transform = 'translateY(-2px) scale(1.02)';
                            e.currentTarget.style.boxShadow = '0 12px 25px rgba(0, 0, 0, 0.25)';
                        }}
                        onMouseOut={(e) => {
                            e.currentTarget.style.transform = 'translateY(0) scale(1)';
                            e.currentTarget.style.boxShadow = '0 8px 20px rgba(0, 0, 0, 0.18)';
                        }}
                    >
                        Open AI Chat Workspace
                    </button>

                    {/* Note UI: Testing Phase for Admin Only */}
                    <div style={{
                        width: '100%',
                        paddingTop: '0.85rem',
                        marginTop: '0.25rem',
                        borderTop: '1px solid rgba(255, 255, 255, 0.15)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        fontSize: '0.82rem',
                        color: '#cbd5e1',
                        zIndex: 2
                    }}>
                        <ShieldAlert size={15} style={{ color: '#fde047', flexShrink: 0 }} />
                        <span>
                            <strong style={{ color: '#ffffff', fontWeight: '700' }}>Note:</strong> This AI assistant is purely in testing phase and is viewable by Administrators only.
                        </span>
                    </div>
                </div>
            </div>

            {/* ── 2. FULLSCREEN EXPANDED CHAT WORKSPACE ── */}
            {isOpen && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    zIndex: 10000,
                    backgroundColor: 'rgba(15, 23, 42, 0.65)',
                    backdropFilter: 'blur(8px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '1.5rem',
                    boxSizing: 'border-box'
                }}>
                    <div style={{
                        width: '100%',
                        maxWidth: '1440px',
                        height: '92vh',
                        backgroundColor: '#ffffff',
                        borderRadius: '20px',
                        boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.4)',
                        display: 'flex',
                        overflow: 'hidden',
                        border: '1px solid #e2e8f0',
                        position: 'relative'
                    }}>
                        {/* ── LEFT SIDEBAR: Session History & New Chat ── */}
                        <div style={{
                            width: '300px',
                            backgroundColor: '#f8fafc',
                            borderRight: '1px solid #e2e8f0',
                            display: 'flex',
                            flexDirection: 'column',
                            flexShrink: 0
                        }}>
                            {/* New Chat Button Header */}
                            <div style={{ padding: '1.25rem', borderBottom: '1px solid #e2e8f0' }}>
                                <button
                                    onClick={handleNewChat}
                                    style={{
                                        width: '100%',
                                        padding: '0.8rem 1rem',
                                        backgroundColor: '#3a549c',
                                        color: '#ffffff',
                                        border: 'none',
                                        borderRadius: '12px',
                                        fontWeight: '800',
                                        fontSize: '0.95rem',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '0.5rem',
                                        boxShadow: '0 4px 12px rgba(58, 84, 156, 0.25)',
                                        transition: 'all 0.15s ease'
                                    }}
                                    onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#2e437c'}
                                    onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#3a549c'}
                                >
                                    <Plus size={18} />
                                    New Conversation
                                </button>
                            </div>

                            {/* Sessions List */}
                            <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem' }}>
                                <div style={{ fontSize: '0.75rem', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '0.5rem 0.6rem' }}>
                                    Recent Conversations
                                </div>

                                {sessions.length === 0 ? (
                                    <div style={{ padding: '1.5rem 0.5rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>
                                        No past sessions found. Start a new question!
                                    </div>
                                ) : (
                                    <>
                                        {sessions.map((s) => {
                                            const isSelected = activeSessionId === s.session_id;
                                            return (
                                                <div
                                                    key={s.session_id}
                                                    onClick={() => loadSession(s.session_id)}
                                                    style={{
                                                        padding: '0.75rem 0.85rem',
                                                        borderRadius: '10px',
                                                        backgroundColor: isSelected ? '#eef3ff' : 'transparent',
                                                        color: isSelected ? '#3a549c' : '#334155',
                                                        fontWeight: isSelected ? '700' : '500',
                                                        fontSize: '0.88rem',
                                                        cursor: 'pointer',
                                                        marginBottom: '0.3rem',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '0.6rem',
                                                        transition: 'all 0.15s ease',
                                                        border: isSelected ? '1px solid #cbd5e1' : '1px solid transparent'
                                                    }}
                                                >
                                                    <MessageSquare size={16} color={isSelected ? '#3a549c' : '#94a3b8'} />
                                                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                        {s.title}
                                                    </span>
                                                </div>
                                            );
                                        })}

                                        {/* Load More Older Sessions Button */}
                                        {hasMoreSessions && (
                                            <div style={{ padding: '0.4rem 0.2rem 0.6rem 0.2rem' }}>
                                                <button
                                                    type="button"
                                                    disabled={isLoadingMoreSessions}
                                                    onClick={() => fetchSessions(true)}
                                                    style={{
                                                        width: '100%',
                                                        padding: '0.5rem 0.75rem',
                                                        borderRadius: '8px',
                                                        backgroundColor: '#f1f5f9',
                                                        border: '1px solid #cbd5e1',
                                                        color: '#334155',
                                                        fontSize: '0.78rem',
                                                        fontWeight: '700',
                                                        cursor: isLoadingMoreSessions ? 'not-allowed' : 'pointer',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        gap: '0.4rem',
                                                        transition: 'all 0.15s ease'
                                                    }}
                                                >
                                                    {isLoadingMoreSessions ? (
                                                        <>
                                                            <RefreshCw className="animate-spin" size={13} />
                                                            <span>Loading older chats...</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <ChevronDown size={14} />
                                                            <span>Load More (10 older)</span>
                                                        </>
                                                    )}
                                                </button>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>

                            {/* User Footer info */}
                            <div style={{ padding: '1rem', borderTop: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.82rem', color: '#64748b' }}>
                                <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#e2e8f0', color: '#3a549c', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800' }}>
                                    <User size={16} />
                                </div>
                                <div style={{ overflow: 'hidden' }}>
                                    <div style={{ fontWeight: '700', color: '#0f172a', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{user?.email ? user.email.split('@')[0] : 'Authenticated User'}</div>
                                    <div style={{ fontSize: '0.72rem', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{user?.email || 'e-con systems'}</div>
                                </div>
                            </div>
                        </div>

                        {/* ── RIGHT MAIN CHAT AREA ── */}
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#ffffff' }}>
                            {/* Top Header */}
                            <div style={{
                                padding: '1rem 1.75rem',
                                borderBottom: '1px solid #e2e8f0',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                backgroundColor: '#ffffff',
                                flexShrink: 0
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                                    {/* Star Icon representation in header */}
                                    <div style={{ width: '42px', height: '42px', borderRadius: '12px', backgroundColor: '#eef3ff', border: '1px solid #cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <AiStarIcon size={24} color="#3a549c" />
                                    </div>
                                    <div>
                                        <h3 style={{ margin: 0, fontSize: '1.18rem', fontWeight: '800', color: '#0f172a' }}>
                                            Weekly Tracker AI Business Assistant
                                        </h3>
                                        <div style={{ fontSize: '0.78rem', color: '#64748b', display: 'flex', gap: '0.75rem', marginTop: '0.15rem' }}>
                                            <span>Week: <strong>{currentWeek || 'Latest'}</strong></span>
                                            <span>•</span>
                                            <span>Region: <strong>{activeRegion || 'Overall'}</strong></span>
                                            <span>•</span>
                                            <span>FY: <strong>{fy || 'FY2027'}</strong></span>
                                        </div>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <button
                                        onClick={() => setIsOpen(false)}
                                        style={{
                                            backgroundColor: '#f1f5f9',
                                            border: 'none',
                                            width: '36px',
                                            height: '36px',
                                            borderRadius: '50%',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            color: '#64748b',
                                            cursor: 'pointer',
                                            transition: 'all 0.15s ease'
                                        }}
                                    >
                                        <X size={20} />
                                    </button>
                                </div>
                            </div>

                            {/* Chat Messages Feed */}
                            <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem 2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                {messages.length === 0 ? (
                                    /* Empty State / Welcome Screen with Example Question Chips */
                                    <div style={{ maxWidth: '820px', margin: 'auto', textAlign: 'center', padding: '2rem 1rem' }}>
                                        <div style={{ width: '70px', height: '70px', borderRadius: '22px', backgroundColor: '#eef3ff', border: '1px solid #cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem auto' }}>
                                            <AiStarIcon size={38} color="#3a549c" />
                                        </div>

                                        <h2 style={{ fontSize: '1.85rem', fontWeight: '800', color: '#0f172a', margin: '0 0 0.5rem 0', letterSpacing: '-0.02em' }}>
                                            How can I help analyze the Weekly Tracker?
                                        </h2>
                                        <p style={{ color: '#64748b', fontSize: '0.95rem', maxWidth: '600px', margin: '0 auto 2rem auto', lineHeight: '1.5' }}>
                                            Ask questions about CRM pipelines, Whale Accounts, freeform slide notes, order backlogs, or financial target settings.
                                        </p>

                                        {/* Clickable Example Question Chips */}
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem', textAlign: 'left' }}>
                                            {promptChips.map((chip, idx) => (
                                                <div
                                                    key={idx}
                                                    onClick={() => handleSendMessage(chip.prompt)}
                                                    style={{
                                                        backgroundColor: '#f8fafc',
                                                        border: '1.5px solid #e2e8f0',
                                                        borderRadius: '14px',
                                                        padding: '1rem 1.25rem',
                                                        cursor: 'pointer',
                                                        transition: 'all 0.15s ease',
                                                        display: 'flex',
                                                        flexDirection: 'column',
                                                        justifyContent: 'space-between'
                                                    }}
                                                    onMouseOver={(e) => {
                                                        e.currentTarget.style.backgroundColor = '#f0fdf4';
                                                        e.currentTarget.style.borderColor = '#3a9c6b';
                                                        e.currentTarget.style.transform = 'translateY(-2px)';
                                                    }}
                                                    onMouseOut={(e) => {
                                                        e.currentTarget.style.backgroundColor = '#f8fafc';
                                                        e.currentTarget.style.borderColor = '#e2e8f0';
                                                        e.currentTarget.style.transform = 'translateY(0)';
                                                    }}
                                                >
                                                    <div style={{ fontWeight: '800', color: '#1e293b', fontSize: '0.92rem', marginBottom: '0.35rem' }}>
                                                        {chip.label}
                                                    </div>
                                                    <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                                                        {chip.prompt}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ) : (
                                    /* Messages Thread */
                                    messages.map((msg) => {
                                        const isUser = msg.role === 'user';
                                        return (
                                            <div
                                                key={msg.id}
                                                style={{
                                                    display: 'flex',
                                                    gap: '1rem',
                                                    alignItems: 'flex-start',
                                                    justifyContent: isUser ? 'flex-end' : 'flex-start'
                                                }}
                                            >
                                                {!isUser && (
                                                    <div style={{
                                                        width: '36px',
                                                        height: '36px',
                                                        borderRadius: '10px',
                                                        backgroundColor: '#eef3ff',
                                                        border: '1px solid #cbd5e1',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        flexShrink: 0,
                                                        marginTop: '2px'
                                                    }}>
                                                        <AiStarIcon size={20} color="#3a549c" />
                                                    </div>
                                                )}

                                                <div style={{ maxWidth: '85%', display: 'flex', flexDirection: 'column', alignItems: isUser ? 'flex-end' : 'flex-start' }}>
                                                    {/* Message Bubble */}
                                                    <div style={{
                                                        backgroundColor: isUser ? '#3a549c' : '#f8fafc',
                                                        color: isUser ? '#ffffff' : '#0f172a',
                                                        padding: isUser ? '0.85rem 1.25rem' : '1.25rem 1.5rem',
                                                        borderRadius: isUser ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                                                        border: isUser ? 'none' : '1px solid #e2e8f0',
                                                        boxShadow: isUser ? '0 4px 12px rgba(58, 84, 156, 0.2)' : '0 2px 6px rgba(0, 0, 0, 0.02)',
                                                        fontSize: '0.94rem'
                                                    }}>
                                                        {isUser ? (
                                                            <div style={{ whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>{msg.content}</div>
                                                        ) : (
                                                            <>
                                                                {/* Expandable Tool Calls Viewer */}
                                                                <ToolExecutionViewer tools={msg.tools_called || []} latency={msg.latency_formatted} />

                                                                <div
                                                                    dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
                                                                />
                                                            </>
                                                        )}
                                                    </div>

                                                    {/* Assistant Action Toolbar (Feedback & Copy) */}
                                                    {!isUser && (
                                                        <div style={{
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '0.75rem',
                                                            marginTop: '0.4rem',
                                                            marginLeft: '0.25rem'
                                                        }}>
                                                            <button
                                                                onClick={() => handleCopy(msg.content, msg.id)}
                                                                title="Copy to clipboard"
                                                                style={{
                                                                    background: 'none',
                                                                    border: 'none',
                                                                    color: '#94a3b8',
                                                                    cursor: 'pointer',
                                                                    padding: '4px',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    gap: '0.25rem',
                                                                    fontSize: '0.75rem'
                                                                }}
                                                            >
                                                                {copiedMsgId === msg.id ? <Check size={14} color="#3a9c6b" /> : <Copy size={14} />}
                                                                {copiedMsgId === msg.id && <span style={{ color: '#3a9c6b', fontWeight: '700' }}>Copied</span>}
                                                            </button>

                                                            <div style={{ width: '1px', height: '12px', backgroundColor: '#e2e8f0' }} />

                                                            {/* Useful / Not Useful Buttons */}
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                                                <button
                                                                    onClick={() => handleFeedback(msg.id, 'useful')}
                                                                    style={{
                                                                        background: msg.feedback_rating === 'useful' ? '#dcfce7' : 'none',
                                                                        border: msg.feedback_rating === 'useful' ? '1px solid #86efac' : 'none',
                                                                        color: msg.feedback_rating === 'useful' ? '#15803d' : '#94a3b8',
                                                                        cursor: 'pointer',
                                                                        padding: '4px 8px',
                                                                        borderRadius: '6px',
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        gap: '0.25rem',
                                                                        fontSize: '0.75rem',
                                                                        fontWeight: msg.feedback_rating === 'useful' ? '800' : '600'
                                                                    }}
                                                                >
                                                                    <ThumbsUp size={13} />
                                                                    <span>Useful</span>
                                                                </button>

                                                                <button
                                                                    onClick={() => handleFeedback(msg.id, 'not_useful')}
                                                                    style={{
                                                                        background: msg.feedback_rating === 'not_useful' ? '#fee2e2' : 'none',
                                                                        border: msg.feedback_rating === 'not_useful' ? '1px solid #fca5a5' : 'none',
                                                                        color: msg.feedback_rating === 'not_useful' ? '#b91c1c' : '#94a3b8',
                                                                        cursor: 'pointer',
                                                                        padding: '4px 8px',
                                                                        borderRadius: '6px',
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        gap: '0.25rem',
                                                                        fontSize: '0.75rem',
                                                                        fontWeight: msg.feedback_rating === 'not_useful' ? '800' : '600'
                                                                    }}
                                                                >
                                                                    <ThumbsDown size={13} />
                                                                    <span>Not Useful</span>
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>

                                                {isUser && (
                                                    <div style={{
                                                        width: '36px',
                                                        height: '36px',
                                                        borderRadius: '10px',
                                                        backgroundColor: '#e2e8f0',
                                                        color: '#3a549c',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        flexShrink: 0,
                                                        marginTop: '2px'
                                                    }}>
                                                        <User size={18} />
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })
                                )}

                                {/* Dynamic Loading Indicator with Active Sub-Text */}
                                {isLoading && (
                                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                                        <div style={{
                                            width: '36px',
                                            height: '36px',
                                            borderRadius: '10px',
                                            backgroundColor: '#eef3ff',
                                            border: '1px solid #cbd5e1',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            flexShrink: 0
                                        }}>
                                            <AiStarIcon size={20} color="#3a549c" />
                                        </div>
                                        <div style={{
                                            backgroundColor: '#f8fafc',
                                            padding: '1rem 1.4rem',
                                            borderRadius: '18px 18px 18px 4px',
                                            border: '1px solid #e2e8f0',
                                            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: '0.45rem',
                                            minWidth: '280px'
                                        }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                                                <RefreshCw className="animate-spin" size={17} color="#2563eb" />
                                                <span style={{ fontSize: '0.92rem', color: '#1e293b', fontWeight: '800' }}>
                                                    {LOADING_STEPS[loadingStep]}
                                                </span>
                                            </div>

                                            {/* Subtext explanation showing what the agent is doing */}
                                            <div style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '0.4rem',
                                                fontSize: '0.78rem',
                                                color: '#64748b',
                                                paddingLeft: '1.7rem'
                                            }}>
                                                <Activity size={13} color="#16a34a" />
                                                <span>Running read-only query playground & calculating live figures...</span>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div ref={chatEndRef} />
                            </div>

                            {/* Bottom Input Workspace Bar */}
                            <div style={{
                                padding: '1rem 2rem 1.5rem 2rem',
                                borderTop: '1px solid #e2e8f0',
                                backgroundColor: '#ffffff',
                                flexShrink: 0
                            }}>
                                {/* Quick Follow-Up Suggestion Pills when chat is active */}
                                {messages.length > 0 && !isLoading && (
                                    <div style={{
                                        display: 'flex',
                                        gap: '0.45rem',
                                        overflowX: 'auto',
                                        paddingBottom: '0.65rem',
                                        marginBottom: '0.4rem',
                                        whiteSpace: 'nowrap',
                                        scrollbarWidth: 'none'
                                    }}>
                                        {promptChips.slice(0, 4).map((chip, idx) => (
                                            <button
                                                key={idx}
                                                type="button"
                                                onClick={() => handleSendMessage(chip.prompt)}
                                                style={{
                                                    backgroundColor: '#f1f5f9',
                                                    border: '1px solid #cbd5e1',
                                                    borderRadius: '20px',
                                                    padding: '0.3rem 0.75rem',
                                                    fontSize: '0.75rem',
                                                    fontWeight: '700',
                                                    color: '#334155',
                                                    cursor: 'pointer',
                                                    transition: 'all 0.15s ease',
                                                    flexShrink: 0
                                                }}
                                                onMouseOver={(e) => {
                                                    e.currentTarget.style.backgroundColor = '#eef3ff';
                                                    e.currentTarget.style.borderColor = '#3a549c';
                                                    e.currentTarget.style.color = '#3a549c';
                                                }}
                                                onMouseOut={(e) => {
                                                    e.currentTarget.style.backgroundColor = '#f1f5f9';
                                                    e.currentTarget.style.borderColor = '#cbd5e1';
                                                    e.currentTarget.style.color = '#334155';
                                                }}
                                            >
                                                {chip.label}
                                            </button>
                                        ))}
                                    </div>
                                )}

                                <div style={{
                                    backgroundColor: '#f8fafc',
                                    borderRadius: '16px',
                                    border: '1.5px solid #cbd5e1',
                                    padding: '0.75rem 1rem',
                                    display: 'flex',
                                    alignItems: 'flex-end',
                                    gap: '0.75rem',
                                    boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
                                    transition: 'border-color 0.15s ease'
                                }}>
                                    <textarea
                                        ref={inputRef}
                                        value={inputText}
                                        onChange={(e) => setInputText(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                e.preventDefault();
                                                handleSendMessage();
                                            }
                                        }}
                                        placeholder="Ask any question about weekly tracker data, customer names, whale accounts, revenue targets..."
                                        rows={2}
                                        style={{
                                            flex: 1,
                                            border: 'none',
                                            backgroundColor: 'transparent',
                                            outline: 'none',
                                            fontSize: '0.95rem',
                                            color: '#0f172a',
                                            resize: 'none',
                                            fontFamily: 'inherit',
                                            lineHeight: '1.5'
                                        }}
                                    />

                                    <button
                                        onClick={() => handleSendMessage()}
                                        disabled={!inputText.trim() || isLoading}
                                        style={{
                                            backgroundColor: inputText.trim() && !isLoading ? '#3a549c' : '#cbd5e1',
                                            color: '#ffffff',
                                            border: 'none',
                                            width: '42px',
                                            height: '42px',
                                            borderRadius: '12px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            cursor: inputText.trim() && !isLoading ? 'pointer' : 'not-allowed',
                                            transition: 'all 0.15s ease',
                                            flexShrink: 0
                                        }}
                                    >
                                        <Send size={18} />
                                    </button>
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem', fontSize: '0.75rem', color: '#94a3b8' }}>
                                    <div>e-con Systems Weekly Tracker AI Assistant</div>
                                    <div>Press <strong>Enter</strong> to send, <strong>Shift + Enter</strong> for new line</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
