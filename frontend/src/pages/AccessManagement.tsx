import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

function formatRelativeTime(isoStr?: string): string {
    if (!isoStr) return 'Never';
    try {
        const utcStr = (isoStr.endsWith('Z') || isoStr.includes('+')) ? isoStr : (isoStr + 'Z');
        const date = new Date(utcStr);
        const diffMs = Date.now() - date.getTime();
        if (isNaN(diffMs) || diffMs < 0) return 'Just now';
        const diffMins = Math.floor(diffMs / 60000);
        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
        const diffHours = Math.floor(diffMins / 60);
        if (diffHours < 24) return `${diffHours} hr${diffHours > 1 ? 's' : ''} ago`;
        return date.toLocaleDateString('en-US', { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' });
    } catch (e) {
        return isoStr;
    }
}

function formatLockDuration(totalSeconds: number): string {
    const mins = Math.floor(Math.max(0, totalSeconds) / 60);
    const secs = Math.max(0, totalSeconds) % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export default function AccessManagement() {
    const { token } = useAuth();
    const [activeTab, setActiveTab] = useState('pending');
    const [pendingRequests, setPendingRequests] = useState<any[]>([]);
    const [activeUsers, setActiveUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');

    // Approval / Edit Modal State
    const [showModal, setShowModal] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [selectedUser, setSelectedUser] = useState<any>(null);
    // Custom Role & Sub-Role States
    const [role, setRole] = useState('Sales');
    const [isCustomRole, setIsCustomRole] = useState(false);
    const [customRoleInput, setCustomRoleInput] = useState('');

    const [subRole, setSubRole] = useState('None');
    const [isCustomSubRole, setIsCustomSubRole] = useState(false);
    const [customSubRoleInput, setCustomSubRoleInput] = useState('');

    const [trackerAccess, setTrackerAccess] = useState<string[]>([]);
    const [symbPermissions, setSymbPermissions] = useState<string[]>([]);
    const [generatedPassword, setGeneratedPassword] = useState('');

    // Multi-select state for active users
    const [selectedEmails, setSelectedEmails] = useState<string[]>([]);

    // Column Filters State
    const [columnFilters, setColumnFilters] = useState({
        email: '',
        department: '',
        role: '',
        passwordStatus: 'all',
        activity: 'all'
    });

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(50);

    const resetFilters = () => {
        setColumnFilters({
            email: '',
            department: '',
            role: '',
            passwordStatus: 'all',
            activity: 'all'
        });
        setCurrentPage(1);
    };

    const isFilterActive = 
        Boolean(columnFilters.email.trim()) ||
        Boolean(columnFilters.department.trim()) ||
        Boolean(columnFilters.role.trim()) ||
        columnFilters.passwordStatus !== 'all' ||
        columnFilters.activity !== 'all';

    // Data Update Lock State
    const [dataLockState, setDataLockState] = useState<any>({
        is_locked: false,
        is_edit_allowed: true,
        is_temp_unlocked: false,
        temp_remaining_seconds: 0,
        temp_unlocked_until: null,
        standard_allowed: true,
        unlocked_by: null,
        start_time: '00:00',
        end_time: '14:00'
    });
    const [unlockLoading, setUnlockLoading] = useState(false);
    const [lockStartTime, setLockStartTime] = useState('00:00');
    const [lockEndTime, setLockEndTime] = useState('14:00');
    const [updatingLockWindow, setUpdatingLockWindow] = useState(false);

    const fetchLockStatus = async () => {
        try {
            const res = await fetch('/api/access/data-lock-status', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setDataLockState(data);
                if (data.start_time) setLockStartTime(data.start_time);
                if (data.end_time) setLockEndTime(data.end_time);
            }
        } catch (e) {
            console.error("Failed to fetch data lock status", e);
        }
    };

    const handleUpdateLockWindow = async () => {
        setUpdatingLockWindow(true);
        setError('');
        setSuccessMessage('');
        try {
            const res = await fetch('/api/access/update-lock-window', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    start_time: lockStartTime,
                    end_time: lockEndTime
                })
            });
            const data = await res.json();
            if (res.ok) {
                setSuccessMessage(data.message || 'Data update lock window updated successfully!');
                fetchLockStatus();
            } else {
                setError(data.detail || 'Failed to update lock window');
            }
        } catch (e) {
            setError('Network error trying to update lock window');
        } finally {
            setUpdatingLockWindow(false);
        }
    };

    const handleUnlockDataLock = async () => {
        setUnlockLoading(true);
        setError('');
        try {
            const res = await fetch('/api/access/unlock-data-lock', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (res.ok) {
                setSuccessMessage(data.message || 'Data update lock temporarily unlocked for 10 minutes!');
                fetchLockStatus();
            } else {
                setError(data.detail || 'Failed to unlock data lock');
            }
        } catch (e) {
            setError('Network error trying to unlock data lock');
        } finally {
            setUnlockLoading(false);
        }
    };

    useEffect(() => {
        setSelectedEmails([]);
        resetFilters();
        fetchData();
        fetchLockStatus();

        const interval = setInterval(() => {
            fetchData();
            fetchLockStatus();
        }, 15000);

        return () => clearInterval(interval);
    }, [activeTab]);

    useEffect(() => {
        if (!dataLockState.is_temp_unlocked || dataLockState.temp_remaining_seconds <= 0) return;

        const timer = setInterval(() => {
            setDataLockState((prev: any) => {
                const nextSec = prev.temp_remaining_seconds - 1;
                if (nextSec <= 0) {
                    fetchLockStatus();
                    return { ...prev, is_temp_unlocked: false, temp_remaining_seconds: 0 };
                }
                return { ...prev, temp_remaining_seconds: nextSec };
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [dataLockState.is_temp_unlocked, dataLockState.temp_remaining_seconds]);


    const rawList = activeTab === 'pending' ? pendingRequests : activeUsers;

    const filteredUsers = rawList.filter(user => {
        if (columnFilters.email.trim() && !user.email?.toLowerCase().includes(columnFilters.email.toLowerCase().trim())) {
            return false;
        }
        if (columnFilters.department.trim()) {
            const deptText = `${user.department || ''} ${user.requested_pages?.join(' ') || ''}`;
            if (!deptText.toLowerCase().includes(columnFilters.department.toLowerCase().trim())) {
                return false;
            }
        }
        if (activeTab === 'active' && columnFilters.role.trim()) {
            const roleText = `${user.role || ''} ${user.sub_role || ''}`;
            if (!roleText.toLowerCase().includes(columnFilters.role.toLowerCase().trim())) {
                return false;
            }
        }
        if (activeTab === 'active' && columnFilters.passwordStatus !== 'all') {
            if (columnFilters.passwordStatus === 'changed' && !user.password_changed) return false;
            if (columnFilters.passwordStatus === 'default' && user.password_changed) return false;
        }
        if (activeTab === 'active' && columnFilters.activity !== 'all') {
            if (columnFilters.activity === 'live' && !user.is_live) return false;
            if (columnFilters.activity === 'offline' && user.is_live) return false;
        }
        return true;
    });

    const totalFiltered = filteredUsers.length;
    const totalPages = pageSize > 0 ? Math.ceil(totalFiltered / pageSize) || 1 : 1;
    const safeCurrentPage = Math.min(currentPage, totalPages);
    const paginatedUsers = pageSize > 0 
        ? filteredUsers.slice((safeCurrentPage - 1) * pageSize, safeCurrentPage * pageSize)
        : filteredUsers;

    const toggleSelectUser = (email: string) => {
        setSelectedEmails(prev => 
            prev.includes(email) ? prev.filter(e => e !== email) : [...prev, email]
        );
    };

    const toggleSelectAll = () => {
        const filteredEmails = filteredUsers.map(u => u.email);
        const allSelected = filteredEmails.length > 0 && filteredEmails.every(e => selectedEmails.includes(e));
        if (allSelected) {
            setSelectedEmails(prev => prev.filter(e => !filteredEmails.includes(e)));
        } else {
            setSelectedEmails(prev => Array.from(new Set([...prev, ...filteredEmails])));
        }
    };

    const handleDeleteSelectedUsers = async (emailsToDelete?: string[]) => {
        const targets = emailsToDelete || selectedEmails;
        if (targets.length === 0) return;

        const confirmMsg = targets.length === 1
            ? `Are you sure you want to delete user ${targets[0]}? This will revoke their access permanently.`
            : `Are you sure you want to delete ${targets.length} selected user(s)? This will revoke their access permanently.`;

        if (!window.confirm(confirmMsg)) return;

        try {
            const res = await fetch('/api/access/delete-users', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ emails: targets })
            });

            const data = await res.json();
            if (res.ok) {
                setSuccessMessage(`Successfully deleted ${data.deleted_count || targets.length} user(s)!`);
                setSelectedEmails([]);
                fetchData();
            } else {
                setError(data.detail || 'Failed to delete user(s)');
            }
        } catch (err) {
            setError('Network error during deletion');
        }
    };

    const fetchData = async () => {
        setLoading(true);
        setError('');
        try {
            const endpoint = activeTab === 'pending' ? '/api/access/pending-requests' : '/api/access/active-users';
            const res = await fetch(endpoint, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                if (activeTab === 'pending') setPendingRequests(data);
                else setActiveUsers(data);
            } else {
                setError('Failed to fetch data');
            }
        } catch (err) {
            setError('Network error');
        } finally {
            setLoading(false);
        }
    };

    const handleApproveClick = (user: any) => {
        setSelectedUser(user);
        const standardRoles = ['Sales', 'Production', 'Management', 'Admin'];
        const standardSubRoles = ['None', 'PMO', 'Production', 'Logistics', 'Quality'];

        const userRole = user.role || 'Sales';
        if (!standardRoles.includes(userRole)) {
            setRole('__CUSTOM__');
            setIsCustomRole(true);
            setCustomRoleInput(userRole);
        } else {
            setRole(userRole);
            setIsCustomRole(false);
            setCustomRoleInput('');
        }

        const userSubRole = user.sub_role || 'None';
        if (!standardSubRoles.includes(userSubRole) && userSubRole !== 'undefined') {
            setSubRole('__CUSTOM__');
            setIsCustomSubRole(true);
            setCustomSubRoleInput(userSubRole);
        } else {
            setSubRole(userSubRole === 'undefined' ? 'None' : userSubRole);
            setIsCustomSubRole(false);
            setCustomSubRoleInput('');
        }

        // Pre-check any requested pages
        const accessList = [...(user.tracker_access || [])];
        if (user.requested_pages && Array.isArray(user.requested_pages)) {
            user.requested_pages.forEach((p: string) => {
                if (!accessList.includes(p)) {
                    accessList.push(p);
                }
            });
        }

        setTrackerAccess(accessList);
        setSymbPermissions(user.symb_permissions || []);
        setGeneratedPassword('');
        setIsEditMode(user.status === 'Active');
        setShowModal(true);
    };

    const handleEditAccessClick = (user: any) => {
        setSelectedUser(user);
        const standardRoles = ['Sales', 'Production', 'Management', 'Admin'];
        const standardSubRoles = ['None', 'PMO', 'Production', 'Logistics', 'Quality'];

        const userRole = user.role || 'Sales';
        if (!standardRoles.includes(userRole)) {
            setRole('__CUSTOM__');
            setIsCustomRole(true);
            setCustomRoleInput(userRole);
        } else {
            setRole(userRole);
            setIsCustomRole(false);
            setCustomRoleInput('');
        }

        const userSubRole = user.sub_role || 'None';
        if (!standardSubRoles.includes(userSubRole) && userSubRole !== 'undefined') {
            setSubRole('__CUSTOM__');
            setIsCustomSubRole(true);
            setCustomSubRoleInput(userSubRole);
        } else {
            setSubRole(userSubRole === 'undefined' ? 'None' : userSubRole);
            setIsCustomSubRole(false);
            setCustomSubRoleInput('');
        }

        setTrackerAccess(user.tracker_access || []);
        setSymbPermissions(user.symb_permissions || []);
        setGeneratedPassword('');
        setIsEditMode(true);
        setShowModal(true);
    };

    const handleDeclineClick = async (email: string) => {
        if (!confirm('Are you sure you want to decline this request?')) return;
        try {
            const res = await fetch(`/api/access/decline-request/${email}`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                setSuccessMessage('Request declined successfully');
                fetchData();
            } else {
                setError('Failed to decline request');
            }
        } catch (err) {
            setError('Network error');
        }
    };

    const submitForm = async () => {
        setError('');
        const finalRole = (role === '__CUSTOM__' ? customRoleInput.trim() : role) || 'User';
        const finalSubRole = (subRole === '__CUSTOM__' ? customSubRoleInput.trim() : subRole) || 'None';

        if (!finalRole) {
            setError('Please specify a role');
            return;
        }

        try {
            const endpoint = isEditMode 
                ? `/api/access/update-user/${selectedUser.email}`
                : `/api/access/approve-request/${selectedUser.email}`;

            const res = await fetch(endpoint, {
                method: 'PUT',
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    role: finalRole,
                    sub_role: finalSubRole,
                    tracker_access: trackerAccess,
                    symb_permissions: symbPermissions
                })
            });
            
            const data = await res.json();
            if (res.ok) {
                if (isEditMode) {
                    setSuccessMessage('User access updated successfully!');
                    setShowModal(false);
                } else {
                    setGeneratedPassword(data.generated_password);
                    setSuccessMessage('User approved successfully!');
                }
                fetchData();
            } else {
                setError(data.detail || 'Action failed');
            }
        } catch (err) {
            setError('Network error');
        }
    };

    const handleTrackerChange = (tracker: string) => {
        setTrackerAccess(prev => 
            prev.includes(tracker) ? prev.filter(t => t !== tracker) : [...prev, tracker]
        );
    };

    const handleSymbPermissionChange = (perm: string) => {
        setSymbPermissions(prev => 
            prev.includes(perm) ? prev.filter(p => p !== perm) : [...prev, perm]
        );
    };

    return (
        <div style={{ padding: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <h2>Access Management</h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    {activeTab === 'active' && selectedEmails.length > 0 && (
                        <button
                            onClick={() => handleDeleteSelectedUsers()}
                            style={{
                                backgroundColor: '#ef4444',
                                color: 'white',
                                border: 'none',
                                padding: '0.5rem 1rem',
                                borderRadius: '0.25rem',
                                fontWeight: '600',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.4rem'
                            }}
                        >
                            🗑️ Delete Selected Users ({selectedEmails.length})
                        </button>
                    )}
                    <button 
                        className={`primary-btn ${activeTab !== 'pending' ? 'outline' : ''}`} 
                        onClick={() => setActiveTab('pending')}
                        style={{ marginRight: '0.5rem', background: activeTab === 'pending' ? '#111827' : '#e5e7eb', color: activeTab === 'pending' ? 'white' : '#111827' }}
                    >
                        Pending Requests
                    </button>
                    <button 
                        className={`primary-btn ${activeTab !== 'active' ? 'outline' : ''}`} 
                        onClick={() => setActiveTab('active')}
                        style={{ background: activeTab === 'active' ? '#111827' : '#e5e7eb', color: activeTab === 'active' ? 'white' : '#111827' }}
                    >
                        Active Users
                    </button>
                </div>
            </div>

            {/* Data Update Lock Control Card */}
            <div style={{
                backgroundColor: dataLockState.is_temp_unlocked ? '#fff7ed' : (dataLockState.is_edit_allowed ? '#f0fdf4' : '#fef2f2'),
                border: dataLockState.is_temp_unlocked ? '1px solid #fdba74' : (dataLockState.is_edit_allowed ? '1px solid #bbf7d0' : '1px solid #fecaca'),
                borderRadius: '0.75rem',
                padding: '1.25rem 1.5rem',
                marginBottom: '1.5rem',
                boxShadow: '0 2px 4px rgba(0, 0, 0, 0.04)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '1rem'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{
                        width: '44px',
                        height: '44px',
                        borderRadius: '50%',
                        backgroundColor: dataLockState.is_temp_unlocked ? '#ffedd5' : (dataLockState.is_edit_allowed ? '#dcfce7' : '#fee2e2'),
                        color: dataLockState.is_temp_unlocked ? '#c2410c' : (dataLockState.is_edit_allowed ? '#166534' : '#991b1b'),
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1.4rem',
                        fontWeight: 'bold'
                    }}>
                        {dataLockState.is_temp_unlocked ? '⚡' : (dataLockState.is_edit_allowed ? '🔓' : '🔒')}
                    </div>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '700', color: '#1e293b' }}>
                                Data Update Lock Control
                            </h3>
                            {dataLockState.is_temp_unlocked ? (
                                <span style={{
                                    backgroundColor: '#ea580c',
                                    color: 'white',
                                    fontSize: '0.75rem',
                                    fontWeight: '800',
                                    padding: '0.2rem 0.65rem',
                                    borderRadius: '9999px',
                                    letterSpacing: '0.05em'
                                }}>
                                    ⚡ TEMPORARILY UNLOCKED (10 MINS)
                                </span>
                            ) : dataLockState.standard_allowed ? (
                                <span style={{
                                    backgroundColor: '#16a34a',
                                    color: 'white',
                                    fontSize: '0.75rem',
                                    fontWeight: '800',
                                    padding: '0.2rem 0.65rem',
                                    borderRadius: '9999px'
                                }}>
                                    🔓 UNLOCKED (WINDOW {dataLockState.start_time || '00:00'} - {dataLockState.end_time || '14:00'})
                                </span>
                            ) : (
                                <span style={{
                                    backgroundColor: '#dc2626',
                                    color: 'white',
                                    fontSize: '0.75rem',
                                    fontWeight: '800',
                                    padding: '0.2rem 0.65rem',
                                    borderRadius: '9999px'
                                }}>
                                    🔒 LOCKED FOR STANDARD USERS ({dataLockState.start_time || '00:00'} - {dataLockState.end_time || '14:00'})
                                </span>
                            )}
                        </div>
                        <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.875rem', color: '#475569' }}>
                            {dataLockState.is_temp_unlocked ? (
                                <>
                                    Temporarily unlocked by <strong>{dataLockState.unlocked_by || 'Admin'}</strong>. Editing is open for all users across the system.
                                </>
                            ) : dataLockState.standard_allowed ? (
                                <>Standard data editing window is active ({dataLockState.start_time || '00:00'} to {dataLockState.end_time || '14:00'}).</>
                            ) : (
                                <>Data editing is locked for standard users outside window {dataLockState.start_time || '00:00'} - {dataLockState.end_time || '14:00'}. Admin roles have unrestricted edit access at all times.</>
                            )}
                        </p>
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                    {dataLockState.is_temp_unlocked && (
                        <div style={{ textAlign: 'right' }}>
                            <span style={{ fontSize: '0.75rem', color: '#9a3412', fontWeight: '700', textTransform: 'uppercase', display: 'block' }}>Time Remaining</span>
                            <div style={{ fontSize: '1.4rem', fontWeight: '800', color: '#c2410c', fontFamily: 'monospace' }}>
                                {formatLockDuration(dataLockState.temp_remaining_seconds)}
                            </div>
                        </div>
                    )}

                    <button
                        onClick={handleUnlockDataLock}
                        disabled={unlockLoading}
                        style={{
                            backgroundColor: dataLockState.is_temp_unlocked ? '#ea580c' : '#0284c7',
                            color: 'white',
                            border: 'none',
                            padding: '0.65rem 1.25rem',
                            borderRadius: '0.5rem',
                            fontWeight: '700',
                            fontSize: '0.9rem',
                            cursor: unlockLoading ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                            transition: 'all 0.2s ease'
                        }}
                    >
                        {unlockLoading ? 'Unlocking...' : (
                            <>
                                <span>{dataLockState.is_temp_unlocked ? '⚡ Extend Unlock (10 Mins)' : '🔓 Unlock Data Lock for 10 Mins'}</span>
                            </>
                        )}
                    </button>
                </div>

                <div style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem',
                    flexWrap: 'wrap',
                    marginTop: '0.8rem',
                    paddingTop: '0.8rem',
                    borderTop: '1px solid rgba(0,0,0,0.08)'
                }}>
                    <span style={{ fontSize: '0.875rem', fontWeight: '700', color: '#1e293b' }}>
                        Configure Standard Edit Hours (00:00 - 23:59):
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <label style={{ fontSize: '0.85rem', fontWeight: '600', color: '#475569' }}>Start:</label>
                        <input
                            type="time"
                            value={lockStartTime}
                            onChange={(e) => setLockStartTime(e.target.value)}
                            style={{
                                padding: '0.35rem 0.6rem',
                                borderRadius: '0.375rem',
                                border: '1px solid #cbd5e1',
                                fontSize: '0.875rem',
                                fontWeight: '600',
                                color: '#0f172a'
                            }}
                        />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <label style={{ fontSize: '0.85rem', fontWeight: '600', color: '#475569' }}>End:</label>
                        <input
                            type="time"
                            value={lockEndTime}
                            onChange={(e) => setLockEndTime(e.target.value)}
                            style={{
                                padding: '0.35rem 0.6rem',
                                borderRadius: '0.375rem',
                                border: '1px solid #cbd5e1',
                                fontSize: '0.875rem',
                                fontWeight: '600',
                                color: '#0f172a'
                            }}
                        />
                    </div>
                    <button
                        onClick={handleUpdateLockWindow}
                        disabled={updatingLockWindow}
                        style={{
                            backgroundColor: '#0f766e',
                            color: 'white',
                            border: 'none',
                            padding: '0.45rem 1rem',
                            borderRadius: '0.375rem',
                            fontWeight: '700',
                            fontSize: '0.85rem',
                            cursor: updatingLockWindow ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.4rem',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                            transition: 'all 0.2s ease'
                        }}
                    >
                        {updatingLockWindow ? 'Saving...' : '⚙️ Save Lock Hours'}
                    </button>
                </div>
            </div>

            {error && <div className="login-error">{error}</div>}
            {successMessage && <div className="login-success">{successMessage}</div>}

            {loading ? (
                <p>Loading...</p>
            ) : (
                <>
                    {/* Controls & Filter Summary Bar */}
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginTop: '1rem',
                        marginBottom: '0.75rem',
                        backgroundColor: '#f8fafc',
                        padding: '0.75rem 1rem',
                        borderRadius: '0.5rem',
                        border: '1px solid #e2e8f0',
                        flexWrap: 'wrap',
                        gap: '0.75rem'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <span style={{ fontWeight: '600', fontSize: '0.875rem', color: '#334155' }}>
                                Showing {paginatedUsers.length} of {totalFiltered} {activeTab === 'pending' ? 'requests' : 'users'}
                                {rawList.length !== totalFiltered && ` (Filtered from ${rawList.length} total)`}
                            </span>
                            {isFilterActive && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <span style={{
                                        backgroundColor: '#e0f2fe',
                                        color: '#0369a1',
                                        fontSize: '0.75rem',
                                        fontWeight: '700',
                                        padding: '0.2rem 0.5rem',
                                        borderRadius: '9999px',
                                        border: '1px solid #bae6fd'
                                    }}>
                                        Filters Active
                                    </span>
                                    <button
                                        onClick={resetFilters}
                                        style={{
                                            backgroundColor: '#fee2e2',
                                            color: '#dc2626',
                                            border: '1px solid #fca5a5',
                                            padding: '0.25rem 0.6rem',
                                            borderRadius: '0.25rem',
                                            fontSize: '0.75rem',
                                            fontWeight: '600',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        Clear Filters
                                    </button>
                                </div>
                            )}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', color: '#475569' }}>
                                <label>Per Page:</label>
                                <select
                                    value={pageSize}
                                    onChange={(e) => {
                                        setPageSize(Number(e.target.value));
                                        setCurrentPage(1);
                                    }}
                                    style={{
                                        padding: '0.25rem 0.5rem',
                                        borderRadius: '0.25rem',
                                        border: '1px solid #cbd5e1',
                                        fontSize: '0.85rem',
                                        backgroundColor: 'white'
                                    }}
                                >
                                    <option value={25}>25</option>
                                    <option value={50}>50</option>
                                    <option value={100}>100</option>
                                    <option value={250}>250</option>
                                    <option value={0}>All</option>
                                </select>
                            </div>

                            {pageSize > 0 && totalPages > 1 && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                    <button
                                        disabled={safeCurrentPage <= 1}
                                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                        style={{
                                            padding: '0.25rem 0.6rem',
                                            borderRadius: '0.25rem',
                                            border: '1px solid #cbd5e1',
                                            backgroundColor: safeCurrentPage <= 1 ? '#f1f5f9' : 'white',
                                            color: safeCurrentPage <= 1 ? '#94a3b8' : '#334155',
                                            cursor: safeCurrentPage <= 1 ? 'not-allowed' : 'pointer',
                                            fontWeight: '600',
                                            fontSize: '0.85rem'
                                        }}
                                    >
                                        Prev
                                    </button>
                                    <span style={{ fontSize: '0.85rem', fontWeight: '600', color: '#475569', padding: '0 0.25rem' }}>
                                        {safeCurrentPage} / {totalPages}
                                    </span>
                                    <button
                                        disabled={safeCurrentPage >= totalPages}
                                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                        style={{
                                            padding: '0.25rem 0.6rem',
                                            borderRadius: '0.25rem',
                                            border: '1px solid #cbd5e1',
                                            backgroundColor: safeCurrentPage >= totalPages ? '#f1f5f9' : 'white',
                                            color: safeCurrentPage >= totalPages ? '#94a3b8' : '#334155',
                                            cursor: safeCurrentPage >= totalPages ? 'not-allowed' : 'pointer',
                                            fontWeight: '600',
                                            fontSize: '0.85rem'
                                        }}
                                    >
                                        Next
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: '#f1f5f9', textAlign: 'left' }}>
                                {activeTab === 'active' && (
                                    <th style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #cbd5e1', width: '40px' }}>
                                        <input 
                                            type="checkbox"
                                            checked={filteredUsers.length > 0 && filteredUsers.every(u => selectedEmails.includes(u.email))}
                                            onChange={toggleSelectAll}
                                            title="Select all filtered active users"
                                            style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                                        />
                                    </th>
                                )}
                                <th style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #cbd5e1', fontWeight: '700', color: '#1e293b' }}>Email</th>
                                <th style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #cbd5e1', fontWeight: '700', color: '#1e293b' }}>{activeTab === 'pending' ? 'Department / Request Details' : 'Department'}</th>
                                {activeTab === 'active' && <th style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #cbd5e1', fontWeight: '700', color: '#1e293b' }}>Role</th>}
                                {activeTab === 'active' && <th style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #cbd5e1', fontWeight: '700', color: '#1e293b' }}>Password Status</th>}
                                <th style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #cbd5e1', fontWeight: '700', color: '#1e293b' }}>Actions</th>
                                {activeTab === 'active' && <th style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #cbd5e1', fontWeight: '700', color: '#1e293b' }}>Activity</th>}
                            </tr>
                            {/* Column Filters Row */}
                            <tr style={{ background: '#f8fafc', borderBottom: '2px solid #cbd5e1' }}>
                                {activeTab === 'active' && <td style={{ padding: '0.4rem', textAlign: 'center' }}></td>}
                                <td style={{ padding: '0.4rem 0.75rem' }}>
                                    <input 
                                        type="text"
                                        placeholder="Filter email..."
                                        value={columnFilters.email}
                                        onChange={e => { setColumnFilters(prev => ({ ...prev, email: e.target.value })); setCurrentPage(1); }}
                                        style={{
                                            width: '100%',
                                            padding: '0.35rem 0.5rem',
                                            fontSize: '0.8rem',
                                            border: '1px solid #cbd5e1',
                                            borderRadius: '0.375rem',
                                            outline: 'none',
                                            backgroundColor: 'white'
                                        }}
                                    />
                                </td>
                                <td style={{ padding: '0.4rem 0.75rem' }}>
                                    <input 
                                        type="text"
                                        placeholder="Filter dept..."
                                        value={columnFilters.department}
                                        onChange={e => { setColumnFilters(prev => ({ ...prev, department: e.target.value })); setCurrentPage(1); }}
                                        style={{
                                            width: '100%',
                                            padding: '0.35rem 0.5rem',
                                            fontSize: '0.8rem',
                                            border: '1px solid #cbd5e1',
                                            borderRadius: '0.375rem',
                                            outline: 'none',
                                            backgroundColor: 'white'
                                        }}
                                    />
                                </td>
                                {activeTab === 'active' && (
                                    <td style={{ padding: '0.4rem 0.75rem' }}>
                                        <input 
                                            type="text"
                                            placeholder="Filter role..."
                                            value={columnFilters.role}
                                            onChange={e => { setColumnFilters(prev => ({ ...prev, role: e.target.value })); setCurrentPage(1); }}
                                            style={{
                                                width: '100%',
                                                padding: '0.35rem 0.5rem',
                                                fontSize: '0.8rem',
                                                border: '1px solid #cbd5e1',
                                                borderRadius: '0.375rem',
                                                outline: 'none',
                                                backgroundColor: 'white'
                                            }}
                                        />
                                    </td>
                                )}
                                {activeTab === 'active' && (
                                    <td style={{ padding: '0.4rem 0.75rem' }}>
                                        <select
                                            value={columnFilters.passwordStatus}
                                            onChange={e => { setColumnFilters(prev => ({ ...prev, passwordStatus: e.target.value })); setCurrentPage(1); }}
                                            style={{
                                                width: '100%',
                                                padding: '0.35rem 0.5rem',
                                                fontSize: '0.8rem',
                                                border: '1px solid #cbd5e1',
                                                borderRadius: '0.375rem',
                                                outline: 'none',
                                                backgroundColor: 'white'
                                            }}
                                        >
                                            <option value="all">All Passwords</option>
                                            <option value="changed">Changed by User</option>
                                            <option value="default">Default Password</option>
                                        </select>
                                    </td>
                                )}
                                <td style={{ padding: '0.4rem 0.75rem' }}></td>
                                {activeTab === 'active' && (
                                    <td style={{ padding: '0.4rem 0.75rem' }}>
                                        <select
                                            value={columnFilters.activity}
                                            onChange={e => { setColumnFilters(prev => ({ ...prev, activity: e.target.value })); setCurrentPage(1); }}
                                            style={{
                                                width: '100%',
                                                padding: '0.35rem 0.5rem',
                                                fontSize: '0.8rem',
                                                border: '1px solid #cbd5e1',
                                                borderRadius: '0.375rem',
                                                outline: 'none',
                                                backgroundColor: 'white'
                                            }}
                                        >
                                            <option value="all">All Activity</option>
                                            <option value="live">Active Now</option>
                                            <option value="offline">Offline</option>
                                        </select>
                                    </td>
                                )}
                            </tr>
                        </thead>
                        <tbody>
                            {paginatedUsers.map((user, idx) => (
                                <tr key={idx} style={{ borderBottom: '1px solid #e5e7eb', backgroundColor: selectedEmails.includes(user.email) ? '#fef2f2' : 'transparent' }}>
                                    {activeTab === 'active' && (
                                        <td style={{ padding: '1rem' }}>
                                            <input 
                                                type="checkbox"
                                                checked={selectedEmails.includes(user.email)}
                                                onChange={() => toggleSelectUser(user.email)}
                                                style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                                            />
                                        </td>
                                    )}
                                    <td style={{ padding: '1rem' }}>{user.email}</td>
                                    <td style={{ padding: '1rem' }}>
                                        {activeTab === 'pending' && user.has_pending_page_request ? (
                                            <div>
                                                <span style={{ color: '#0284c7', fontWeight: '700', fontSize: '0.85rem', display: 'block' }}>
                                                    Page Request: <span style={{ backgroundColor: '#e0f2fe', color: '#0369a1', padding: '0.15rem 0.5rem', borderRadius: '4px', border: '1px solid #bae6fd' }}>{user.requested_pages?.join(', ')}</span>
                                                </span>
                                                <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>Dept: {user.department || 'N/A'}</span>
                                            </div>
                                        ) : (
                                            <span>{user.department || 'N/A'}</span>
                                        )}
                                    </td>
                                    {activeTab === 'active' && (
                                        <td style={{ padding: '1rem' }}>
                                            {user.role}
                                            {user.sub_role && user.sub_role !== 'None' && user.sub_role !== 'undefined' ? ` (${user.sub_role})` : ''}
                                        </td>
                                    )}
                                    {activeTab === 'active' && (
                                        <td style={{ padding: '1rem' }}>
                                            {user.password_changed ? (
                                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                                                    <span style={{ color: '#059669', fontWeight: '700', fontSize: '0.8rem' }}>Changed by User</span>
                                                    <span style={{ fontFamily: 'monospace', fontSize: '0.85rem', fontWeight: '700', color: '#065f46', backgroundColor: '#d1fae5', padding: '0.15rem 0.4rem', borderRadius: '4px', marginTop: '0.2rem', border: '1px solid #a7f3d0' }}>
                                                        {user.current_password || user.default_password || 'Not Set'}
                                                    </span>
                                                    {user.initial_password && user.initial_password !== user.current_password && (
                                                        <span style={{ fontSize: '0.72rem', color: '#6b7280', marginTop: '0.15rem' }}>
                                                            Initial: <span style={{ fontFamily: 'monospace' }}>{user.initial_password}</span>
                                                        </span>
                                                    )}
                                                </div>
                                            ) : (
                                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                                                    <span style={{ color: '#d97706', fontWeight: '700', fontSize: '0.8rem' }}>Default Password</span>
                                                    <span style={{ fontFamily: 'monospace', fontSize: '0.85rem', fontWeight: '700', color: '#92400e', backgroundColor: '#fef3c7', padding: '0.15rem 0.4rem', borderRadius: '4px', marginTop: '0.2rem', border: '1px solid #fde68a' }}>
                                                        {user.current_password || user.default_password || '@Ec255kif5f'}
                                                    </span>
                                                </div>
                                            )}
                                        </td>
                                    )}
                                    <td style={{ padding: '1rem' }}>
                                        {activeTab === 'pending' ? (
                                            <>
                                                <button 
                                                    onClick={() => handleApproveClick(user)}
                                                    style={{ background: '#10b981', color: 'white', padding: '0.5rem 1rem', borderRadius: '0.25rem', border: 'none', marginRight: '0.5rem', cursor: 'pointer' }}
                                                >Approve</button>
                                                <button 
                                                    onClick={() => handleDeclineClick(user.email)}
                                                    style={{ background: '#ef4444', color: 'white', padding: '0.5rem 1rem', borderRadius: '0.25rem', border: 'none', cursor: 'pointer' }}
                                                >Decline</button>
                                            </>
                                        ) : (
                                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                                <button 
                                                    onClick={() => handleEditAccessClick(user)}
                                                    style={{ background: '#3b82f6', color: 'white', padding: '0.5rem 1rem', borderRadius: '0.25rem', border: 'none', cursor: 'pointer' }}
                                                >
                                                    Edit Access
                                                </button>
                                                <button 
                                                    onClick={() => handleDeleteSelectedUsers([user.email])}
                                                    style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', padding: '0.5rem 0.75rem', borderRadius: '0.25rem', cursor: 'pointer', fontWeight: '500' }}
                                                    title="Delete this user"
                                                >
                                                    Delete
                                                </button>
                                            </div>
                                        )}
                                    </td>
                                    {activeTab === 'active' && (
                                        <td style={{ padding: '1rem' }}>
                                            {user.is_live ? (
                                                <div>
                                                    <span style={{
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '0.4rem',
                                                        padding: '0.2rem 0.65rem',
                                                        backgroundColor: '#dcfce7',
                                                        color: '#15803d',
                                                        borderRadius: '9999px',
                                                        fontSize: '0.75rem',
                                                        fontWeight: '700',
                                                        border: '1px solid #86efac'
                                                    }}>
                                                        <span style={{
                                                            width: '8px',
                                                            height: '8px',
                                                            backgroundColor: '#22c55e',
                                                            borderRadius: '50%',
                                                            display: 'inline-block'
                                                        }} />
                                                        Active Now
                                                    </span>
                                                    <div style={{ fontSize: '0.8rem', color: '#334155', fontWeight: '600', marginTop: '0.25rem' }}>
                                                        {user.last_active_page || 'Home'}
                                                    </div>
                                                </div>
                                            ) : (
                                                <div>
                                                    <span style={{
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        padding: '0.2rem 0.65rem',
                                                        backgroundColor: '#f1f5f9',
                                                        color: '#64748b',
                                                        borderRadius: '9999px',
                                                        fontSize: '0.75rem',
                                                        fontWeight: '600',
                                                        border: '1px solid #cbd5e1'
                                                    }}>
                                                        Offline
                                                    </span>
                                                    <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.25rem' }}>
                                                        {user.last_active_at ? (
                                                            <>
                                                                <span>{formatRelativeTime(user.last_active_at)}</span>
                                                                <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                                                                    Page: {user.last_active_page || 'Unknown'}
                                                                </div>
                                                            </>
                                                        ) : (
                                                            'No recent activity'
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </td>
                                    )}
                                </tr>
                            ))}
                            {paginatedUsers.length === 0 && (
                                <tr>
                                    <td colSpan={7} style={{ padding: '2rem 1rem', textAlign: 'center', color: '#64748b' }}>
                                        {isFilterActive ? 'No users match the current column filters.' : 'No records found.'}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>

                    {/* Bottom Pagination Bar */}
                    {pageSize > 0 && totalPages > 1 && (
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginTop: '1rem',
                            padding: '0.75rem 1rem',
                            backgroundColor: '#f8fafc',
                            borderRadius: '0.5rem',
                            border: '1px solid #e2e8f0'
                        }}>
                            <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
                                Page {safeCurrentPage} of {totalPages} ({totalFiltered} total items)
                            </span>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button
                                    disabled={safeCurrentPage <= 1}
                                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                    style={{
                                        padding: '0.35rem 0.75rem',
                                        borderRadius: '0.25rem',
                                        border: '1px solid #cbd5e1',
                                        backgroundColor: safeCurrentPage <= 1 ? '#f1f5f9' : 'white',
                                        color: safeCurrentPage <= 1 ? '#94a3b8' : '#334155',
                                        cursor: safeCurrentPage <= 1 ? 'not-allowed' : 'pointer',
                                        fontWeight: '600',
                                        fontSize: '0.85rem'
                                    }}
                                >
                                    Previous
                                </button>
                                <button
                                    disabled={safeCurrentPage >= totalPages}
                                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                    style={{
                                        padding: '0.35rem 0.75rem',
                                        borderRadius: '0.25rem',
                                        border: '1px solid #cbd5e1',
                                        backgroundColor: safeCurrentPage >= totalPages ? '#f1f5f9' : 'white',
                                        color: safeCurrentPage >= totalPages ? '#94a3b8' : '#334155',
                                        cursor: safeCurrentPage >= totalPages ? 'not-allowed' : 'pointer',
                                        fontWeight: '600',
                                        fontSize: '0.85rem'
                                    }}
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* Approval / Edit Modal */}
            {showModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
                    <div style={{ background: 'white', padding: '2rem', borderRadius: '0.5rem', width: '500px', maxHeight: '90vh', overflowY: 'auto' }}>
                        <h3>{isEditMode ? 'Edit User Access:' : 'Approve User:'} {selectedUser?.email}</h3>
                        
                        {generatedPassword ? (
                            <div style={{ background: '#f0fdf4', border: '1px solid #166534', padding: '1rem', marginTop: '1rem', borderRadius: '0.25rem' }}>
                                <p style={{ color: '#166534', fontWeight: 'bold' }}>Temporary Password Generated!</p>
                                <p>Please share this password with the user securely.</p>
                                <div style={{ fontSize: '1.5rem', background: '#fff', padding: '0.5rem', textAlign: 'center', marginTop: '0.5rem', border: '1px dashed #166534' }}>
                                    {generatedPassword}
                                </div>
                                <button onClick={() => setShowModal(false)} className="primary-btn" style={{ width: '100%', marginTop: '1rem' }}>Close</button>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
                                <div>
                                    <label style={{ fontWeight: '600', fontSize: '0.85rem' }}>Role</label>
                                    <select 
                                        value={role} 
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            setRole(val);
                                            setIsCustomRole(val === '__CUSTOM__');
                                        }} 
                                        style={{ width: '100%', padding: '0.5rem', marginTop: '0.25rem', borderRadius: '4px', border: '1px solid #d1d5db' }}
                                    >
                                        <option value="Sales">Sales</option>
                                        <option value="Production">Production</option>
                                        <option value="Management">Management</option>
                                        <option value="Admin">Admin</option>
                                        {Array.from(new Set(activeUsers.map(u => u.role).filter(r => r && !['Sales', 'Production', 'Management', 'Admin'].includes(r)))).map((r: any) => (
                                            <option key={r} value={r}>{r}</option>
                                        ))}
                                        <option value="__CUSTOM__">➕ Add New Custom Role...</option>
                                    </select>
                                    {isCustomRole && (
                                        <input 
                                            type="text" 
                                            placeholder="Enter new custom role name..." 
                                            value={customRoleInput} 
                                            onChange={(e) => setCustomRoleInput(e.target.value)} 
                                            style={{ width: '100%', padding: '0.5rem', marginTop: '0.5rem', borderRadius: '4px', border: '1px solid #3b82f6', backgroundColor: '#eff6ff' }} 
                                            autoFocus
                                        />
                                    )}
                                </div>

                                <div>
                                    <label style={{ fontWeight: '600', fontSize: '0.85rem' }}>Sub Role (Optional Tag)</label>
                                    <select 
                                        value={subRole} 
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            setSubRole(val);
                                            setIsCustomSubRole(val === '__CUSTOM__');
                                        }} 
                                        style={{ width: '100%', padding: '0.5rem', marginTop: '0.25rem', borderRadius: '4px', border: '1px solid #d1d5db' }}
                                    >
                                        <option value="None">None</option>
                                        <option value="PMO">PMO</option>
                                        <option value="Production">Production</option>
                                        <option value="Logistics">Logistics</option>
                                        <option value="Quality">Quality</option>
                                        {Array.from(new Set(activeUsers.map(u => u.sub_role).filter(sr => sr && !['None', 'PMO', 'Production', 'Logistics', 'Quality', 'undefined'].includes(sr)))).map((sr: any) => (
                                            <option key={sr} value={sr}>{sr}</option>
                                        ))}
                                        <option value="__CUSTOM__">➕ Add New Custom Sub-Role...</option>
                                    </select>
                                    {isCustomSubRole && (
                                        <input 
                                            type="text" 
                                            placeholder="Enter new custom sub-role name..." 
                                            value={customSubRoleInput} 
                                            onChange={(e) => setCustomSubRoleInput(e.target.value)} 
                                            style={{ width: '100%', padding: '0.5rem', marginTop: '0.5rem', borderRadius: '4px', border: '1px solid #3b82f6', backgroundColor: '#eff6ff' }} 
                                        />
                                    )}
                                </div>

                                <div>
                                    <label>Tracker Access</label>
                                    <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                                        {['Weekly', 'Revenue', 'SYMB', 'Admin', 'AI Agent'].map(t => (
                                            <label key={t} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                                <input type="checkbox" checked={trackerAccess.includes(t)} onChange={() => handleTrackerChange(t)} /> {t}
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                {trackerAccess.includes('SYMB') && (
                                    <div>
                                        <label>SYMB Permissions (Can edit)</label>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginTop: '0.5rem' }}>
                                            {['ALL', 'PCBA Ready', 'Materials Issued', 'Active alignment', 'Production/Assembly', 'FQC', 'Finished goods', 'Invoice Date', 'Shipment Date', 'customer place'].map(perm => (
                                                <label key={perm} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.875rem' }}>
                                                    <input type="checkbox" checked={symbPermissions.includes(perm)} onChange={() => handleSymbPermissionChange(perm)} /> {perm}
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
                                    <button onClick={() => setShowModal(false)} style={{ padding: '0.5rem 1rem', background: 'none', border: '1px solid #ccc', borderRadius: '0.25rem', cursor: 'pointer' }}>Cancel</button>
                                    <button onClick={submitForm} className="primary-btn">
                                        {isEditMode ? 'Save Changes' : 'Confirm Approval'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
