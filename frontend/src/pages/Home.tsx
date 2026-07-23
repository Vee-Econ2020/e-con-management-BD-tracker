import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import '../index.css'

interface WeekData {
    week: number;
    year: number;
    date: string;
}

function Home() {
    const [weekData, setWeekData] = useState<WeekData | null>(null);
    const [currentDate, setCurrentDate] = useState<string>('');
    const navigate = useNavigate();

    useEffect(() => {
        // Set current date
        const date = new Date();
        // Format: "Jan 05, 2026"
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

                <div className="date-section">
                    <div className="current-date">{currentDate}</div>
                    <div className="week-display">
                        Week : {weekData?.week || '...'}
                    </div>
                </div>
            </header>

            <div className="buttons-container">
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
            </div>
        </div >
    )
}

export default Home
