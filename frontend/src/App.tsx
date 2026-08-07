import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Admin from './pages/Admin';
import WeeklyTracker from './pages/WeeklyTracker';
import SymbTracker from './pages/SymbTracker';
import { WeekProvider } from './context/WeekContext';
import { AuthProvider } from './context/AuthContext';
import Login from './pages/Login';
import Profile from './pages/Profile';
import AccessManagement from './pages/AccessManagement';
import { RequireAuth } from './components/RequireAuth';

function App() {
    return (
        <WeekProvider>
            <Router>
                <AuthProvider>
                    <Routes>
                        <Route path="/" element={<Home />} />
                        <Route path="/login" element={<Login />} />
                        <Route
                            path="/admin"
                            element={
                                <RequireAuth allowedRoles={['Admin']}>
                                    <Admin />
                                </RequireAuth>
                            }
                        />
                        <Route
                            path="/access-management"
                            element={
                                <RequireAuth allowedRoles={['Admin']}>
                                    <AccessManagement />
                                </RequireAuth>
                            }
                        />
                        <Route
                            path="/profile"
                            element={
                                <RequireAuth>
                                    <Profile />
                                </RequireAuth>
                            }
                        />
                        <Route 
                            path="/weekly" 
                            element={
                                <RequireAuth allowedTrackers={['Weekly']}>
                                    <WeeklyTracker />
                                </RequireAuth>
                            } 
                        />
                        <Route 
                            path="/symb" 
                            element={
                                <RequireAuth allowedTrackers={['SYMB']}>
                                    <SymbTracker />
                                </RequireAuth>
                            } 
                        />
                    </Routes>
                </AuthProvider>
            </Router>
        </WeekProvider>
    );
}

export default App;
