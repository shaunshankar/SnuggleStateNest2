import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './pages/Login'
import Signup from './pages/Signup'
import HouseholdSetup from './pages/HouseholdSetup'
import Dashboard from './pages/Dashboard'
import Transactions from './pages/Transactions'
import Budgets from './pages/Budgets'
import Bills from './pages/Bills'
import Savings from './pages/Savings'
import Reports from './pages/Reports'
import Household from './pages/Household'
import Settings from './pages/Settings'
import { PageLoader } from './components/LoadingSpinner'

export default function App() {
  const { user, loading } = useAuth()
  if (loading) return <PageLoader />

  return (
    <Routes>
      <Route path="/login" element={!user ? <Login /> : <Navigate to="/dashboard" replace />} />
      <Route path="/signup" element={!user ? <Signup /> : <Navigate to="/dashboard" replace />} />

      <Route element={<ProtectedRoute />}>
        <Route path="/household-setup" element={<HouseholdSetup />} />
        <Route element={<Layout />}>
          <Route element={<ProtectedRoute requireHousehold />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/transactions" element={<Transactions />} />
            <Route path="/budgets" element={<Budgets />} />
            <Route path="/bills" element={<Bills />} />
            <Route path="/savings" element={<Savings />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/household" element={<Household />} />
          </Route>
          <Route path="/settings" element={<Settings />} />
        </Route>
      </Route>

      <Route path="/" element={<Navigate to={user ? '/dashboard' : '/login'} replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
