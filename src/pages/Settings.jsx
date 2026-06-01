import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../utils/api'
import { useAuth } from '../hooks/useAuth'
import toast from 'react-hot-toast'

export default function Settings() {
  const { user, refreshUser, signOut } = useAuth()
  const navigate = useNavigate()
  const [profile, setProfile] = useState({ name: user?.name || '', monthly_income: user?.monthly_income || '', email_notifications: user?.email_notifications ?? true })
  const [passwords, setPasswords] = useState({ current: '', next: '', confirm: '' })
  const [saving, setSaving] = useState(false)
  const [savingPw, setSavingPw] = useState(false)

  async function handleSaveProfile(e) {
    e.preventDefault()
    setSaving(true)
    try {
      await api.put('/users', { name: profile.name, monthly_income: profile.monthly_income, email_notifications: profile.email_notifications })
      await refreshUser()
      toast.success('Settings saved')
    } catch (err) { toast.error(err.message) }
    finally { setSaving(false) }
  }

  async function handleChangePassword(e) {
    e.preventDefault()
    if (passwords.next !== passwords.confirm) return toast.error('Passwords do not match')
    if (passwords.next.length < 8) return toast.error('Password must be at least 8 characters')
    setSavingPw(true)
    try {
      await api.put('/users', { current_password: passwords.current, new_password: passwords.next })
      setPasswords({ current: '', next: '', confirm: '' })
      toast.success('Password updated')
    } catch (err) { toast.error(err.message) }
    finally { setSavingPw(false) }
  }

  async function handleLeaveHousehold() {
    if (!confirm('Are you sure you want to leave your household? You will lose access to all shared data.')) return
    try {
      await api.del('/users')
      await refreshUser()
      toast.success('You have left the household')
      navigate('/household-setup')
    } catch (err) { toast.error(err.message) }
  }

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  return (
    <div style={{ maxWidth: 600 }}>
      <div className="page-header">
        <h2>Settings</h2>
        <p>Manage your account and preferences</p>
      </div>

      {/* Profile */}
      <div className="card" style={{ marginBottom: 20 }}>
        <h3 style={{ fontSize: '1rem', marginBottom: 20 }}>Profile</h3>
        <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="form-group">
            <label>Display name</label>
            <input type="text" value={profile.name} onChange={e => setProfile(p => ({ ...p, name: e.target.value }))} required />
          </div>
          <div className="form-group">
            <label>Email address</label>
            <input type="email" value={user?.email} disabled style={{ opacity: 0.5 }} />
          </div>
          <div className="form-group">
            <label>Monthly income ($)</label>
            <input type="number" step="0.01" min="0" value={profile.monthly_income} onChange={e => setProfile(p => ({ ...p, monthly_income: e.target.value }))} placeholder="0.00" />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input type="checkbox" id="email_notif" checked={profile.email_notifications} onChange={e => setProfile(p => ({ ...p, email_notifications: e.target.checked }))} style={{ width: 16, height: 16 }} />
            <label htmlFor="email_notif" style={{ margin: 0, cursor: 'pointer' }}>Email notifications for bill reminders</label>
          </div>
          <button type="submit" className="btn btn-primary" style={{ alignSelf: 'flex-start' }} disabled={saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </form>
      </div>

      {/* Password */}
      <div className="card" style={{ marginBottom: 20 }}>
        <h3 style={{ fontSize: '1rem', marginBottom: 20 }}>Change Password</h3>
        <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="form-group">
            <label>Current password</label>
            <input type="password" value={passwords.current} onChange={e => setPasswords(p => ({ ...p, current: e.target.value }))} required />
          </div>
          <div className="form-group">
            <label>New password</label>
            <input type="password" value={passwords.next} onChange={e => setPasswords(p => ({ ...p, next: e.target.value }))} minLength={8} required />
          </div>
          <div className="form-group">
            <label>Confirm new password</label>
            <input type="password" value={passwords.confirm} onChange={e => setPasswords(p => ({ ...p, confirm: e.target.value }))} required />
          </div>
          <button type="submit" className="btn btn-primary" style={{ alignSelf: 'flex-start' }} disabled={savingPw}>
            {savingPw ? 'Updating…' : 'Update password'}
          </button>
        </form>
      </div>

      {/* Danger zone */}
      <div className="card" style={{ borderColor: 'rgba(239,68,68,0.2)' }}>
        <h3 style={{ fontSize: '1rem', marginBottom: 16, color: 'var(--danger)' }}>Danger Zone</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {user?.household_id && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <div>
                <div style={{ fontWeight: 500, fontSize: '0.9rem' }}>Leave household</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: 2 }}>You will lose access to all shared household data</div>
              </div>
              <button className="btn btn-danger btn-sm" onClick={handleLeaveHousehold}>Leave</button>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 4 }}>
            <div>
              <div style={{ fontWeight: 500, fontSize: '0.9rem' }}>Sign out</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: 2 }}>Sign out of your account on this device</div>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={handleSignOut}>Sign out</button>
          </div>
        </div>
      </div>
    </div>
  )
}
