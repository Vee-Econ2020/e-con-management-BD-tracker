import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';

const STORAGE_KEY = 'econ_admin_auth';

export default function AdminLogin() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);
        try {
            const res = await fetch('/api/admin/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
            });
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body.detail || 'Invalid username or password');
            }
            const data = await res.json();
            localStorage.setItem(STORAGE_KEY, JSON.stringify({
                token: data.token,
                username: data.username,
                expires_at: data.expires_at,
            }));
            navigate('/admin', { replace: true });
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Login failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%)',
            padding: '1rem',
        }}>
            <form
                onSubmit={handleSubmit}
                style={{
                    width: '100%',
                    maxWidth: '420px',
                    backgroundColor: '#ffffff',
                    padding: '2.5rem',
                    borderRadius: '12px',
                    boxShadow: '0 10px 40px rgba(0,0,0,0.08)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1.25rem',
                }}
            >
                <h1 style={{
                    margin: 0,
                    fontSize: '2rem',
                    fontWeight: 800,
                    color: '#1f2937',
                    textAlign: 'center',
                }}>
                    Admin Login
                </h1>
                <p style={{ margin: 0, color: '#6b7280', textAlign: 'center', fontSize: '0.95rem' }}>
                    Sign in to access the Admin area.
                </p>

                <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#374151' }}>Username</span>
                    <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        autoComplete="username"
                        required
                        style={inputStyle}
                    />
                </label>

                <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#374151' }}>Password</span>
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        autoComplete="current-password"
                        required
                        style={inputStyle}
                    />
                </label>

                {error && (
                    <div style={{
                        backgroundColor: '#fee2e2',
                        color: '#991b1b',
                        padding: '0.75rem 1rem',
                        borderRadius: '8px',
                        fontSize: '0.9rem',
                    }}>
                        {error}
                    </div>
                )}

                <button
                    type="submit"
                    disabled={loading || !username || !password}
                    style={{
                        padding: '0.75rem 1rem',
                        borderRadius: '8px',
                        border: 'none',
                        backgroundColor: loading ? '#9ca3af' : '#2563eb',
                        color: '#ffffff',
                        fontWeight: 700,
                        fontSize: '1rem',
                        cursor: loading ? 'not-allowed' : 'pointer',
                        transition: 'background-color 0.15s',
                    }}
                >
                    {loading ? 'Signing in…' : 'Sign In'}
                </button>

                <button
                    type="button"
                    onClick={() => navigate('/')}
                    style={{
                        padding: '0.5rem',
                        border: 'none',
                        background: 'transparent',
                        color: '#6b7280',
                        fontSize: '0.85rem',
                        cursor: 'pointer',
                    }}
                >
                    Back to Home
                </button>
            </form>
        </div>
    );
}

const inputStyle: React.CSSProperties = {
    padding: '0.65rem 0.85rem',
    borderRadius: '8px',
    border: '1px solid #d1d5db',
    fontSize: '1rem',
    outline: 'none',
};
