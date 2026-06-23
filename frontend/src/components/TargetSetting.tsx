import { useState, useEffect, useRef } from 'react';
import { Pencil, Trash2, Check, X, ChevronDown, Plus } from 'lucide-react';

interface DropdownOption {
    category: string;
    value: string;
}

interface Target {
    id: string;
    financial_year: string;
    financial_qtr: string;
    category_type: string;
    category_value: string;
    target_value: number;
    ppt_type?: string; // Optional for backward compatibility/new field
    created_at?: string;
}

const CATEGORIES = [
    { key: 'ppt_type', label: 'PPT Type' }, // New First Category
    { key: 'financial_year', label: 'Financial Year' },
    { key: 'financial_qtr', label: 'Financial QTR' },
    { key: 'category_type', label: 'Category Type' },
];

const formatCompactNumber = (num: number): string => {
    if (!num) return '0';
    const formatter = Intl.NumberFormat('en-US', {
        notation: 'compact',
        maximumFractionDigits: 2
    });
    return formatter.format(num);
};

// --- Custom Select Component ---
interface CustomSelectProps {
    label: string;
    options: DropdownOption[];
    value: string;
    onChange: (value: string) => void;
    onDelete?: (option: DropdownOption) => void;
}

const CustomSelect = ({ options, value, onChange, onDelete }: CustomSelectProps) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelect = (val: string) => {
        onChange(val);
        setIsOpen(false);
    };

    return (
        <div
            ref={containerRef}
            style={{ position: 'relative', minWidth: '260px' }}
        >
            {/* Trigger Box */}
            <div
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    padding: '1rem',
                    fontSize: '1.2rem',
                    backgroundColor: '#9ca3af',
                    color: 'white',
                    fontWeight: '800',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    minHeight: '58px' // Approximation of select height
                }}
            >
                <span>{value || 'Select'}</span>
                <ChevronDown size={20} />
            </div>

            {/* Dropdown List */}
            {isOpen && (
                <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    backgroundColor: '#9ca3af', // Match trigger bg
                    color: 'white',
                    zIndex: 50,
                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                    maxHeight: '300px',
                    overflowY: 'auto',
                    borderTop: '1px solid rgba(255,255,255,0.2)'
                }}>
                    <div
                        onClick={() => handleSelect('')}
                        style={{ padding: '0.8rem 1rem', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.1)' }}
                    >
                        Select
                    </div>

                    {options.map((opt) => (
                        <div
                            key={opt.value}
                            style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '0.8rem 1rem',
                                borderBottom: '1px solid rgba(255,255,255,0.1)',
                                backgroundColor: value === opt.value ? '#6b7280' : 'transparent',
                                cursor: 'default' // Default cursor for the row mostly, actionable parts have pointer
                            }}
                        >
                            <span
                                onClick={() => handleSelect(opt.value)}
                                style={{ flex: 1, cursor: 'pointer' }}
                            >
                                {opt.value}
                            </span>

                            {/* Delete Button (X) */}
                            {onDelete && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onDelete(opt);
                                    }}
                                    style={{
                                        background: 'transparent',
                                        border: 'none',
                                        color: '#ffcccc', // Light red for visibility on grey
                                        cursor: 'pointer',
                                        padding: '4px',
                                        display: 'flex',
                                        alignItems: 'center'
                                    }}
                                    title="Remove Option"
                                >
                                    <X size={16} strokeWidth={3} />
                                </button>
                            )}
                        </div>
                    ))}

                    {/* Add New Option */}
                    <div
                        onClick={() => handleSelect('__ADD_NEW__')}
                        style={{
                            padding: '0.8rem 1rem',
                            cursor: 'pointer',
                            fontWeight: '900',
                            color: '#1e3a8a', // Dark Blue text for visibility? Or Keep consistent?
                            // User request image had "+ Add New" in blue. Background is grey though.
                            // Let's make background for this item lighter or just text distinctive.
                            backgroundColor: '#d1d5db',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem'
                        }}
                    >
                        <Plus size={18} strokeWidth={4} /> Add New
                    </div>
                </div>
            )}
        </div>
    );
};


