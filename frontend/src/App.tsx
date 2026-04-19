import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import AuthCallbackPage from './pages/AuthCallbackPage';
import VerifyEmailPage from './pages/VerifyEmailPage';
import DashboardPage from './pages/DashboardPage';
import GeneratePage from './pages/GeneratePage';
import AdminPage from './pages/AdminPage';
import SubmissionsPage from './pages/SubmissionsPage';
import BulkGeneratePage from './pages/BulkGeneratePage';
import './App.css';

function App() {
  const { token, role } = useAuthStore();

  return (
    <Router>
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />

        {/* Protected Routes */}
        {token ? (
          <>
            <Route path="/dashboard"     element={<DashboardPage />} />
            <Route path="/generate"      element={<GeneratePage />} />
            <Route path="/bulk-generate" element={<BulkGeneratePage />} />
            <Route path="/submissions"   element={<SubmissionsPage />} />

            {/* Admin Routes */}
            {role === 'admin' && (
              <Route path="/admin" element={<AdminPage />} />
            )}

            {/* Default redirect */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </>
        ) : (
          <>
            <Route path="/"  element={<Navigate to="/login" replace />} />
            <Route path="*"  element={<Navigate to="/login" replace />} />
          </>
        )}
      </Routes>
    </Router>
  );
}

export default App;
