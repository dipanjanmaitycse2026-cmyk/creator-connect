
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from 'react-router-dom';

import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/auth/ProtectedRoute';

import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import ForgotPassword from './pages/auth/ForgotPassword';
import ResetPassword from './pages/auth/ResetPassword';

import Onboarding from './pages/onboarding/Onboarding';
import Dashboard from './pages/dashboard/Dashboard';
import Discover from './pages/discover/Discover';

import ComingSoon from './pages/ComingSoon';

import CollaborationHub from './pages/collaboration/CollaborationHub';
import OneToOne from './pages/collaboration/OneToOne';

import ContentPlanner from './pages/planner/ContentPlanner';
import WellnessCentre from './pages/wellness/WellnessCentre';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public routes */}
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          {/* Protected routes */}
          <Route
            path="/onboarding"
            element={<ProtectedRoute><Onboarding /></ProtectedRoute>}
          />

          <Route
            path="/dashboard"
            element={<ProtectedRoute><Dashboard /></ProtectedRoute>}
          />

          <Route
            path="/discover"
            element={<ProtectedRoute><Discover /></ProtectedRoute>}
          />

          {/* Collaboration Hub */}
          <Route
            path="/collaboration"
            element={<ProtectedRoute><CollaborationHub /></ProtectedRoute>}
          />

          <Route
            path="/collaboration/one-to-one"
            element={<ProtectedRoute><OneToOne /></ProtectedRoute>}
          />

          <Route
            path="/collaboration/group"
            element={<ProtectedRoute><ComingSoon title="Group Collaboration" /></ProtectedRoute>}
          />

          <Route
            path="/collaboration/bounty-board"
            element={<ProtectedRoute><ComingSoon title="Bounty Board" /></ProtectedRoute>}
          />

          {/* Content Planner */}
          <Route
            path="/planner"
            element={<ProtectedRoute><ContentPlanner /></ProtectedRoute>}
          />

          {/* Wellness Centre */}
          <Route
            path="/wellness"
            element={<ProtectedRoute><WellnessCentre /></ProtectedRoute>}
          />

          {/* Upcoming features */}
          <Route
            path="/analytics"
            element={<ProtectedRoute><ComingSoon title="Analytics" /></ProtectedRoute>}
          />

          <Route
            path="/messages"
            element={<ProtectedRoute><ComingSoon title="Messages" /></ProtectedRoute>}
          />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
