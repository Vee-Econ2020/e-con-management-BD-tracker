import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TargetSetting } from '../components/TargetSetting';
import { CrmDataUpload } from '../components/CrmDataUpload';
import { clearStoredAuth, getStoredAuth } from '../utils/adminAuth';

function Admin() {
    const [activeTab, setActiveTab] = useState<'crm' | 'target'>('target');
    const navigate = useNavigate();

    const handleLogout = async () => {
        const stored = getStoredAuth();
        try {
            if (stored?.token) {
                await fetch('/api/admin/auth/logout', {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${stored.token}` },
                });
            }
        } catch {
            // Best-effort: still clear locally.
        }
        clearStoredAuth();
        navigate('/admin/login', { replace: true });
    };

    return (
        <div className="app-container" style={{ position: 'relative' }}>
            {/* Home Button */}
            <button
                onClick={() => navigate('/')}
                style={{
                    position: 'absolute',
                    top: '0',
                    left: '0',
                    padding: '0.6rem 2.5rem',
                    backgroundColor: '#888888',
                    color: 'white',
                    border: '3px solid #555555',
                    borderRadius: '9999px',
                    fontWeight: '900',
                    fontSize: '1.2rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    zIndex: 10
                }}
            >
                Home
            </button>

            {/* Logout Button */}
            <button
                onClick={handleLogout}
                style={{
                    position: 'absolute',
                    top: '0',
                    right: '0',
                    padding: '0.6rem 2.5rem',
                    backgroundColor: '#dc2626',
                    color: 'white',
                    border: '3px solid #991b1b',
                    borderRadius: '9999px',
                    fontWeight: '900',
                    fontSize: '1.2rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    zIndex: 10
                }}
            >
                Logout
            </button>

            <h1 style={{
                fontSize: '3.5rem',
                fontWeight: '800',
                color: '#4a4a55',
                marginBottom: '4rem',
                letterSpacing: '-0.02em',
                textAlign: 'center'
            }}>
                Admin
            </h1>

            {/* Tabs Row - Positioned to touch the content box below */}
            <div style={{ display: 'flex', gap: '1rem', marginLeft: '2rem' }}>
                <button
                    onClick={() => setActiveTab('crm')}
                    style={{
                        backgroundColor: activeTab === 'crm' ? '#333333' : '#9ca3af',
                        color: activeTab === 'crm' ? 'white' : '#000000', // Pure black for unselected
                        border: 'none',
                        padding: '1.2rem 2.5rem 1.2rem 3.5rem',
                        fontSize: '1.6rem', // Even larger
                        fontWeight: '900',
                        textAlign: 'left',
                        minWidth: '260px',
                        clipPath: 'polygon(0 0, calc(100% - 30px) 0, 100% 30px, 100% 100%, 0 100%)',
                        cursor: 'pointer',
                        transition: 'all 0.3s ease',
                        opacity: activeTab === 'crm' ? 1 : 0.6,
                        marginBottom: '-1px',
                        position: 'relative',
                        zIndex: 2,
                        display: 'flex',
                        flexDirection: 'column'
                    }}
                >
                    {/* Color Indicator Box */}
                    <div style={{
                        position: 'absolute',
                        left: 0,
                        top: 0,
                        bottom: 0,
                        width: '16px', // Thicker bar
                        backgroundColor: '#5B9CFF'
                    }}></div>
                    <div style={{ fontSize: '1.6rem', lineHeight: '1.2' }}>CRM</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: '700' }}>data upload</div>
                </button>

                <button
                    onClick={() => setActiveTab('target')}
                    style={{
                        backgroundColor: activeTab === 'target' ? '#333333' : '#9ca3af',
                        color: activeTab === 'target' ? 'white' : '#000000', // Pure black for unselected
                        border: 'none',
                        padding: '1.2rem 2.5rem 1.2rem 3.5rem',
                        fontSize: '1.6rem', // Even larger
                        fontWeight: '900',
                        textAlign: 'left',
                        minWidth: '260px',
                        clipPath: 'polygon(0 0, calc(100% - 30px) 0, 100% 30px, 100% 100%, 0 100%)',
                        cursor: 'pointer',
                        transition: 'all 0.3s ease',
                        opacity: activeTab === 'target' ? 1 : 0.6,
                        marginBottom: '-1px',
                        position: 'relative',
                        zIndex: 2,
                        display: 'flex',
                        flexDirection: 'column'
                    }}
                >
                    {/* Color Indicator Box */}
                    <div style={{
                        position: 'absolute',
                        left: 0,
                        top: 0,
                        bottom: 0,
                        width: '16px', // Thicker bar
                        backgroundColor: '#64B369'
                    }}></div>
                    <div style={{ fontSize: '1.6rem', lineHeight: '1.2' }}>Target</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: '700' }}>Setting</div>
                </button>
            </div>

            <div style={{
                backgroundColor: '#e5e7eb',
                padding: '4rem 3rem',
                minHeight: '600px',
                borderTop: 'none',
                position: 'relative',
                zIndex: 1,
                boxShadow: '0 -2px 10px rgba(0,0,0,0.05)'
            }}>
                {activeTab === 'crm' && <CrmDataUpload />}

                {activeTab === 'target' && <TargetSetting />}
            </div>
        </div>
    );
}

export default Admin;
