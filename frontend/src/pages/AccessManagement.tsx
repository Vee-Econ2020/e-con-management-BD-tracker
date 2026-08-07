import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

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

    useEffect(() => {
        setSelectedEmails([]);
        fetchData();
    }, [activeTab]);

    const toggleSelectUser = (email: string) => {
        setSelectedEmails(prev => 
            prev.includes(email) ? prev.filter(e => e !== email) : [...prev, email]
        );
    };

    const toggleSelectAll = () => {
        if (selectedEmails.length === activeUsers.length && activeUsers.length > 0) {
            setSelectedEmails([]);
        } else {
            setSelectedEmails(activeUsers.map(u => u.email));
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

            {error && <div className="login-error">{error}</div>}
            {successMessage && <div className="login-success">{successMessage}</div>}

            {loading ? (
                <p>Loading...</p>
            ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '1rem' }}>
                    <thead>
                        <tr style={{ background: '#f3f4f6', textAlign: 'left' }}>
                            {activeTab === 'active' && (
                                <th style={{ padding: '1rem', borderBottom: '2px solid #e5e7eb', width: '40px' }}>
                                    <input 
                                        type="checkbox"
                                        checked={activeUsers.length > 0 && selectedEmails.length === activeUsers.length}
                                        onChange={toggleSelectAll}
                                        title="Select all active users"
                                        style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                                    />
                                </th>
                            )}
                            <th style={{ padding: '1rem', borderBottom: '2px solid #e5e7eb' }}>Email</th>
                            <th style={{ padding: '1rem', borderBottom: '2px solid #e5e7eb' }}>{activeTab === 'pending' ? 'Department / Request Details' : 'Department'}</th>
                            {activeTab === 'active' && <th style={{ padding: '1rem', borderBottom: '2px solid #e5e7eb' }}>Role</th>}
                            {activeTab === 'active' && <th style={{ padding: '1rem', borderBottom: '2px solid #e5e7eb' }}>Password Status</th>}
                            <th style={{ padding: '1rem', borderBottom: '2px solid #e5e7eb' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {(activeTab === 'pending' ? pendingRequests : activeUsers).map((user, idx) => (
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
                                                    🔑 {user.current_password || user.default_password || 'Not Set'}
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
                                                    🔑 {user.current_password || user.default_password || '@Ec255kif5f'}
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
                            </tr>
                        ))}
                        {(activeTab === 'pending' ? pendingRequests : activeUsers).length === 0 && (
                            <tr>
                                <td colSpan={6} style={{ padding: '1rem', textAlign: 'center' }}>No records found.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
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
                                    <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                                        {['Weekly', 'Revenue', 'SYMB', 'Admin'].map(t => (
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
                                            {['ALL', 'PCBA Ready', 'Active alignment', 'Production/Assembly', 'FQC', 'Finished goods', 'Invoice Date', 'Shipment Date', 'customer place'].map(perm => (
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
