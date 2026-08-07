import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [department, setDepartment] = useState('');
    const [isRequesting, setIsRequesting] = useState(false);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const navigate = useNavigate();
    const { login } = useAuth();

    const validateEmail = (email: string) => {
        return email.endsWith('@e-consystems.com');
    };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setMessage('');

        if (!validateEmail(email)) {
            setError('Email must end with @e-consystems.com');
            return;
        }

        try {
            const res = await fetch('/api/admin/auth/user-login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });

            const data = await res.json();
            
            if (!res.ok) {
                setError(data.detail || 'Login failed');
            } else {
                login(data.token, {
                    email: data.email,
                    role: data.role,
                    sub_role: data.sub_role,
                    tracker_access: data.tracker_access,
                    symb_permissions: data.symb_permissions
                }, data.expires_at);
                navigate('/');
            }
        } catch (err) {
            setError('Network error');
        }
    };

    const handleRequestAccess = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setMessage('');

        if (!validateEmail(email)) {
            setError('Email must end with @e-consystems.com');
            return;
        }

        try {
            const res = await fetch('/api/access/request-access', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, department }),
            });

            const data = await res.json();
            
            if (!res.ok) {
                setError(data.detail || 'Request failed');
            } else {
                setMessage('Access requested successfully! Please wait for admin approval.');
                setIsRequesting(false);
            }
        } catch (err) {
            setError('Network error');
        }
    };

    return (
        <div className="login-container">
            <div className="login-card">
                <h1 className="login-title">e-con BD Tracker</h1>
                <p className="login-subtitle">
                    {isRequesting ? 'Request Access' : 'Sign In'}
                </p>

                {error && <div className="login-error">{error}</div>}
                {message && <div className="login-success">{message}</div>}

                {!isRequesting ? (
                    <form onSubmit={handleLogin} className="login-form">
                        <div className="input-group">
                            <label>Email ID</label>
                            <input 
                                type="email" 
                                value={email} 
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="name@e-consystems.com"
                                required
                            />
                        </div>
                        <div className="input-group">
                            <label>Password</label>
                            <input 
                                type="password" 
                                value={password} 
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                        </div>
                        <button type="submit" className="primary-btn">Login</button>
                        <div className="toggle-mode">
                            <span>Don't have an account? </span>
                            <button type="button" className="text-btn" onClick={() => setIsRequesting(true)}>
                                Request Access
                            </button>
                        </div>
                    </form>
                ) : (
                    <form onSubmit={handleRequestAccess} className="login-form">
                        <div className="input-group">
                            <label>Email ID</label>
                            <input 
                                type="email" 
                                value={email} 
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="name@e-consystems.com"
                                required
                            />
                        </div>
                        <div className="input-group">
                            <label>Department</label>
                            <input 
                                type="text" 
                                value={department} 
                                onChange={(e) => setDepartment(e.target.value)}
                                placeholder="e.g. Sales, Production..."
                                required
                            />
                        </div>
                        <button type="submit" className="primary-btn">Submit Request</button>
                        <div className="toggle-mode">
                            <span>Already requested? </span>
                            <button type="button" className="text-btn" onClick={() => setIsRequesting(false)}>
                                Back to Login
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}
