import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

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
                    setToken(parsed.token);
                    setUser({
                        email: data.email || data.username, // Fallback for Admin
                        role: data.role || 'Admin',
                        sub_role: data.sub_role || 'None',
                        tracker_access: data.tracker_access || ['Admin'],
                        symb_permissions: data.symb_permissions || ['ALL']
                    });
                }
            } catch (error) {
                localStorage.removeItem(STORAGE_KEY);
            } finally {
                setIsLoading(false);
            }
        };

        loadStoredAuth();
    }, []);

    const login = (newToken: string, userData: User, expires_at: string) => {
        setToken(newToken);
        setUser(userData);
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
        // localStorage.removeItem('econ_admin_auth'); // clear legacy admin auth too
        navigate('/');
    };

    return (
        <AuthContext.Provider value={{ user, token, login, logout, isLoading }}>
            {children}
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
