import { createContext, useContext, useEffect, useState, useRef } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, ShieldAlert, X } from 'lucide-react';

export interface User {
    email: string;
    role: string;
    sub_role?: string;
    tracker_access: string[];
    symb_permissions: string[];
}

interface AuthContextType {
    user: User | null;
    token: string | null;
    login: (token: string, userData: User, expires_at: string) => void;
    logout: () => void;
    isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

const STORAGE_KEY = 'econ_auth';

interface StoredAuth {
    token: string;
    user: User;
    expires_at: string;
}

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [revokedMsg, setRevokedMsg] = useState<string | null>(null);
    const [toastMsg, setToastMsg] = useState<string | null>(null);
    
    const userRef = useRef<User | null>(user);
    userRef.current = user;

    const navigate = useNavigate();

    useEffect(() => {
        const loadStoredAuth = async () => {
            try {
                const raw = localStorage.getItem(STORAGE_KEY);
                if (!raw) {
                    setIsLoading(false);
                    return;
                }
                const parsed = JSON.parse(raw) as StoredAuth;
                if (!parsed?.token || !parsed?.expires_at) {
                    setIsLoading(false);
                    return;
                }
                if (new Date(parsed.expires_at).getTime() <= Date.now()) {
                    localStorage.removeItem(STORAGE_KEY);
                    setIsLoading(false);
                    return;
                }

                // Verify with backend
                const res = await fetch('/api/admin/auth/verify', {
                    headers: { Authorization: `Bearer ${parsed.token}` },
                });
                
                if (!res.ok) {
                    localStorage.removeItem(STORAGE_KEY);
                } else {
                    const data = await res.json();
                    const newUser: User = {
                        email: data.email || data.username,
                        role: data.role || 'Admin',
                        sub_role: data.sub_role || 'None',
                        tracker_access: data.tracker_access || ['Admin'],
                        symb_permissions: data.symb_permissions || ['ALL']
                    };
                    setToken(parsed.token);
                    setUser(newUser);
                }
            } catch (error) {
                localStorage.removeItem(STORAGE_KEY);
            } finally {
                setIsLoading(false);
            }
        };

        loadStoredAuth();
    }, []);

