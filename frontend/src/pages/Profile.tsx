import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Profile() {
    const { user, token, logout } = useAuth();
    const navigate = useNavigate();
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setMessage('');

        if (newPassword !== confirmPassword) {
            setError('New passwords do not match');
            return;
        }

        try {
            const res = await fetch('/api/admin/auth/change-password', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ 
                    current_password: currentPassword, 
                    new_password: newPassword 
                }),
            });

            const data = await res.json();
            
            if (!res.ok) {
                setError(data.detail || 'Failed to change password');
            } else {
                setMessage('Password updated successfully');
                setCurrentPassword('');
                setNewPassword('');
                setConfirmPassword('');
            }
        } catch (err) {
            setError('Network error');
        }
    };

    return (
        <div style={{ padding: '2rem', maxWidth: '600px', margin: '0 auto', position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <button
                    onClick={() => navigate('/')}
                    style={{
                        padding: '0.5rem 1.5rem',
                        backgroundColor: '#6b7280',
                        color: 'white',
                        border: 'none',
                        borderRadius: '9999px',
                        fontWeight: '700',
                        cursor: 'pointer'
                    }}
                >
                    ← Home
                </button>
                <button
                    onClick={logout}
                    style={{
                        padding: '0.5rem 1.5rem',
                        backgroundColor: '#dc2626',
                        color: 'white',
                        border: 'none',
                        borderRadius: '9999px',
                        fontWeight: '700',
                        cursor: 'pointer'
                    }}
                >
                    Logout
                </button>
            </div>

            <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', padding: '2rem', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', marginBottom: '2rem' }}>
                <h2 style={{ margin: '0 0 1rem 0', color: '#1f2937' }}>User Profile</h2>
                <p style={{ margin: '0.5rem 0', fontSize: '1rem', color: '#4b5563' }}>Logged in as: <strong style={{ color: '#111827' }}>{user?.email}</strong></p>
                <p style={{ margin: '0.5rem 0', fontSize: '1rem', color: '#4b5563' }}>
                    Role: <strong style={{ color: '#111827' }}>{user?.role}{user?.sub_role && user?.sub_role !== 'None' && user?.sub_role !== 'undefined' ? ` (${user?.sub_role})` : ''}</strong>
                </p>
            </div>

            <div className="login-card" style={{ padding: '2rem' }}>
                <h3 style={{ marginBottom: '1rem' }}>Change Password</h3>
                {error && <div className="login-error">{error}</div>}
                {message && <div className="login-success">{message}</div>}

                <form onSubmit={handleChangePassword} className="login-form">
                    <div className="input-group">
                        <label>Current Password</label>
                        <input 
                            type="password" 
                            value={currentPassword} 
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            required
                        />
                    </div>
                    <div className="input-group">
                        <label>New Password</label>
                        <input 
                            type="password" 
                            value={newPassword} 
                            onChange={(e) => setNewPassword(e.target.value)}
                            required
                        />
                    </div>
                    <div className="input-group">
                        <label>Confirm New Password</label>
                        <input 
                            type="password" 
                            value={confirmPassword} 
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            required
                        />
                    </div>
                    <button type="submit" className="primary-btn" style={{ marginTop: '1rem' }}>Update Password</button>
                </form>
            </div>
        </div>
    );
}