const FilterInput = ({ value, onChange, placeholder }: { value: string, onChange: (val: string) => void, placeholder: string }) => (
    <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
            width: '100%',
            marginTop: '0.5rem',
            padding: '0.5rem',
            fontSize: '0.9rem',
            borderRadius: '6px',
            border: '1px solid #d1d5db',
            outline: 'none'
        }}
    />
);

const EditInput = ({ value, onChange, type = "text" }: { value: string | number, onChange: (val: string) => void, type?: string }) => (
    <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #d1d5db', outline: 'none', fontSize: '1rem' }}
    />
);

export function TargetSetting() {
    const [options, setOptions] = useState<DropdownOption[]>([]);
    const [targets, setTargets] = useState<Target[]>([]);
    const [loading, setLoading] = useState(true);

    // Form State
    const [formData, setFormData] = useState({
        ppt_type: '',
        financial_year: '',
        financial_qtr: '',
        category_type: '',
        base_target: '',
        stretch_target: ''
    });

    // Modal State for adding new options
    const [showAddModal, setShowAddModal] = useState<string | null>(null);
    const [newOptionValue, setNewOptionValue] = useState('');
    const [previousSelections, setPreviousSelections] = useState<Record<string, string>>({});

    // Modal State for DELETING options
    const [optionToDelete, setOptionToDelete] = useState<DropdownOption | null>(null);
    const [deleteConfirmationText, setDeleteConfirmationText] = useState('');

    // Table State
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
    const [newlyAddedId, setNewlyAddedId] = useState<string | null>(null);
    const [editingTargetId, setEditingTargetId] = useState<string | null>(null);
    const [editFormData, setEditFormData] = useState<Partial<Target>>({});
    const [filters, setFilters] = useState({
        submitted_on: '',
        ppt_type: '',
        financial_year: '',
        financial_qtr: '',
        category_type: '',
        category_value: '',
        target_value: ''
    });

    useEffect(() => {
        fetchInitialData();
    }, []);

    const fetchInitialData = async () => {
        try {
            setLoading(true);
            const [optRes, tgtRes] = await Promise.all([
                fetch('/api/admin/options'),
                fetch('/api/admin/targets')
            ]);

            let fetchedOptions: DropdownOption[] = [];
            if (optRes.ok) fetchedOptions = await optRes.json();

            // Define hardcoded defaults
            const defaults: DropdownOption[] = [
                // PPT Type defaults
                { category: 'PPT Type', value: 'Weekly Tracker' },
                { category: 'PPT Type', value: 'Revenue Tracker' },
                // Financial Year defaults
                ...['FY2024', 'FY2025', 'FY2026', 'FY2027', 'FY2028', 'FY2029', 'FY2030'].map(v => ({ category: 'Financial Year', value: v })),
                // QTR defaults
                ...['Q1', 'Q2', 'Q3', 'Q4'].map(v => ({ category: 'Financial QTR', value: v }))
            ];

            // Merge defaults with fetched options, removing duplicates
            const mergedOptions = [...defaults];
            fetchedOptions.forEach(opt => {
                const alreadyExists = mergedOptions.some(m => m.category === opt.category && m.value === opt.value);
                if (!alreadyExists) mergedOptions.push(opt);
            });

            setOptions(mergedOptions);
            if (tgtRes.ok) setTargets(await tgtRes.json());
        } catch (error) {
            console.error("Failed to fetch data", error);
        } finally {
            setLoading(false);
        }
    };

    const handleDropdownChange = (categoryKey: string, value: string) => {
        if (value === '__ADD_NEW__') {
            // Store current selection to revert if modal is cancelled
            setPreviousSelections(prev => ({ ...prev, [categoryKey]: formData[categoryKey as keyof typeof formData] as string }));
            setShowAddModal(categoryKey);
        } else {
            setFormData({ ...formData, [categoryKey]: value });
        }
    };

    const handleAddOption = async () => {
        if (!showAddModal || !newOptionValue.trim()) return;

        try {
            const categoryLabel = CATEGORIES.find(c => c.key === showAddModal)?.label || showAddModal;
            const payload = { category: categoryLabel, value: newOptionValue };

            const res = await fetch('/api/admin/options', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                const newOpt = await res.json();
                setOptions([...options, newOpt]);

                // Auto-select the new value
                setFormData({
                    ...formData,
                    [showAddModal]: newOptionValue
                });

                setNewOptionValue('');
                setShowAddModal(null);
            }
        } catch (error) {
            console.error("Failed to add option", error);
        }
    };

    // --- Delete Option Logic ---
    const confirmDeleteOption = async () => {
        if (!optionToDelete) return;
        if (deleteConfirmationText.toLowerCase() !== 'confirm') {
            alert("Type 'confirm' to delete.");
            return;
        }

        try {
            const res = await fetch(`/api/admin/options?category=${encodeURIComponent(optionToDelete.category)}&value=${encodeURIComponent(optionToDelete.value)}`, {
                method: 'DELETE'
            });

            if (res.ok) {
                // Remove from local state
                setOptions(options.filter(o => !(o.category === optionToDelete.category && o.value === optionToDelete.value)));

                // If the deleted value was selected, clear it
                // We need to map category label back to form key
                const catDef = CATEGORIES.find(c => c.label === optionToDelete.category);
                if (catDef && formData[catDef.key as keyof typeof formData] === optionToDelete.value) {
                    setFormData({ ...formData, [catDef.key]: '' });
                }

                // Close modal
                setOptionToDelete(null);
                setDeleteConfirmationText('');
            } else {
                alert("Failed to delete option.");
            }
        } catch (err) {
            console.error(err);
            alert("Error deleting option.");
        }
    };

    const handleModalCancel = () => {
        if (showAddModal) {
            const prevValue = previousSelections[showAddModal] || '';
            setFormData({ ...formData, [showAddModal]: prevValue });
            setShowAddModal(null);
            setNewOptionValue('');
        }
        // Also handle delete modal close here if needed, but better separable
    };

    const handleSubmit = async () => {
        if (!formData.financial_year || !formData.financial_qtr || !formData.base_target || !formData.stretch_target || !formData.ppt_type) {
            alert("Please fill all required fields (PPT Type, Year, QTR, Base Target, and Stretch Target)");
            return;
        }

        try {
            // Create TWO payloads - one for base target, one for stretch target
            const basePayload = {
                financial_year: formData.financial_year,
                financial_qtr: formData.financial_qtr,
                category_type: formData.category_type,
                category_value: 'base target',
                target_value: Number(formData.base_target),
                ppt_type: formData.ppt_type
            };

            const stretchPayload = {
                financial_year: formData.financial_year,
                financial_qtr: formData.financial_qtr,
                category_type: formData.category_type,
                category_value: 'Stretch Target',
                target_value: Number(formData.stretch_target),
                ppt_type: formData.ppt_type
            };

            // Submit both targets
            const [baseRes, stretchRes] = await Promise.all([
                fetch('/api/admin/targets', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(basePayload)
                }),
                fetch('/api/admin/targets', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(stretchPayload)
                })
            ]);

            if (baseRes.ok && stretchRes.ok) {
                const baseData = await baseRes.json();
                await stretchRes.json();

                // Only clear target inputs, keep dropdown selections
                setFormData({
                    ...formData,
                    base_target: '',
                    stretch_target: ''
                });

                const freshTargetsRes = await fetch('/api/admin/targets');
                if (freshTargetsRes.ok) {
                    const freshData = await freshTargetsRes.json();
                    setTargets(freshData);

                    // Highlight both newly added rows
                    setNewlyAddedId(baseData.id);
                    setTimeout(() => setNewlyAddedId(null), 10000);
                }
            } else {
                const baseText = baseRes.ok ? 'OK' : await baseRes.text();
                const stretchText = stretchRes.ok ? 'OK' : await stretchRes.text();
                alert(`Submission Failed:\nBase Target: ${baseText}\nStretch Target: ${stretchText}`);
            }
        } catch (error) {
            console.error("Failed to submit targets", error);
            alert("Error: Could not connect to the server.");
        }
    };

    const handleDelete = async (id: string) => {
        try {
            const res = await fetch(`/api/admin/targets/${id}`, { method: 'DELETE' });
            if (res.ok) {
                setTargets(targets.filter(t => t.id !== id));
                setDeleteConfirmId(null);
            }
        } catch (error) {
            console.error("Failed to delete", error);
        }
    };

    const handleEditSave = async (id: string) => {
        try {
            const res = await fetch(`/api/admin/targets/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    financial_year: editFormData.financial_year,
                    financial_qtr: editFormData.financial_qtr,
                    category_type: editFormData.category_type,
                    category_value: editFormData.category_value,
                    target_value: editFormData.target_value,
                    ppt_type: editFormData.ppt_type
                })
            });
            if (res.ok) {
                setTargets(targets.map(t =>
                    t.id === id ? { ...t, ...editFormData } as Target : t
                ));
                setEditingTargetId(null);
            } else {
                alert("Failed to update target.");
            }
        } catch (error) {
            console.error("Failed to update target", error);
            alert("Error updating target.");
        }
    };

    const getOptionsFor = (label: string) => options.filter(o => o.category === label);

    const getFilteredAndSortedTargets = () => {
        let result = [...targets];
        result = result.filter(t => {
            const formattedDate = t.created_at ? new Date(t.created_at).toLocaleString() : '';
            return (
                formattedDate.toLowerCase().includes(filters.submitted_on.toLowerCase()) &&
                (t.ppt_type || '').toLowerCase().includes(filters.ppt_type.toLowerCase()) &&
                t.financial_year.toLowerCase().includes(filters.financial_year.toLowerCase()) &&
                t.financial_qtr.toLowerCase().includes(filters.financial_qtr.toLowerCase()) &&
                t.category_type.toLowerCase().includes(filters.category_type.toLowerCase()) &&
                t.category_value.toLowerCase().includes(filters.category_value.toLowerCase()) &&
                t.target_value.toString().includes(filters.target_value)
            );
        });
        result.sort((a, b) => {
            const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
            const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
            return dateB - dateA;
        });
        return result;
    };

    const filteredTargets = getFilteredAndSortedTargets();

    if (loading) return <div style={{ padding: '2rem', textAlign: 'center', fontSize: '1.5rem', fontWeight: '800', color: '#4a4a55' }}>Loading...</div>;

    return (
        <div style={{ marginTop: '2rem' }}>
            {/* Inputs Section */}
            <div style={{
                display: 'flex',
                gap: '2.5rem',
                alignItems: 'flex-start',
                flexWrap: 'wrap',
                marginBottom: '2rem'
            }}>
                {CATEGORIES.map((cat) => (
                    <div key={cat.key} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        <div style={{ fontWeight: '900', fontSize: '1.4rem', color: '#000000' }}>{cat.label}</div>
                        <CustomSelect
                            label={cat.label}
                            options={getOptionsFor(cat.label)}
                            value={formData[cat.key as keyof typeof formData]}
                            onChange={(val) => handleDropdownChange(cat.key, val)}
                            onDelete={(opt) => {
                                setOptionToDelete(opt);
                                setDeleteConfirmationText('');
                            }}
                        />
                    </div>
                ))}

                {/* Base Target Input */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <div style={{ fontWeight: '900', fontSize: '1.4rem', color: '#000000' }}>
                        Base Target <span style={{ fontSize: '1rem', fontWeight: '600' }}>(actual numbers)</span>
                    </div>
                    <input
                        type="number"
                        style={{
                            padding: '1rem',
                            fontSize: '1.2rem',
                            width: '260px',
                            minHeight: '58px', // Match select height
                            backgroundColor: '#9ca3af',
                            border: 'none',
                            color: 'white',
                            fontWeight: '800',
                            outline: 'none'
                        }}
                        value={formData.base_target}
                        onChange={(e) => setFormData({ ...formData, base_target: e.target.value })}
                    />
                </div>

                {/* Stretch Target Input */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <div style={{ fontWeight: '900', fontSize: '1.4rem', color: '#000000' }}>
                        Stretch Target <span style={{ fontSize: '1rem', fontWeight: '600' }}>(actual numbers)</span>
                    </div>
                    <input
                        type="number"
                        style={{
                            padding: '1rem',
                            fontSize: '1.2rem',
                            width: '260px',
                            minHeight: '58px', // Match select height
                            backgroundColor: '#9ca3af',
                            border: 'none',
                            color: 'white',
                            fontWeight: '800',
                            outline: 'none'
                        }}
                        value={formData.stretch_target}
                        onChange={(e) => setFormData({ ...formData, stretch_target: e.target.value })}
                    />
                </div>
            </div>

            {/* Action Buttons */}
            <div style={{
                display: 'flex',
                justifyContent: 'center',
                gap: '2rem',
                marginTop: '3rem',
                marginBottom: '4rem'
            }}>
                <button
                    onClick={(e) => {
                        e.preventDefault();
                        handleSubmit();
                    }}
                    style={{
                        padding: '0.8rem 3rem',
                        backgroundColor: '#4775d1', // Rich Blue
                        color: 'white',
                        border: '3px solid #1a52c3',
                        borderRadius: '9999px',
                        fontWeight: '800',
                        fontSize: '1.5rem',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        boxShadow: '0 4px 8px rgba(37, 99, 235, 0.3)'
                    }}
                >
                    Submit
                </button>
                <button
                    onClick={() => {
                        if (confirm("Clear current selections for a new target?")) {
                            setFormData({
                                ppt_type: '',
                                financial_year: '',
                                financial_qtr: '',
                                category_type: '',
                                base_target: '',
                                stretch_target: ''
                            });
                        }
                    }}
                    style={{
                        padding: '0.8rem 3rem',
                        backgroundColor: '#888888',
                        color: 'white',
                        border: '3px solid #555555',
                        borderRadius: '9999px',
                        fontWeight: '800',
                        fontSize: '1.5rem',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        boxShadow: '0 4px 8px rgba(0,0,0,0.15)'
                    }}
                >
                    New target
                </button>
            </div>

            {/* Active Targets Table */}
            <h2 style={{ fontSize: '3rem', fontWeight: '800', color: '#4a4a55', marginBottom: '2.5rem' }}>
                Active Targets
            </h2>

            <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                        <tr style={{ borderBottom: '3px solid #d1d5db' }}>
                            <th style={{ padding: '1.2rem', fontSize: '1.3rem', fontWeight: '800', color: '#1f2937' }}>
                                Submitted On
                                <FilterInput value={filters.submitted_on} onChange={v => setFilters({ ...filters, submitted_on: v })} placeholder="Filter date..." />
                            </th>
                            <th style={{ padding: '1.2rem', fontSize: '1.3rem', fontWeight: '800', color: '#1f2937' }}>
                                PPT Type
                                <FilterInput value={filters.ppt_type} onChange={v => setFilters({ ...filters, ppt_type: v })} placeholder="Filter type..." />
                            </th>
                            <th style={{ padding: '1.2rem', fontSize: '1.3rem', fontWeight: '800', color: '#1f2937' }}>
                                Financial Year
                                <FilterInput value={filters.financial_year} onChange={v => setFilters({ ...filters, financial_year: v })} placeholder="Filter year..." />
                            </th>
                            <th style={{ padding: '1.2rem', fontSize: '1.3rem', fontWeight: '800', color: '#1f2937' }}>
                                Financial QTR
                                <FilterInput value={filters.financial_qtr} onChange={v => setFilters({ ...filters, financial_qtr: v })} placeholder="Filter QTR..." />
                            </th>
                            <th style={{ padding: '1.2rem', fontSize: '1.3rem', fontWeight: '800', color: '#1f2937' }}>
                                Category Type
                                <FilterInput value={filters.category_type} onChange={v => setFilters({ ...filters, category_type: v })} placeholder="Filter type..." />
                            </th>
                            <th style={{ padding: '1.2rem', fontSize: '1.3rem', fontWeight: '800', color: '#1f2937' }}>
                                Category Value
                                <FilterInput value={filters.category_value} onChange={v => setFilters({ ...filters, category_value: v })} placeholder="Filter value..." />
                            </th>
                            <th style={{ padding: '1.2rem', fontSize: '1.3rem', fontWeight: '800', color: '#1f2937' }}>
                                Target
                                <FilterInput value={filters.target_value} onChange={v => setFilters({ ...filters, target_value: v })} placeholder="Filter..." />
                            </th>
                            <th style={{ padding: '1.2rem', fontSize: '1.3rem', fontWeight: '800', color: '#1f2937' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredTargets.map(target => (
                            <tr
                                key={target.id}
                                className={target.id === newlyAddedId ? 'new-row-highlight' : ''}
                                style={{ borderBottom: '1px solid #d1d5db' }}
                            >
                                <td style={{ padding: '1.5rem 1.2rem', fontSize: '1.1rem', fontWeight: '700', color: '#374151' }}>
                                    {target.created_at ? new Date(target.created_at).toLocaleString() : '-'}
                                </td>
                                <td style={{ padding: '1.5rem 1.2rem', fontSize: '1.1rem', fontWeight: '700', color: '#374151' }}>
                                    {editingTargetId === target.id ? (
                                        <EditInput value={editFormData.ppt_type || ''} onChange={(v) => setEditFormData(prev => ({ ...prev, ppt_type: v }))} />
                                    ) : (target.ppt_type || '-')}
                                </td>
                                <td style={{ padding: '1.5rem 1.2rem', fontSize: '1.1rem', fontWeight: '700', color: '#374151' }}>
                                    {editingTargetId === target.id ? (
                                        <EditInput value={editFormData.financial_year || ''} onChange={(v) => setEditFormData(prev => ({ ...prev, financial_year: v }))} />
                                    ) : target.financial_year}
                                </td>
                                <td style={{ padding: '1.5rem 1.2rem', fontSize: '1.1rem', fontWeight: '700', color: '#374151' }}>
                                    {editingTargetId === target.id ? (
                                        <EditInput value={editFormData.financial_qtr || ''} onChange={(v) => setEditFormData(prev => ({ ...prev, financial_qtr: v }))} />
                                    ) : target.financial_qtr}
                                </td>
                                <td style={{ padding: '1.5rem 1.2rem', fontSize: '1.1rem', fontWeight: '700', color: '#374151' }}>
                                    {editingTargetId === target.id ? (
                                        <EditInput value={editFormData.category_type || ''} onChange={(v) => setEditFormData(prev => ({ ...prev, category_type: v }))} />
                                    ) : target.category_type}
                                </td>
                                <td style={{ padding: '1.5rem 1.2rem', fontSize: '1.1rem', fontWeight: '700', color: '#374151' }}>
                                    {editingTargetId === target.id ? (
                                        <EditInput value={editFormData.category_value || ''} onChange={(v) => setEditFormData(prev => ({ ...prev, category_value: v }))} />
                                    ) : target.category_value}
                                </td>
                                <td style={{ padding: '1.5rem 1.2rem', fontSize: '1.1rem', fontWeight: '700', color: '#374151' }}>
                                    {editingTargetId === target.id ? (
                                        <EditInput type="number" value={editFormData.target_value ?? ''} onChange={(v) => setEditFormData(prev => ({ ...prev, target_value: Number(v) }))} />
                                    ) : formatCompactNumber(target.target_value)}
                                </td>
                                <td style={{ padding: '1.5rem 1.2rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                    {editingTargetId === target.id ? (
                                        <>
                                            <button
                                                onClick={() => handleEditSave(target.id)}
                                                style={{
                                                    width: '40px',
                                                    height: '40px',
                                                    borderRadius: '50%',
                                                    backgroundColor: 'rgba(34, 197, 94, 0.2)',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    border: 'none',
                                                    cursor: 'pointer',
                                                    color: '#15803d',
                                                    transition: 'all 0.2s'
                                                }}
                                                title="Save Changes"
                                            >
                                                <Check size={20} strokeWidth={3} />
                                            </button>
                                            <button
                                                onClick={() => {
                                                    setEditingTargetId(null);
                                                    setEditFormData({});
                                                }}
                                                style={{
                                                    width: '40px',
                                                    height: '40px',
                                                    borderRadius: '50%',
                                                    backgroundColor: 'rgba(107, 114, 128, 0.2)',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    border: 'none',
                                                    cursor: 'pointer',
                                                    color: '#4b5563',
                                                    transition: 'all 0.2s'
                                                }}
                                                title="Cancel Editing"
                                            >
                                                <X size={20} strokeWidth={3} />
                                            </button>
                                        </>
                                    ) : (
                                        <button
                                            onClick={() => {
                                                setEditingTargetId(target.id);
                                                setEditFormData(target);
                                            }}
                                            style={{
                                                width: '40px',
                                                height: '40px',
                                                borderRadius: '50%',
                                                backgroundColor: 'rgba(107, 114, 128, 0.4)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                border: 'none',
                                                cursor: 'pointer',
                                                color: 'black',
                                                transition: 'all 0.2s'
                                            }}
                                            title="Edit Target"
                                        >
                                            <Pencil size={20} strokeWidth={2.5} />
                                        </button>
                                    )}

                                    {deleteConfirmId === target.id ? (
                                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                            <button
                                                onClick={() => handleDelete(target.id)}
                                                style={{
                                                    width: '40px',
                                                    height: '40px',
                                                    borderRadius: '50%',
                                                    backgroundColor: 'rgba(239, 68, 68, 0.5)',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    border: 'none',
                                                    cursor: 'pointer',
                                                    color: '#ff0000',
                                                }}
                                            >
                                                <Check size={20} strokeWidth={3} />
                                            </button>
                                            <button
                                                onClick={() => setDeleteConfirmId(null)}
                                                style={{
                                                    width: '40px',
                                                    height: '40px',
                                                    borderRadius: '50%',
                                                    backgroundColor: 'rgba(107, 114, 128, 0.3)',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    border: 'none',
                                                    cursor: 'pointer',
                                                    color: '#374151',
                                                }}
                                            >
                                                <X size={20} strokeWidth={3} />
                                            </button>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => setDeleteConfirmId(target.id)}
                                            style={{
                                                width: '40px',
                                                height: '40px',
                                                borderRadius: '50%',
                                                backgroundColor: 'rgba(239, 68, 68, 0.4)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                border: 'none',
                                                cursor: 'pointer',
                                                color: '#ff2020',
                                                transition: 'all 0.2s'
                                            }}
                                        >
                                            <Trash2 size={20} strokeWidth={2.5} />
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                        {filteredTargets.length === 0 && (
                            <tr>
                                <td colSpan={8} style={{ padding: '3rem', textAlign: 'center', fontSize: '1.2rem', color: '#9ca3af' }}>
                                    No targets found matching filters.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Add Category Modal */}
            {showAddModal && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.6)',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    zIndex: 1000,
                    backdropFilter: 'blur(4px)'
                }}>
                    <div style={{
                        backgroundColor: 'white',
                        padding: '3rem',
                        borderRadius: '20px',
                        width: '450px',
                        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
                    }}>
                        <h3 style={{ fontSize: '1.8rem', fontWeight: '800', marginBottom: '2rem', color: '#1f2937' }}>
                            Add {CATEGORIES.find(c => c.key === showAddModal)?.label}
                        </h3>
                        <input
                            autoFocus
                            style={{
                                width: '100%',
                                padding: '1rem',
                                fontSize: '1.1rem',
                                border: '3px solid #e5e7eb',
                                borderRadius: '12px',
                                marginBottom: '2rem',
                                outline: 'none'
                            }}
                            value={newOptionValue}
                            onChange={(e) => setNewOptionValue(e.target.value)}
                            placeholder="e.g. FY2026, Q1, Project Alpha..."
                            onKeyUp={(e) => e.key === 'Enter' && handleAddOption()}
                        />
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1.5rem' }}>
                            <button
                                onClick={handleModalCancel}
                                style={{
                                    padding: '0.8rem 2rem',
                                    border: 'none',
                                    background: '#f3f4f6',
                                    borderRadius: '10px',
                                    fontWeight: '700',
                                    fontSize: '1rem',
                                    cursor: 'pointer'
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleAddOption}
                                style={{
                                    padding: '0.8rem 2rem',
                                    border: 'none',
                                    background: '#2563eb',
                                    color: 'white',
                                    borderRadius: '10px',
                                    fontWeight: '700',
                                    fontSize: '1rem',
                                    cursor: 'pointer'
                                }}
                            >
                                Add Value
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* DELETE OPTION CONFIRMATION MODAL */}
            {optionToDelete && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.6)',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    zIndex: 1000,
                    backdropFilter: 'blur(4px)'
                }}>
                    <div style={{
                        backgroundColor: 'white',
                        padding: '3rem',
                        borderRadius: '20px',
                        width: '500px',
                        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
                    }}>
                        <h3 style={{ fontSize: '1.8rem', fontWeight: '800', marginBottom: '1rem', color: '#B91C1C' }}>
                            Delete "{optionToDelete.value}"?
                        </h3>
                        <p style={{ fontSize: '1.1rem', color: '#4b5563', marginBottom: '2rem' }}>
                            This cannot be undone. To confirm deletion, type <strong>confirm</strong> in the box below.
                        </p>

                        <input
                            autoFocus
                            style={{
                                width: '100%',
                                padding: '1rem',
                                fontSize: '1.1rem',
                                border: '3px solid #e5e7eb',
                                borderRadius: '12px',
                                marginBottom: '2rem',
                                outline: 'none'
                            }}
                            value={deleteConfirmationText}
                            onChange={(e) => setDeleteConfirmationText(e.target.value)}
                            placeholder="Type 'confirm'"
                            onKeyUp={(e) => e.key === 'Enter' && confirmDeleteOption()}
                        />

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1.5rem' }}>
                            <button
                                onClick={() => {
                                    setOptionToDelete(null);
                                    setDeleteConfirmationText('');
                                }}
                                style={{
                                    padding: '0.8rem 2rem',
                                    border: 'none',
                                    background: '#f3f4f6',
                                    borderRadius: '10px',
                                    fontWeight: '700',
                                    fontSize: '1rem',
                                    cursor: 'pointer'
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmDeleteOption}
                                disabled={deleteConfirmationText.toLowerCase() !== 'confirm'}
                                style={{
                                    padding: '0.8rem 2rem',
                                    border: 'none',
                                    background: deleteConfirmationText.toLowerCase() === 'confirm' ? '#DC2626' : '#9ca3af',
                                    color: 'white',
                                    borderRadius: '10px',
                                    fontWeight: '700',
                                    fontSize: '1rem',
                                    cursor: deleteConfirmationText.toLowerCase() === 'confirm' ? 'pointer' : 'not-allowed',
                                    transition: 'background 0.2s'
                                }}
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
