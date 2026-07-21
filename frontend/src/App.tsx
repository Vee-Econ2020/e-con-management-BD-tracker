import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Admin from './pages/Admin';
import AdminLogin from './pages/AdminLogin';
import WeeklyTracker from './pages/WeeklyTracker';
import { RequireAdminAuth } from './utils/adminAuth';
import { WeekProvider } from './context/WeekContext';

function App() {
    return (
        <WeekProvider>
            <Router>
                <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/admin/login" element={<AdminLogin />} />
                    <Route
                        path="/admin"
                        element={
                            <RequireAdminAuth>
                                <Admin />
                            </RequireAdminAuth>
                        }
                    />
                    <Route path="/weekly" element={<WeeklyTracker />} />
                </Routes>
            </Router>
        </WeekProvider>
    );
}

export default App;
