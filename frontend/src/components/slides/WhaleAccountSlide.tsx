import { useState, useEffect, useRef, useMemo } from 'react';
import { Maximize2, X } from 'lucide-react';
import JoditEditor from 'jodit-react';

interface WhaleAccountSlideProps {
    title?: string;
    isEditing?: boolean;
    region?: string;
}

interface WhaleAccountVariant {
    version: string;
    text_data: string;
    log_date: string;
}

interface WhaleAccountEntry {
    _id?: string;
    account_name: string;
    date_updated: string;
    week_updated: number;
    text_data?: string;
    variants?: WhaleAccountVariant[];
    region?: string;
    is_old_data?: boolean;
    is_missing?: boolean;
}

const getWeekNumber = (dateStr: string) => {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    const target = new Date(d.valueOf());
    const dayNr = (d.getDay() + 6) % 7;
    target.setDate(target.getDate() - dayNr + 3);
    const jan4 = new Date(target.getFullYear(), 0, 4);
    const dayDiff = (target.getTime() - jan4.getTime()) / 86400000;
    return 1 + Math.ceil(dayDiff / 7);
};

export function WhaleAccountSlide({ isEditing, region }: WhaleAccountSlideProps) {
    const [accountNames, setAccountNames] = useState<string[]>([]);
    const [selectedAccount, setSelectedAccount] = useState<string>('');
    const [isCreatingNew, setIsCreatingNew] = useState(false);
    const [newAccountName, setNewAccountName] = useState('');
    const editorRef = useRef(null);
    const oldDataEditorRef = useRef(null);
    const enlargedEditorRef = useRef(null);
    const latestTextRef = useRef('');
    
    const [entries, setEntries] = useState<WhaleAccountEntry[]>([]);
    const [selectedIndex, setSelectedIndex] = useState<number>(-1);
    
    const [expandedDates, setExpandedDates] = useState<Record<string, boolean>>({});
    const [selectedVariantIndex, setSelectedVariantIndex] = useState<number>(-1);
    
    const [currentWeek, setCurrentWeek] = useState<number | null>(null);
    
    // Form state for current selected/edited entry
    const [editableText, setEditableText] = useState('');
    const [editableDate, setEditableDate] = useState('');
    
    // State for Adding Old Data
    const [isAddingOldData, setIsAddingOldData] = useState(false);
    const [oldDataDate, setOldDataDate] = useState('');
    const [oldDataText, setOldDataText] = useState('');
    
    // Modal state for enlarging text
    const [enlargedModal, setEnlargedModal] = useState<'previous' | 'current' | null>(null);


    const fetchAccountNames = async () => {
        try {
            const url = region ? `/api/admin/whale-accounts/names?region=${encodeURIComponent(region)}` : '/api/admin/whale-accounts/names';
            const res = await fetch(url);
            const data = await res.json();
            const sortedNames = data.sort((a: string, b: string) => a.localeCompare(b));
            setAccountNames(sortedNames);
            
            if (!isEditing && sortedNames.length > 0) {
                setSelectedAccount(sortedNames[0]);
                fetchEntries(sortedNames[0]);
            }
        } catch (e) {
            console.error(e);
        }
    };

    useEffect(() => {
        fetch('/api/week/current')
            .then(res => res.json())
            .then(d => setCurrentWeek(d.week))
            .catch(err => console.error(err));
            
        fetchAccountNames();
    }, []);

    const fetchEntries = async (account: string) => {
        if (!account) return;
        try {
            const res = await fetch(`/api/admin/whale-accounts/${encodeURIComponent(account)}`);
            const data = await res.json();
            
            
            const today = new Date();
            const day = today.getDay();
            const diff = today.getDate() - day + (day === 0 ? -6 : 1);
            const monday = new Date(today.getFullYear(), today.getMonth(), diff);
            const currentWednesday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 2);
            let walkDate = new Date(currentWednesday.getTime());
            
            let minTime = walkDate.getTime();
            if (data.length > 0) {
                const dates = data.map((d: any) => new Date(d.date_updated).getTime());
                const dataMin = Math.min(...dates);
                if (!isNaN(dataMin) && dataMin < minTime) {
                    minTime = dataMin;
                }
            }
            
            const paddedData: WhaleAccountEntry[] = [];
            const processedIds = new Set();
            
            while (walkDate.getTime() >= minTime || paddedData.length === 0) {
                const walkDateStr = walkDate.toISOString().split('T')[0];
                const walkWeek = getWeekNumber(walkDateStr);
                
                const matchingEntries = data.filter((d: any) => {
                    const dWeek = d.week_updated || getWeekNumber(d.date_updated);
                    return dWeek === walkWeek;
                });
                
                if (matchingEntries.length > 0) {
                    matchingEntries.forEach((m: any) => {
                        if (!processedIds.has(m._id || m.date_updated)) {
                            paddedData.push(m);
                            processedIds.add(m._id || m.date_updated);
                        }
                    });
                } else {
                    paddedData.push({
                        account_name: account,
                        date_updated: walkDateStr,
                        week_updated: walkWeek || 0,
                        text_data: '',
                        variants: [],
                        is_missing: true
                    });
                }
                
                walkDate.setDate(walkDate.getDate() - 7);
            }
            
            data.forEach((d: any) => {
                if (!processedIds.has(d._id || d.date_updated)) {
                    paddedData.push(d);
                }
            });
            
            const sortedData = paddedData.sort((a, b) => {
                const tA = new Date(a.date_updated).getTime() || 0;
                const tB = new Date(b.date_updated).getTime() || 0;
                return tB - tA;
            });
            
            setEntries(sortedData);
            if (sortedData.length > 0) {
                setSelectedIndex(0);
                setSelectedVariantIndex(-1);
                
                const variants = sortedData[0].variants || [];
                const latestText = variants.length > 0 ? variants[variants.length - 1].text_data : (sortedData[0].text_data || '');
                setEditableText(latestText);
                latestTextRef.current = latestText;
                setEditableDate(sortedData[0].date_updated);
            } else {
                setSelectedIndex(-1);
                setSelectedVariantIndex(-1);
                setEditableText('');
                latestTextRef.current = '';
                const todayStr = new Date().toISOString().split('T')[0];
                setEditableDate(todayStr);
            }
        } catch (e) {
            console.error(e);
        }
    };

    const handleAccountChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const val = e.target.value;
        if (val === 'CREATE_NEW') {
            setIsCreatingNew(true);
            setSelectedAccount('');
            setEntries([]);
            setSelectedIndex(-1);
            setSelectedVariantIndex(-1);
            setExpandedDates({});
            setEditableText('');
            latestTextRef.current = '';
            setEditableDate(new Date().toISOString().split('T')[0]);
        } else {
            setIsCreatingNew(false);
            setSelectedAccount(val);
            setExpandedDates({});
            fetchEntries(val);
        }
    };

    const handleNewAccountConfirm = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && newAccountName.trim() !== '') {
            const acc = newAccountName.trim();
            setSelectedAccount(acc);
            setIsCreatingNew(false);
            setSelectedIndex(-1);
            setSelectedVariantIndex(-1);
            setExpandedDates({});
            fetchEntries(acc);
        }
    };

    const handleDateClick = (index: number) => {
        setSelectedIndex(index);
        setSelectedVariantIndex(-1);
        
        const entry = entries[index];
        const variants = entry.variants || [];
        const latestText = variants.length > 0 ? variants[variants.length - 1].text_data : (entry.text_data || '');
        
        setEditableText(latestText);
        latestTextRef.current = latestText;
        setEditableDate(entry.date_updated);
    };

    const handleVariantClick = (entryIndex: number, variantIndex: number, e: React.MouseEvent) => {
        e.stopPropagation();
        setSelectedIndex(entryIndex);
        setSelectedVariantIndex(variantIndex);
        
        const entry = entries[entryIndex];
        const variants = entry.variants || [];
        
        const text = variants[variantIndex].text_data;
        setEditableText(text);
        latestTextRef.current = text;
        setEditableDate(entry.date_updated);
    };

    const toggleExpand = (index: number, e: React.MouseEvent) => {
        e.stopPropagation();
        setExpandedDates(prev => ({
            ...prev,
            [index]: !prev[index]
        }));
    };

    const handleSave = async () => {
        if (!selectedAccount || !entries[selectedIndex]) return;
        
        const textToSave = latestTextRef.current || editableText;
        
        const payload: WhaleAccountEntry = {
            account_name: selectedAccount,
            date_updated: editableDate,
            week_updated: getWeekNumber(editableDate) || currentWeek || 0,
            text_data: textToSave,
            region: region
        };
        
        const existingEntry = entries[selectedIndex];
        if (existingEntry && (existingEntry.variants || []).length >= 3) {
            alert("Maximum of 3 edits (V3) reached for this date.");
            return;
        }

        try {
            await fetch(`/api/admin/whale-accounts/${encodeURIComponent(selectedAccount)}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            window.dispatchEvent(new Event('tracker_refresh_checklist'));
            fetchEntries(selectedAccount);
            if (!accountNames.includes(selectedAccount)) {
                fetchAccountNames();
            }
        } catch (e) {
            console.error('Failed to save', e);
        }
    };

    const handleSaveOldData = async () => {
        if (!selectedAccount || currentWeek === null || !oldDataDate.trim() || !oldDataText.trim()) return;
        
        const payload: WhaleAccountEntry = {
            account_name: selectedAccount,
            date_updated: oldDataDate,
            week_updated: getWeekNumber(oldDataDate) || currentWeek,
            text_data: oldDataText,
            region: region,
            is_old_data: true
        };
        
        try {
            await fetch(`/api/admin/whale-accounts/${encodeURIComponent(selectedAccount)}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            window.dispatchEvent(new Event('tracker_refresh_checklist'));
            fetchEntries(selectedAccount);
            // Reset old data state
            setIsAddingOldData(false);
            setOldDataDate('');
            setOldDataText('');
        } catch (e) {
            console.error('Failed to save old data', e);
        }
    };

    // Derived Data
    const previousEntry = selectedIndex >= 0 && selectedIndex + 1 < entries.length ? entries[selectedIndex + 1] : null;
    let previousText = '';
    if (previousEntry) {
        const prevVariants = previousEntry.variants || [];
        previousText = prevVariants.length > 0 ? prevVariants[prevVariants.length - 1].text_data : (previousEntry.text_data || '');
    }
    
    const currentEntry = selectedIndex >= 0 ? entries[selectedIndex] : null;
    let canEdit = isEditing;
    if (currentEntry) {
        if (currentEntry.date_updated === editableDate) {
            if ((currentEntry.variants || []).length >= 3) {
                canEdit = false;
            }
        }
        if (currentEntry.is_missing && currentEntry.week_updated !== currentWeek) {
            canEdit = false;
        }
    }

    const joditConfig = useMemo(() => ({
        readonly: !canEdit,
        toolbar: canEdit,
        showCharsCounter: false,
        showWordsCounter: false,
        showXPathInStatusbar: false,
        buttons: ['bold', 'italic', 'underline', '|', 'ul', 'ol', '|', 'outdent', 'indent', '|', 'table', '|', 'undo', 'redo'],
        height: '100%',
        style: {
            background: 'transparent',
            fontFamily: 'inherit',
            fontSize: '1.25rem'
        },
        placeholder: currentEntry?.is_missing && !canEdit ? "No data for this week. Use '+ Add Old Data' to backfill." : (canEdit ? 'Type here...' : '')
    }), [canEdit, currentEntry?.is_missing]);

    const oldDataJoditConfig = useMemo(() => ({
        readonly: false,
        toolbar: true,
        showCharsCounter: false,
        showWordsCounter: false,
        showXPathInStatusbar: false,
        buttons: ['bold', 'italic', 'underline', '|', 'ul', 'ol', '|', 'outdent', 'indent', '|', 'table', '|', 'undo', 'redo'],
        height: 200,
        style: {
            background: 'transparent',
            fontFamily: 'inherit',
            fontSize: '1rem'
        },
        placeholder: 'Enter old data here...'
    }), []);

    const previousJoditConfig = useMemo(() => ({
        readonly: true,
        toolbar: false,
        showCharsCounter: false,
        showWordsCounter: false,
        showXPathInStatusbar: false,
        height: '100%',
        style: {
            background: 'transparent',
            border: 'none',
            fontFamily: 'inherit',
            fontSize: '1.25rem',
            color: '#000'
        },
        placeholder: previousEntry ? '' : 'No previous week data'
    }), [previousEntry]);

    const enlargedJoditConfig = useMemo(() => ({
        readonly: enlargedModal === 'previous' || !canEdit,
        toolbar: enlargedModal === 'current' && canEdit,
        showCharsCounter: false,
        showWordsCounter: false,
        showXPathInStatusbar: false,
        buttons: ['bold', 'italic', 'underline', '|', 'ul', 'ol', '|', 'outdent', 'indent', '|', 'table', '|', 'undo', 'redo'],
        height: '100%',
        style: {
            background: '#f9fafb',
            fontFamily: 'inherit',
            fontSize: '1.5rem',
            color: '#000',
            border: 'none'
        },
        placeholder: enlargedModal === 'current' && currentEntry?.is_missing && !canEdit ? "No data for this week. Use '+ Add Old Data' to backfill." : (enlargedModal === 'current' && canEdit ? 'Type here...' : (enlargedModal === 'previous' && !previousEntry ? 'No previous week data' : ''))
    }), [enlargedModal, canEdit, currentEntry?.is_missing, previousEntry]);

    const formatDateDisplay = (dateStr: string) => {
        if (!dateStr) return '';
        const parts = dateStr.split('-');
        if (parts.length === 3) {
            const [y, m, d] = parts;
            const dateObj = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
            return dateObj.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
        }
        return dateStr;
    };

    const formatLogDate = (logStr: string) => {
        if (!logStr) return '';
        const logD = new Date(logStr);
        if (!isNaN(logD.getTime())) {
            return logD.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        }
        return logStr;
    };

    const formatDateForTimeline = (dateStr: string, fallbackWeek: number) => {
        const week = getWeekNumber(dateStr) || fallbackWeek;
        return `${formatDateDisplay(dateStr)} (week${week})`;
    };

    return (
        <div style={{
            width: '100%',
            height: '100%',
            backgroundColor: '#ffffff',
            display: 'flex',
            flexDirection: 'column',
            padding: '2rem 4rem',
            fontFamily: "'Inter', system-ui, sans-serif"
        }}>
            <div style={{ display: 'flex', flexDirection: 'column', marginBottom: '2rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ width: '8px', height: '40px', backgroundColor: '#22c55e' }} />
                    <h1 style={{ fontSize: '2.5rem', fontWeight: 800, color: '#000', margin: 0 }}>Whale account {region ? `- ${region}` : ''}</h1>
                </div>
                <div style={{ marginTop: '1rem', paddingLeft: '24px', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    {!isCreatingNew ? (
                        <select 
                            style={{
                                fontSize: '1.5rem',
                                padding: '0.5rem',
                                border: 'none',
                                borderBottom: '2px solid #ccc',
                                background: 'transparent',
                                outline: 'none',
                                cursor: 'pointer',
                                fontFamily: 'inherit'
                            }}
                            value={selectedAccount} 
                            onChange={handleAccountChange} 
                        >
                            <option value="">Select Account</option>
                            {accountNames.map(n => <option key={n} value={n}>{n}</option>)}
                            {isEditing && <option value="CREATE_NEW">+ Create new</option>}
                        </select>
                    ) : (
                        <input 
                            autoFocus
                            style={{
                                fontSize: '1.5rem',
                                padding: '0.5rem',
                                border: 'none',
                                borderBottom: '2px solid #3b82f6',
                                outline: 'none',
                                fontFamily: 'inherit'
                            }}
                            placeholder="Type new account and press Enter"
                            value={newAccountName}
                            onChange={(e) => setNewAccountName(e.target.value)}
                            onKeyDown={handleNewAccountConfirm}
                            onBlur={() => { 
                                if(newAccountName.trim() === '') {
                                    setIsCreatingNew(false); 
                                } else {
                                    const acc = newAccountName.trim();
                                    setSelectedAccount(acc);
                                    setIsCreatingNew(false);
                                    setSelectedIndex(-1);
                                    setSelectedVariantIndex(-1);
                                    setExpandedDates({});
                                    fetchEntries(acc);
                                }
                            }}
                        />
                    )}
                </div>
                {isEditing && selectedAccount && !isCreatingNew && (
                    <div style={{ marginTop: '1rem', marginLeft: '24px', padding: '1rem', border: '1px solid #d1d5db', borderRadius: '8px', width: 'fit-content', backgroundColor: '#f9fafb' }}>
                        {!isAddingOldData ? (
                            <button 
                                onClick={() => setIsAddingOldData(true)}
                                style={{
                                    padding: '0.4rem 1rem',
                                    backgroundColor: '#4b5563',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontSize: '0.9rem',
                                    fontWeight: '600'
                                }}
                            >
                                + Add Old Data
                            </button>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                    <span style={{ fontSize: '0.9rem', fontWeight: '600', color: '#4b5563' }}>Old Data Date:</span>
                                    <input 
                                        type="date" 
                                        value={oldDataDate} 
                                        onChange={(e) => setOldDataDate(e.target.value)} 
                                        style={{ padding: '0.4rem', border: '1px solid #d1d5db', borderRadius: '4px', outline: 'none' }}
                                    />
                                </div>
                                <JoditEditor
                                    ref={oldDataEditorRef}
                                    value={oldDataText}
                                    config={oldDataJoditConfig}
                                    onChange={() => {}}
                                    onBlur={(newContent) => setOldDataText(newContent)}
                                />
                                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                                    <button 
                                        onClick={() => { setIsAddingOldData(false); setOldDataDate(''); setOldDataText(''); }}
                                        style={{ padding: '0.4rem 1rem', backgroundColor: '#e5e7eb', color: '#4b5563', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: '600' }}
                                    >
                                        Cancel
                                    </button>
                                    <button 
                                        onClick={handleSaveOldData}
                                        disabled={!oldDataDate || !oldDataText}
                                        style={{ padding: '0.4rem 1rem', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', cursor: (!oldDataDate || !oldDataText) ? 'not-allowed' : 'pointer', fontWeight: '600', opacity: (!oldDataDate || !oldDataText) ? 0.6 : 1 }}
                                    >
                                        Done
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
            
            <div style={{ display: 'flex', flex: 1, gap: '4rem', paddingLeft: '24px' }}>
                <div style={{
                    position: 'relative',
                    width: '320px',
                    maxHeight: '400px',
                    overflowY: 'auto',
                    paddingLeft: '10px',
                    scrollbarWidth: 'none',
                    msOverflowStyle: 'none'
                }}>
                    <div style={{ position: 'relative' }}>
                        {entries.length > 0 && (
                            <div style={{
                                position: 'absolute',
                                left: '4px',
                                top: '30px',
                                bottom: '30px',
                                width: '4px',
                                backgroundColor: '#3b82f6',
                                zIndex: 0
                            }} />
                        )}
                    
                    {entries.map((entry, idx) => {
                        const isActive = selectedIndex === idx;
                        const isExpanded = !!expandedDates[idx];
                        const variants = entry.variants || [];
                        const latestVersion = variants.length > 0 ? variants.length : 1;
                        
                        let dotColor = '#22c55e'; // Green for V1
                        if (latestVersion === 2) dotColor = '#eab308'; // Yellow for V2
                        if (latestVersion >= 3) dotColor = '#ef4444'; // Red for V3
                        
                        return (
                            <div key={idx} style={{ display: 'flex', flexDirection: 'column' }}>
                                <div 
                                    onClick={() => handleDateClick(idx)}
                                    style={{
                                        position: 'relative',
                                        display: 'flex',
                                        alignItems: 'center',
                                        height: '60px',
                                        cursor: 'pointer',
                                        zIndex: 1,
                                        opacity: isActive ? 1 : 0.6,
                                        transition: 'opacity 0.3s'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                                    onMouseLeave={(e) => e.currentTarget.style.opacity = isActive ? '1' : '0.6'}
                                >
                                    <div style={{
                                        width: '12px',
                                        height: '12px',
                                        borderRadius: '50%',
                                        backgroundColor: entry.is_missing ? '#ef4444' : (entry.is_old_data ? '#9ca3af' : '#3b82f6'),
                                        marginRight: '1rem',
                                        flexShrink: 0
                                    }} />
                                    <div style={{
                                        fontSize: '1rem',
                                        fontWeight: isActive ? 'bold' : 'normal',
                                        display: 'flex',
                                        alignItems: 'center',
                                        flexWrap: 'wrap'
                                    }}>
                                        {formatDateForTimeline(entry.date_updated, entry.week_updated)}
                                        <div 
                                            onClick={(e) => toggleExpand(idx, e)}
                                            style={{ 
                                                width: '10px', 
                                                height: '10px', 
                                                borderRadius: '50%', 
                                                backgroundColor: dotColor, 
                                                marginLeft: '8px',
                                                cursor: 'pointer',
                                                boxShadow: '0 0 0 2px rgba(255,255,255,0.8)'
                                            }}
                                            title={`V${latestVersion} - Click to expand`}
                                        />
                                    </div>
                                </div>
                                
                                {isExpanded && variants.length > 1 && (
                                    <div style={{ paddingLeft: '32px', display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '8px', position: 'relative', zIndex: 1 }}>
                                        {variants.map((v, vIdx) => {
                                            const isVariantActive = isActive && (selectedVariantIndex === vIdx || (selectedVariantIndex === -1 && vIdx === variants.length - 1));
                                            const logDateStr = formatLogDate(v.log_date);
                                            
                                            return (
                                                <div 
                                                    key={vIdx}
                                                    onClick={(e) => handleVariantClick(idx, vIdx, e)}
                                                    title={`Logged at: ${logDateStr}`}
                                                    style={{ 
                                                        fontSize: '0.9rem', 
                                                        color: isVariantActive ? '#000' : '#4b5563',
                                                        fontWeight: isVariantActive ? 'bold' : 'normal',
                                                        cursor: 'pointer',
                                                        opacity: isVariantActive ? 1 : 0.7
                                                    }}
                                                    onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                                                    onMouseLeave={(e) => e.currentTarget.style.opacity = isVariantActive ? '1' : '0.7'}
                                                >
                                                    ↳ {v.version}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                    </div>
                </div>
                
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                    <div style={{
                        flex: 1,
                        backgroundColor: '#ebf2f1',
                        border: '2px solid #3b82f6',
                        padding: '1.5rem',
                        display: 'flex',
                        flexDirection: 'column',
                        position: 'relative'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem', color: '#3b82f6', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span>Previous Week</span>
                                <button onClick={() => setEnlargedModal('previous')} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#3b82f6', display: 'flex', padding: 0 }} title="Enlarge Text">
                                    <Maximize2 size={20} />
                                </button>
                            </div>
                        </div>
                        <div style={{ flex: 1, overflow: 'auto' }}>
                            <JoditEditor
                                value={previousText}
                                config={previousJoditConfig}
                                onBlur={() => {}}
                            />
                        </div>
                    </div>
                    
                    <div style={{
                        flex: 1,
                        backgroundColor: '#ebf2f1',
                        border: '2px solid #22c55e',
                        padding: '1.5rem',
                        display: 'flex',
                        flexDirection: 'column',
                        position: 'relative'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem', color: '#22c55e', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span>Current week</span>
                                <button onClick={() => setEnlargedModal('current')} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#22c55e', display: 'flex', padding: 0 }} title="Enlarge Text">
                                    <Maximize2 size={20} />
                                </button>
                            </div>
                            {canEdit ? (
                                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                    <input 
                                        type="date"
                                        style={{ background: 'transparent', border: 'none', borderBottom: '1px solid #22c55e', color: '#22c55e', fontSize: '1.5rem', textAlign: 'right', outline: 'none', fontWeight: 'bold', fontFamily: 'inherit' }}
                                        value={editableDate}
                                        onChange={(e) => setEditableDate(e.target.value)}
                                        onBlur={(e) => setEditableDate(e.target.value)}
                                    />
                                    <button 
                                        onClick={handleSave} 
                                        style={{ 
                                            padding: '0.4rem 1.2rem', 
                                            backgroundColor: '#22c55e', 
                                            color: 'white', 
                                            border: 'none', 
                                            borderRadius: '6px', 
                                            cursor: 'pointer', 
                                            fontWeight: 'bold',
                                            fontSize: '1rem',
                                            boxShadow: '0 2px 4px rgba(34, 197, 94, 0.2)'
                                        }}
                                    >
                                        Done
                                    </button>
                                </div>
                            ) : (
                                <span>{formatDateDisplay(editableDate)}</span>
                            )}
                        </div>
                        <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
                            <JoditEditor
                                ref={editorRef}
                                value={editableText}
                                config={joditConfig}
                                onChange={(newContent) => { latestTextRef.current = newContent; }}
                                onBlur={(newContent) => {
                                    setEditableText(newContent);
                                    latestTextRef.current = newContent;
                                }}
                            />
                        </div>
                    </div>
                </div>
            </div>
            
            {enlargedModal && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9999,
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                    <div style={{
                        backgroundColor: '#fff', padding: '2rem', borderRadius: '8px',
                        width: '80%', height: '80%', display: 'flex', flexDirection: 'column',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', alignItems: 'center' }}>
                            <h2 style={{ margin: 0, fontSize: '2rem', color: enlargedModal === 'previous' ? '#3b82f6' : '#22c55e' }}>
                                {enlargedModal === 'previous' ? 'Previous Week' : 'Current week'}
                            </h2>
                            <button onClick={() => setEnlargedModal(null)} style={{ cursor: 'pointer', background: 'transparent', border: 'none', color: '#6b7280', display: 'flex' }} title="Close">
                                <X size={32} />
                            </button>
                        </div>
                        <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
                            <JoditEditor
                                ref={enlargedEditorRef}
                                value={enlargedModal === 'previous' ? previousText : editableText}
                                config={enlargedJoditConfig}
                                onChange={(newContent) => { latestTextRef.current = newContent; }}
                                onBlur={(newContent) => {
                                    if (enlargedModal === 'current' && canEdit) {
                                        setEditableText(newContent);
                                        latestTextRef.current = newContent;
                                    }
                                }}
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
