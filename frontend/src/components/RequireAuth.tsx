import { useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface RequireAuthProps {
    children: ReactNode;
    allowedRoles?: string[];
    allowedTrackers?: string[];
}

const DENIED_MEMES = [
    "https://media.tenor.com/zJm_V0N4J7kAAAAM/request-denied-colonel-sharp.gif",
    "https://i.imgflip.com/17vd90.jpg",
    "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQIOsHwxs-bh_lrgWoOzogucU_5qWFoAqDGDoBjdXZXKJ7OIJLpem2NmFU&s=10"
];

function AccessDeniedView({ pageName }: { pageName: string }) {
    const { token } = useAuth();
    const navigate = useNavigate();
    const [requestSent, setRequestSent] = useState(false);
    const [requesting, setRequesting] = useState(false);
    const [msg, setMsg] = useState('');

    const randomImage = useState(() => {
        return DENIED_MEMES[Math.floor(Math.random() * DENIED_MEMES.length)];
    })[0];

    const handleRequestAccess = async () => {
        setRequesting(true);
        setMsg('');
        try {
            const res = await fetch('/api/access/request-page-access', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ page: pageName })
            });
            const data = await res.json();
            if (res.ok) {
                setRequestSent(true);
                setMsg(`Access request for ${pageName} tracker submitted to Admin!`);
            } else {
                setMsg(`Error: ${data.detail || 'Failed to send request'}`);
            }
        } catch (err) {
            setMsg('Network error while requesting access.');
        }
        setRequesting(false);
    };

    return createPortal(
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            width: '100vw',
            height: '100vh',
            display: 'flex',
            alignItems: 'center',
            justify: 'center',
            backgroundColor: '#0f172a',
            padding: '1.5rem',
            fontFamily: 'sans-serif',
            zIndex: 999999,
            margin: 0,
            boxSizing: 'border-box'
        }}>
            <div style={{
                backgroundColor: '#1e293b',
                borderRadius: '16px',
                border: '1px solid #334155',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                padding: '2.5rem',
                maxWidth: '520px',
                width: '100%',
                textAlign: 'center',
                color: '#f8fafc',
                margin: 'auto'
            }}>
                <div style={{ marginBottom: '1.5rem' }}>
                    <img 
                        src={randomImage} 
                        alt="Access Denied" 
                        style={{
                            width: '100%',
                            maxWidth: '360px',
                            maxHeight: '260px',
                            objectFit: 'contain',
                            borderRadius: '12px',
                            margin: '0 auto',
                            display: 'block',
                            boxShadow: '0 10px 25px rgba(0,0,0,0.3)',
                            border: '2px solid #475569',
                            backgroundColor: '#0f172a'
                        }}
                    />
                </div>
                
                <p style={{ fontSize: '1.1rem', color: '#cbd5e1', margin: '0 0 1.5rem 0', lineHeight: '1.5' }}>
                    You do not have access to the <strong style={{ color: '#38bdf8' }}>{pageName}</strong> tracker.
                </p>

                {msg && (
                    <div style={{
                        padding: '0.75rem 1rem',
                        borderRadius: '8px',
                        fontSize: '0.875rem',
                        fontWeight: '600',
                        marginBottom: '1.5rem',
                        backgroundColor: msg.startsWith('Error') ? '#451a1a' : '#064e3b',
                        color: msg.startsWith('Error') ? '#fca5a5' : '#6ee7b7',
                        border: `1px solid ${msg.startsWith('Error') ? '#991b1b' : '#047857'}`
                    }}>
                        {msg}
                    </div>
                )}

                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                    <button
                        onClick={handleRequestAccess}
                        disabled={requestSent || requesting}
                        style={{
                            padding: '0.75rem 1.5rem',
                            backgroundColor: requestSent ? '#10b981' : '#3b82f6',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            fontWeight: '700',
                            fontSize: '0.95rem',
                            cursor: (requestSent || requesting) ? 'default' : 'pointer',
                            transition: 'all 0.2s ease',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)'
                        }}
                    >
                        {requesting ? 'Requesting...' : requestSent ? '✓ Access Requested' : '🔐 Request Access'}
                    </button>

                    <button
                        onClick={() => navigate('/')}
                        style={{
                            padding: '0.75rem 1.5rem',
                            backgroundColor: '#334155',
                            color: '#f8fafc',
                            border: '1px solid #475569',
                            borderRadius: '8px',
                            fontWeight: '600',
                            fontSize: '0.95rem',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease'
                        }}
                    >
                        ← Go to Home
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}

export function RequireAuth({ children, allowedRoles, allowedTrackers }: RequireAuthProps) {
    const { user, isLoading } = useAuth();
    const location = useLocation();

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center text-gray-500">
                Checking authentication…
            </div>
        );
    }

    if (!user) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    if (allowedRoles && !allowedRoles.includes(user.role)) {
        return <AccessDeniedView pageName={allowedRoles.join(', ')} />;
    }

    if (allowedTrackers) {
        const hasAccess = allowedTrackers.some(tracker => user.tracker_access?.includes(tracker) || user.role === 'Admin');
        if (!hasAccess) {
            return <AccessDeniedView pageName={allowedTrackers.join(', ')} />;
        }
    }

    return <>{children}</>;
}
