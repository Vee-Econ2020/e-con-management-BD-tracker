import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import '../index.css'

interface WeekData {
    week: number;
    year: number;
    date: string;
}

function Home() {
    const [weekData, setWeekData] = useState<WeekData | null>(null);
    const [currentDate, setCurrentDate] = useState<string>('');
    const { user } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        // Set current date
        const date = new Date();
        const options: Intl.DateTimeFormatOptions = { month: 'short', day: '2-digit', year: 'numeric' };
        setCurrentDate(date.toLocaleDateString('en-US', options));

        fetchCurrentWeek();
    }, []);

    const fetchCurrentWeek = async () => {
        try {
            const response = await fetch('/api/week/current');
            if (response.ok) {
                const data = await response.json();
                setWeekData(data);
            }
        } catch (err) {
            console.error('Error fetching week data:', err);
        }
    };

    return (
        <div className="app-container">
            <header className="header-container">
                <div className="title-section">
                    <h1>e-con<br />Business<br />Development<br />tracker</h1>
                </div>

                <div className="date-section" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.3rem' }}>
                    {!user && (
                        <button
                            onClick={() => navigate('/login')}
                            style={{
                                padding: '0.45rem 1.75rem',
                                backgroundColor: '#111827',
                                color: 'white',
                                border: '2px solid #374151',
                                borderRadius: '9999px',
                                fontWeight: '700',
                                fontSize: '1rem',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                marginBottom: '0.4rem',
                                boxShadow: '0 2px 6px rgba(0,0,0,0.12)'
                            }}
                        >
                            Login
                        </button>
                    )}

                    <div className="current-date">{currentDate}</div>
                    <div className="week-display">
                        Week : {weekData?.week || '...'}
                    </div>
                    {user && (
                        <>
                            <div style={{ fontSize: '1.3rem', fontWeight: '800', color: '#1f2937', marginTop: '0.25rem' }}>
                                {user.email ? user.email.split('@')[0] : ''}
                            </div>
                            <div style={{
                                display: 'inline-block',
                                padding: '0.25rem 0.85rem',
                                backgroundColor: '#e0e7ff',
                                color: '#3730a3',
                                borderRadius: '9999px',
                                fontSize: '0.85rem',
                                fontWeight: '700',
                                boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                                marginTop: '0.1rem'
                            }}>
                                {user.role}{user.sub_role && user.sub_role !== 'None' && user.sub_role !== 'undefined' ? ` - ${user.sub_role}` : ''}
                            </div>
                        </>
                    )}
                </div>
            </header>

            <div className="buttons-container">
                {(!user || user.tracker_access?.includes('Weekly') || user.role === 'Admin') && (
                    <button
                        className="nav-button"
                        onClick={() => navigate('/weekly')}
                        style={{
                            borderLeft: '12px solid #3c6cb3ff', // Blue
                            '--hover-bg-color': '#3c6cb3ff'
                        } as React.CSSProperties}
                    >
                        <span className="btn-title">Weekly</span>
                        <span className="btn-subtitle">Tracker</span>
                    </button>
                )}

                {(!user || user.tracker_access?.includes('Revenue') || user.role === 'Admin') && (
                    <button
                        className="nav-button"
                        onClick={() => navigate('/revenue')}
                        style={{
                            borderLeft: '12px solid #1f9e62ff', // Emerald
                            '--hover-bg-color': '#1f9e62ff'
                        } as React.CSSProperties}
                    >
                        <span className="btn-title">Revenue</span>
                        <span className="btn-subtitle">Tracker</span>
                    </button>
                )}

                {(!user || user.tracker_access?.includes('SYMB') || user.role === 'Admin') && (
                    <button
                        className="nav-button"
                        onClick={() => navigate('/symb')}
                        style={{
                            borderLeft: '12px solid #f5ad42', // Yellow folder accent
                            '--hover-bg-color': '#f5ad42'
                        } as React.CSSProperties}
                    >
                        <span className="btn-title">SYMB</span>
                        <span className="btn-subtitle">Tracker</span>
                    </button>
                )}

                {(!user || user.role === 'Admin') && (
                    <button
                        className="nav-button"
                        onClick={() => navigate('/admin')}
                        style={{
                            borderLeft: '12px solid #8a55b3ff', // Purple
                            '--hover-bg-color': '#8a55b3ff'
                        } as React.CSSProperties}
                    >
                        <span className="btn-title">Admin</span>
                        <span className="btn-subtitle">data upload</span>
                    </button>
                )}

                {user && (
                    <button
                        className="nav-button"
                        onClick={() => navigate('/profile')}
                        style={{
                            borderLeft: '12px solid #10B981', // Emerald
                            '--hover-bg-color': '#10B981'
                        } as React.CSSProperties}
                    >
                        <span className="btn-title">Profile</span>
                        <span className="btn-subtitle">account settings</span>
                    </button>
                )}
            </div>
        </div >
    )
}

export default Home
