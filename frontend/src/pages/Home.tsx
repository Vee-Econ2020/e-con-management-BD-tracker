import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Info } from 'lucide-react';
import { SkeuoFolderStack } from '../components/FolderDrawer/SkeuoFolderStack';
import '../index.css';

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
        <div className="app-container" style={{ paddingBottom: '0.75rem' }}>
            <header className="header-container" style={{ marginBottom: '2rem' }}>
                <div className="title-section" style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <img
                        src="/econ-logo.png"
                        alt="e-con Systems"
                        style={{
                            maxHeight: '44px',
                            width: 'auto',
                            objectFit: 'contain',
                            alignSelf: 'flex-start',
                            marginBottom: '0.6rem',
                        }}
                    />
                    <h1 style={{ fontSize: '3.2rem', lineHeight: 1.1, whiteSpace: 'nowrap', margin: 0 }}>
                        e-con Business Development tracker
                    </h1>

                    {/* Date, Week, and Role data positioned on the left end below the title */}
                    <div className="header-meta-left" style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '1.25rem',
                        marginTop: '0.5rem',
                        flexWrap: 'wrap'
                    }}>
                        <div className="week-display" style={{ fontSize: '1.75rem', fontWeight: 800, color: '#1e293b', margin: 0 }}>
                            Week : {weekData?.week || '...'}
                        </div>
                        <span style={{ color: '#cbd5e1', fontSize: '1.2rem', fontWeight: 300 }}>|</span>
                        <div className="current-date" style={{ fontSize: '1.05rem', fontWeight: 600, color: '#64748b' }}>
                            {currentDate}
                        </div>
                        {user && (
                            <>
                                <span style={{ color: '#cbd5e1', fontSize: '1.2rem', fontWeight: 300 }}>|</span>
                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.6rem' }}>
                                    <span style={{ fontSize: '0.95rem', fontWeight: 700, color: '#334155' }}>
                                        {user.email ? user.email.split('@')[0] : ''}
                                    </span>
                                    <span style={{
                                        display: 'inline-block',
                                        padding: '0.2rem 0.75rem',
                                        backgroundColor: '#e0e7ff',
                                        color: '#3730a3',
                                        borderRadius: '9999px',
                                        fontSize: '0.78rem',
                                        fontWeight: 700,
                                        boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                                    }}>
                                        {user.role}{user.sub_role && user.sub_role !== 'None' && user.sub_role !== 'undefined' ? ` - ${user.sub_role}` : ''}
                                    </span>
                                </div>
                            </>
                        )}
                    </div>

                    {!user && (
                        <div style={{
                            marginTop: '0.75rem',
                            padding: '0.85rem 1.25rem',
                            backgroundColor: '#f8fafc',
                            border: '1px solid #cbd5e1',
                            borderLeft: '5px solid #3b82f6',
                            borderRadius: '10px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '1rem',
                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
                            maxWidth: '520px'
                        }}>
                            <Info size={22} color="#0284c7" style={{ flexShrink: 0 }} />
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                                <span style={{ fontSize: '0.95rem', fontWeight: '700', color: '#1e293b' }}>
                                    looks like you haven't logged in please login
                                </span>
                                <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                                    Log in to view your custom tracker permissions and features.
                                </span>
                            </div>
                            <button
                                onClick={() => navigate('/login')}
                                style={{
                                    padding: '0.45rem 1.1rem',
                                    backgroundColor: '#3b82f6',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '6px',
                                    fontWeight: '700',
                                    fontSize: '0.85rem',
                                    cursor: 'pointer',
                                    whiteSpace: 'nowrap',
                                    marginLeft: 'auto',
                                    boxShadow: '0 2px 4px rgba(59, 130, 246, 0.3)'
                                }}
                            >
                                Login
                            </button>
                        </div>
                    )}
                </div>

                <div className="header-user-section" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
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
                                boxShadow: '0 2px 6px rgba(0,0,0,0.12)'
                            }}
                        >
                            Login
                        </button>
                    )}
                </div>
            </header>

            {/* Skeuomorphic 3D Clay Folder Stack with 36vh white space buffer so folders peek half-visible at bottom fold */}
            <main style={{ marginTop: '36vh', width: '100%' }}>
                <SkeuoFolderStack currentWeek={weekData?.week || 36} user={user} />
            </main>

            {/* Post-scroll footer below the tracker */}
            <footer style={{
                padding: '4rem 2rem 6rem 2rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderTop: '1px solid #e2e8f0',
                marginTop: '4rem',
                color: '#64748b',
                fontSize: '0.9rem',
                fontWeight: 600,
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                    <img src="/econ-logo.png" alt="e-con Systems" style={{ maxHeight: '24px', opacity: 0.85 }} />
                    <span style={{ color: '#1e293b', fontWeight: 700 }}>e-con Systems</span>
                    <span style={{ color: '#cbd5e1' }}>|</span>
                    <span>Management Business Development Tracker</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', color: '#94a3b8' }}>
                    <span>Week {weekData?.week || '36'}</span>
                    <span>•</span>
                    <span>All Trackers Synchronized</span>
                </div>
            </footer>
        </div>
    );
}

export default Home;
