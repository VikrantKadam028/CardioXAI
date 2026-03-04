import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { useAuth } from './context/AuthContext'
import Navbar from './components/Navbar'
import LandingPage      from './pages/LandingPage'
import LoginPage        from './pages/LoginPage'
import RegisterPage     from './pages/RegisterPage'
import DashboardPage    from './pages/DashboardPage'
import AssessmentPage   from './pages/AssessmentPage'
import ResultsPage      from './pages/ResultsPage'
import AboutPage        from './pages/AboutPage'
import ReportDetailPage from './pages/ReportDetailPage'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="spinner" />
    </div>
  )
  return user ? children : <Navigate to="/login" replace />
}

function GuestRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return null
  return !user ? children : <Navigate to="/dashboard" replace />
}

// Pages that have their own full-screen layout (no shared navbar)
const NO_NAVBAR = ['/login', '/register', '/dashboard']

export default function App() {
  const location = useLocation()
  const showNavbar = !NO_NAVBAR.some(p => location.pathname.startsWith(p))

  return (
    <div className="min-h-screen bg-white">
      {showNavbar && <Navbar />}
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route path="/"        element={<LandingPage />} />
          <Route path="/about"   element={<AboutPage />} />
          <Route path="/assess"  element={<AssessmentPage />} />
          <Route path="/results" element={<ResultsPage />} />
          <Route path="/login"   element={<GuestRoute><LoginPage /></GuestRoute>} />
          <Route path="/register" element={<GuestRoute><RegisterPage /></GuestRoute>} />
          <Route path="/dashboard"
            element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
          <Route path="/dashboard/reports/:id"
            element={<ProtectedRoute><ReportDetailPage /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AnimatePresence>
    </div>
  )
}