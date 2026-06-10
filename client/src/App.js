import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import useAuth from './hooks/useAuth';
import Navbar from './components/Navbar';
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

// Protected Route wrapper
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dark-900">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-3 border-accent-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-dark-400 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  return isAuthenticated ? children : <Navigate to="/login" replace />;
};

// Public Route wrapper (redirect to home if already logged in)
const PublicRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dark-900">
        <div className="w-12 h-12 border-3 border-accent-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return isAuthenticated ? <Navigate to="/" replace /> : children;
};

// Layout with Navbar
const AppLayout = ({ children }) => {
  return (
    <div className="min-h-screen bg-dark-900">
      <Navbar />
      <main>{children}</main>
    </div>
  );
};

const AppRoutes = () => {
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/login" element={
        <PublicRoute><Login /></PublicRoute>
      } />
      <Route path="/signup" element={
        <PublicRoute><Signup /></PublicRoute>
      } />

      {/* Protected Routes */}
      <Route path="/" element={
        <ProtectedRoute>
          <AppLayout><Dashboard /></AppLayout>
        </ProtectedRoute>
      } />
      <Route path="/sessions" element={
        <ProtectedRoute>
          <AppLayout><Sessions /></AppLayout>
        </ProtectedRoute>
      } />
      <Route path="/checkin/:sessionId" element={
        <ProtectedRoute>
          <AppLayout><CheckIn /></AppLayout>
        </ProtectedRoute>
      } />
      <Route path="/athletes" element={
        <ProtectedRoute>
          <AppLayout><Athletes /></AppLayout>
        </ProtectedRoute>
      } />
      <Route path="/athlete/:id" element={
        <ProtectedRoute>
          <AppLayout><AthleteProfile /></AppLayout>
        </ProtectedRoute>
      } />
      <Route path="/tests" element={
        <ProtectedRoute>
          <AppLayout><Tests /></AppLayout>
        </ProtectedRoute>
      } />
      <Route path="/test-results" element={
        <ProtectedRoute>
          <AppLayout><TestResults /></AppLayout>
        </ProtectedRoute>
      } />
      <Route path="/attendance" element={
        <ProtectedRoute>
          <AppLayout><AttendanceGrid /></AppLayout>
        </ProtectedRoute>
      } />
      <Route path="/export" element={
        <ProtectedRoute>
          <AppLayout><Export /></AppLayout>
        </ProtectedRoute>
      } />

      {/* Catch-all redirect */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster
          position="top-center"
          toastOptions={{
            duration: 3000,
            style: {
              background: '#1e1e3a',
              color: '#fff',
              border: '1px solid rgba(90, 90, 132, 0.5)',
              borderRadius: '12px',
              backdropFilter: 'blur(10px)',
              fontSize: '14px'
            },
            success: {
              iconTheme: {
                primary: '#10b981',
                secondary: '#fff',
              },
            },
            error: {
              iconTheme: {
                primary: '#ef4444',
                secondary: '#fff',
              },
            },
          }}
        />
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
