import { NavLink, useNavigate } from 'react-router-dom'
import { LayoutDashboard, ArrowLeftRight, PieChart, Receipt, Target, BarChart3, Home, Settings, LogOut, Bird, Landmark } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { initials } from '../utils/formatters'

const links = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/transactions', icon: ArrowLeftRight, label: 'Transactions' },
  { to: '/budgets', icon: PieChart, label: 'Budgets' },
  { to: '/bills', icon: Receipt, label: 'Bills' },
  { to: '/savings', icon: Target, label: 'Savings' },
  { to: '/loans', icon: Landmark, label: 'Loans' },
  { to: '/reports', icon: BarChart3, label: 'Reports' },
  { to: '/household', icon: Home, label: 'Household' },
]

export default function Sidebar() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Bird size={24} color="var(--gold)" />
          <div>
            <h1>SnuggleState</h1>
            <span>Nest</span>
          </div>
        </div>
      </div>

      <nav className="sidebar-nav">
        {links.map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to} className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}>
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <NavLink to="/settings" className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}>
          <Settings size={18} />
          Settings
        </NavLink>
        <div className="sidebar-user" style={{ marginTop: 12 }}>
          <div className="sidebar-avatar">{initials(user?.name)}</div>
          <div>
            <div className="sidebar-user-name">{user?.name?.split(' ')[0]}</div>
            <div className="sidebar-user-role">{user?.role}</div>
          </div>
        </div>
        <button className="btn-signout" onClick={handleSignOut}>
          <LogOut size={15} />
          Sign out
        </button>
      </div>
    </aside>
  )
}
