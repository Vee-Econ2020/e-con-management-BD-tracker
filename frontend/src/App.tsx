import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Admin from './pages/Admin';
import AdminLogin from './pages/AdminLogin';
import WeeklyTracker from './pages/WeeklyTracker';
import { RequireAdminAuth } from './utils/adminAuth';

function App() {
    return (
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
    );
}

export default App;
