import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import { StopwatchProvider } from './context/StopwatchContext';
import useAuth from './hooks/useAuth';
import AppShell, { Wordmark } from './components/layout/AppShell';
import { ConfirmProvider } from './components/ui/ConfirmProvider';
import { EmptyState } from './components/ui/Display';
import Button from './components/ui/Button';
import usePageTitle from './hooks/usePageTitle';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import Sessions from './pages/Sessions';
import CheckIn from './pages/CheckIn';
import Athletes from './pages/Athletes';
import AttendanceGrid from './pages/AttendanceGrid';
import Export from './pages/Export';
import Tests from './pages/Tests';
import TestResults from './pages/TestResults';
import AthleteProfile from './pages/AthleteProfile';
import Stopwatch from './pages/Stopwatch';
import { PiCompass } from 'react-icons/pi';

const BootScreen = () => (
  <div className="flex min-h-[100dvh] items-center justify-center bg-canvas" role="status" aria-label="Loading">
    <Wordmark className="animate-pulse" />
  </div>
);

const ProtectedLayout = () => {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <BootScreen />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <AppShell><Outlet /></AppShell>;
};

const PublicOnly = () => {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <BootScreen />;
  return isAuthenticated ? <Navigate to="/" replace /> : <Outlet />;
};

const NotFound = () => {
  usePageTitle('Page not found');
  return (
    <EmptyState
      icon={PiCompass}
      title="Page not found"
      body="That link does not point to anything in AttendTrack."
      action={<Button to="/">Back to Today</Button>}
      className="py-24"
    />
  );
};

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <StopwatchProvider>
          <ConfirmProvider>
            <Toaster
              position="top-center"
              containerStyle={{ top: 'calc(16px + env(safe-area-inset-top))', zIndex: 70 }}
              toastOptions={{
                duration: 3000,
                style: {
                  background: '#1c1c1c',
                  color: '#ffffff',
                  border: '1px solid #262626',
                  borderRadius: '100px',
                  padding: '8px 14px',
                  fontSize: '14px',
                  boxShadow: '0 10px 30px rgba(0,0,0,0.45)'
                },
                success: { iconTheme: { primary: '#22c55e', secondary: '#090909' } },
                error: { iconTheme: { primary: '#ff5577', secondary: '#090909' }, duration: 4500 }
              }}
            />
            <Routes>
              <Route element={<PublicOnly />}>
                <Route path="/login" element={<Login />} />
                <Route path="/signup" element={<Signup />} />
              </Route>
              <Route element={<ProtectedLayout />}>
                <Route path="/" element={<Dashboard />} />
                <Route path="/sessions" element={<Sessions />} />
                <Route path="/checkin/:sessionId" element={<CheckIn />} />
                <Route path="/athletes" element={<Athletes />} />
                <Route path="/athlete/:id" element={<AthleteProfile />} />
                <Route path="/tests" element={<Tests />} />
                <Route path="/test-results" element={<TestResults />} />
                <Route path="/attendance" element={<AttendanceGrid />} />
                <Route path="/export" element={<Export />} />
                <Route path="/stopwatch" element={<Stopwatch />} />
                <Route path="*" element={<NotFound />} />
              </Route>
            </Routes>
          </ConfirmProvider>
        </StopwatchProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
