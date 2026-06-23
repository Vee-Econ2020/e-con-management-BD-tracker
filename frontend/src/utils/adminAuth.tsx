import { useEffect, useState, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

const STORAGE_KEY = 'econ_admin_auth';

interface StoredAuth {
    token: string;
    username: string;
    expires_at: string;
}

export function getStoredAuth(): StoredAuth | null {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as StoredAuth;
        if (!parsed?.token || !parsed?.expires_at) return null;
        if (new Date(parsed.expires_at).getTime() <= Date.now()) {
            localStorage.removeItem(STORAGE_KEY);
            return null;
        }
        return parsed;
    } catch {
        return null;
    }
}

export function clearStoredAuth() {
    localStorage.removeItem(STORAGE_KEY);
}

export function RequireAdminAuth({ children }: { children: ReactNode }) {
    const navigate = useNavigate();
    const [checking, setChecking] = useState(true);

    useEffect(() => {
        const stored = getStoredAuth();
        if (!stored) {
            navigate('/admin/login', { replace: true });
            return;
        }
        // Verify with backend so invalidated/expired server-side tokens are rejected.
        fetch('/api/admin/auth/verify', {
            headers: { Authorization: `Bearer ${stored.token}` },
        })
            .then((res) => {
                if (!res.ok) {
                    clearStoredAuth();
                    navigate('/admin/login', { replace: true });
                } else {
                    setChecking(false);
                }
            })
            .catch(() => {
                clearStoredAuth();
                navigate('/admin/login', { replace: true });
            });
    }, [navigate]);

    if (checking) {
        return (
            <div style={{
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#6b7280',
                fontSize: '1.1rem',
            }}>
                Checking authentication…
            </div>
        );
    }
    return <>{children}</>;
}
