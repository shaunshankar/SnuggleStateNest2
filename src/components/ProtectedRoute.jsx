import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { PageLoader } from './LoadingSpinner'

export default function ProtectedRoute({ requireHousehold = false }) {
  const { user, loading } = useAuth()
  if (loading) return <PageLoader />
  if (!user) return <Navigate to="/login" replace />
  if (requireHousehold && !user.household_id) return <Navigate to="/household-setup" replace />
  return <Outlet />
}