    // Periodic live session polling every 20 seconds to catch access changes and track active page
    useEffect(() => {
        if (!token) return;

        const checkSessionAndTrackActivity = async () => {
            try {
                const currentPath = window.location.pathname;
                const res = await fetch(`/api/admin/auth/verify?page=${encodeURIComponent(currentPath)}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });

                if (res.status === 401 || res.status === 403) {
                    const data = await res.json().catch(() => ({}));
                    const detailMsg = data.detail || 'Access has been revoked by an administrator.';
                    setRevokedMsg(detailMsg);
                    logout();
                    return;
                }

                if (res.ok) {
                    const data = await res.json();
                    const currentUser = userRef.current;
                    if (!currentUser) return;

                    const updatedRole = data.role || 'User';
                    const updatedSubRole = data.sub_role || 'None';
                    const updatedTrackerAccess: string[] = data.tracker_access || [];
                    const updatedSymbPermissions: string[] = data.symb_permissions || [];

                    const trackerAccessChanged = JSON.stringify(currentUser.tracker_access?.sort()) !== JSON.stringify(updatedTrackerAccess.sort());
                    const symbPermsChanged = JSON.stringify(currentUser.symb_permissions?.sort()) !== JSON.stringify(updatedSymbPermissions.sort());
                    const roleChanged = currentUser.role !== updatedRole || currentUser.sub_role !== updatedSubRole;

                    if (roleChanged || trackerAccessChanged || symbPermsChanged) {
                        const updatedUser: User = {
                            ...currentUser,
                            role: updatedRole,
                            sub_role: updatedSubRole,
                            tracker_access: updatedTrackerAccess,
                            symb_permissions: updatedSymbPermissions
                        };

                        setUser(updatedUser);
                        
                        // Update storage
                        const raw = localStorage.getItem(STORAGE_KEY);
                        if (raw) {
                            try {
                                const parsed = JSON.parse(raw);
                                parsed.user = updatedUser;
                                localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
                            } catch (e) {
                                // ignore
                            }
                        }

                        let msg = `Your role access was updated to: ${updatedRole}`;
                        if (updatedSubRole && updatedSubRole !== 'None') {
                            msg += ` (${updatedSubRole})`;
                        }
                        setToastMsg(msg);
                        setTimeout(() => setToastMsg(null), 6000);
                    }
                }
            } catch (err) {
                // Ignore transient network errors during background check
            }
        };

        const interval = setInterval(checkSessionAndTrackActivity, 20000);

        return () => clearInterval(interval);
    }, [token]);

    // Send instant offline beacon when tab/browser closes or hides
    useEffect(() => {
        if (!token) return;

        const sendOfflineBeacon = () => {
            if (!token) return;
            const url = `/api/admin/auth/offline?token_param=${encodeURIComponent(token)}`;
            if (navigator.sendBeacon) {
                navigator.sendBeacon(url);
            } else {
                fetch(url, { method: 'POST', keepalive: true }).catch(() => {});
            }
        };

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'hidden') {
                sendOfflineBeacon();
            }
        };

        window.addEventListener('beforeunload', sendOfflineBeacon);
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            window.removeEventListener('beforeunload', sendOfflineBeacon);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [token]);

    const login = (newToken: string, userData: User, expires_at: string) => {
        setToken(newToken);
        setUser(userData);
        setRevokedMsg(null);
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
            token: newToken,
            user: userData,
            expires_at
        }));
    };

    const logout = () => {
        setToken(null);
        setUser(null);
        localStorage.removeItem(STORAGE_KEY);
        navigate('/login');
    };

    return (
        <AuthContext.Provider value={{ user, token, login, logout, isLoading }}>
            {children}

            {/* Notification Toast for live permission updates */}
            {toastMsg && (
                <div style={{
                    position: 'fixed',
                    top: '20px',
                    right: '20px',
                    backgroundColor: '#1e293b',
                    color: '#38bdf8',
                    border: '2px solid #0284c7',
                    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                    borderRadius: '12px',
                    padding: '1rem 1.5rem',
                    zIndex: 999999,
                    fontSize: '0.95rem',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    animation: 'slideIn 0.3s ease-out'
                }}>
                    <Bell size={20} color="#38bdf8" style={{ flexShrink: 0 }} />
                    <div>
                        <div style={{ color: '#f8fafc', fontWeight: 700, fontSize: '1rem' }}>Permissions Updated</div>
                        <div style={{ color: '#94a3b8', fontSize: '0.875rem' }}>{toastMsg}</div>
                    </div>
                    <button
                        onClick={() => setToastMsg(null)}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: '#94a3b8',
                            fontSize: '1rem',
                            cursor: 'pointer',
                            marginLeft: '1rem',
                            display: 'flex',
                            alignItems: 'center'
                        }}
                    >
                        <X size={16} />
                    </button>
                </div>
            )}

            {/* Modal Popup for Access Revocation */}
            {revokedMsg && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(15, 23, 42, 0.85)',
                    backdropFilter: 'blur(4px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 999999,
                    padding: '1.5rem'
                }}>
                    <div style={{
                        backgroundColor: '#1e293b',
                        borderRadius: '16px',
                        border: '1px solid #ef4444',
                        boxShadow: '0 25px 50px -12px rgba(239, 68, 68, 0.25)',
                        maxWidth: '450px',
                        width: '100%',
                        padding: '2rem',
                        textAlign: 'center',
                        color: '#f8fafc'
                    }}>
                        <div style={{
                            width: '56px',
                            height: '56px',
                            backgroundColor: '#451a1a',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            margin: '0 auto 1.25rem auto',
                            color: '#ef4444',
                            border: '2px solid #991b1b'
                        }}>
                            <ShieldAlert size={28} />
                        </div>
                        <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#f8fafc', margin: '0 0 0.5rem 0' }}>
                            Access Revoked
                        </h2>
                        <p style={{ color: '#cbd5e1', fontSize: '0.95rem', lineHeight: '1.5', margin: '0 0 1.5rem 0' }}>
                            {revokedMsg}
                        </p>
                        <button
                            onClick={() => {
                                setRevokedMsg(null);
                                navigate('/login');
                            }}
                            style={{
                                width: '100%',
                                padding: '0.75rem 1.5rem',
                                backgroundColor: '#ef4444',
                                color: 'white',
                                border: 'none',
                                borderRadius: '8px',
                                fontWeight: 700,
                                fontSize: '1rem',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)'
                            }}
                        >
                            Back to Login
                        </button>
                    </div>
                </div>
            )}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
