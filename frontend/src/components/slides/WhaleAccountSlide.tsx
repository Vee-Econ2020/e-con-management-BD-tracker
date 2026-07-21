import { useState, useEffect } from 'react';

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
}

export function WhaleAccountSlide({ isEditing, region }: WhaleAccountSlideProps) {
    const [accountNames, setAccountNames] = useState<string[]>([]);
    const [selectedAccount, setSelectedAccount] = useState<string>('');
    const [isCreatingNew, setIsCreatingNew] = useState(false);
    const [newAccountName, setNewAccountName] = useState('');
    
    const [entries, setEntries] = useState<WhaleAccountEntry[]>([]);
    const [selectedIndex, setSelectedIndex] = useState<number>(-1);
    
    const [expandedDates, setExpandedDates] = useState<Record<string, boolean>>({});
    const [selectedVariantIndex, setSelectedVariantIndex] = useState<number>(-1);
    
    const [currentWeek, setCurrentWeek] = useState<number | null>(null);
    
    // Form state for current selected/edited entry
    const [editableText, setEditableText] = useState('');
    const [editableDate, setEditableDate] = useState('');

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
            
            // Ensure data is always sorted from newest to oldest
            const sortedData = data.sort((a: WhaleAccountEntry, b: WhaleAccountEntry) => {
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
                setEditableDate(sortedData[0].date_updated);
            } else {
                setSelectedIndex(-1);
                setSelectedVariantIndex(-1);
                setEditableText('');
                const today = new Date().toISOString().split('T')[0];
                setEditableDate(today);
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
        setEditableDate(entry.date_updated);
    };

    const handleVariantClick = (entryIndex: number, variantIndex: number, e: React.MouseEvent) => {
        e.stopPropagation();
        setSelectedIndex(entryIndex);
        setSelectedVariantIndex(variantIndex);
        
        const entry = entries[entryIndex];
        const variants = entry.variants || [];
        
        setEditableText(variants[variantIndex].text_data);
        setEditableDate(entry.date_updated);
    };

    const toggleExpand = (index: number, e: React.MouseEvent) => {
        e.stopPropagation();
        setExpandedDates(prev => ({
            ...prev,
            [index]: !prev[index]
        }));
    };

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

    const handleSave = async () => {
        if (!selectedAccount || currentWeek === null) return;
        
        const payload: WhaleAccountEntry = {
            account_name: selectedAccount,
            date_updated: editableDate,
            week_updated: getWeekNumber(editableDate) || currentWeek,
            text_data: editableText,
            region: region
        };
        
        const existingEntry = entries.find(e => e.date_updated === editableDate);
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

    // Derived Data
    const previousEntry = selectedIndex >= 0 && selectedIndex + 1 < entries.length ? entries[selectedIndex + 1] : null;
    let previousText = '';
    if (previousEntry) {
        const prevVariants = previousEntry.variants || [];
        previousText = prevVariants.length > 0 ? prevVariants[prevVariants.length - 1].text_data : (previousEntry.text_data || '');
    }
    
    const currentEntry = selectedIndex >= 0 ? entries[selectedIndex] : null;
    let canEdit = isEditing;
    if (currentEntry && currentEntry.date_updated === editableDate) {
        if ((currentEntry.variants || []).length >= 3) {
            canEdit = false;
        }
    }

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
                                        backgroundColor: '#3b82f6',
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
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem', color: '#3b82f6' }}>
                            <span>Previous Week</span>
                        </div>
                        <textarea 
                            readOnly 
                            value={previousText} 
                            placeholder={previousEntry ? '' : 'No previous week data'}
                            style={{
                                flex: 1,
                                background: 'transparent',
                                border: 'none',
                                outline: 'none',
                                resize: 'none',
                                fontSize: '1.25rem',
                                fontFamily: 'inherit',
                                color: '#000'
                            }}
                        />
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
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem', color: '#22c55e' }}>
                            <span>Current week</span>
                            {canEdit ? (
                                <input 
                                    type="date"
                                    style={{ background: 'transparent', border: 'none', borderBottom: '1px solid #22c55e', color: '#22c55e', fontSize: '1.5rem', textAlign: 'right', outline: 'none', fontWeight: 'bold', fontFamily: 'inherit' }}
                                    value={editableDate}
                                    onChange={(e) => setEditableDate(e.target.value)}
                                    onBlur={handleSave}
                                />
                            ) : (
                                <span>{formatDateDisplay(editableDate)}</span>
                            )}
                        </div>
                        <textarea 
                            readOnly={!canEdit}
                            value={editableText}
                            onChange={(e) => setEditableText(e.target.value)}
                            onBlur={handleSave}
                            placeholder={canEdit ? 'Type here...' : ''}
                            style={{
                                flex: 1,
                                background: 'transparent',
                                border: 'none',
                                outline: 'none',
                                resize: 'none',
                                fontSize: '1.25rem',
                                fontFamily: 'inherit',
                                color: '#000'
                            }}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
