import { useState, useEffect } from 'react'
import { Copy, Home, Crown, User } from 'lucide-react'
import { api } from '../utils/api'
import { useAuth } from '../hooks/useAuth'
import { formatDate } from '../utils/formatters'
import { initials } from '../utils/formatters'
import toast from 'react-hot-toast'

export default function Household() {
  const { user } = useAuth()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/households')
      .then(d => setData(d))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  function copyCode() {
    navigator.clipboard.writeText(data.household.invite_code)
    toast.success('Invite code copied!')
  }

  if (loading) return <div className="skeleton" style={{ height: 200, borderRadius: 12 }} />
  if (!data?.household) return <div className="empty-state"><h3>No household found</h3></div>

  const { household, members } = data

  return (
    <div>
      <div className="page-header">
        <h2>Household</h2>
        <p>Manage your shared Nest</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Household info */}
        <div className="card card-gold">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <div style={{ width: 48, height: 48, background: 'var(--gold-dim)', border: '1px solid var(--gold-border)', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Home size={22} color="var(--gold)" />
            </div>
            <div>
              <h3 style={{ fontSize: '1.2rem' }}>{household.name}</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: 2 }}>
                Created {formatDate(household.created_at)}
              </p>
            </div>
          </div>

          <div style={{ marginBottom: 8 }}>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.8px' }}>Invite Code</p>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <div className="invite-code" style={{ flex: 1, fontSize: '1.4rem', letterSpacing: 6 }}>
                {household.invite_code}
              </div>
              <button className="btn btn-secondary btn-sm" onClick={copyCode}>
                <Copy size={14} />
              </button>
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 8 }}>
              Share this code with household members to invite them
            </p>
          </div>
        </div>

        {/* Members */}
        <div className="card">
          <h3 style={{ fontSize: '1rem', marginBottom: 16 }}>Members ({members.length})</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {members.map(m => (
              <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div className="sidebar-avatar" style={{ width: 40, height: 40, fontSize: '0.9rem', flexShrink: 0 }}>
                  {initials(m.name)}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500, fontSize: '0.9rem' }}>{m.name}{m.id === user?.id ? ' (you)' : ''}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{m.email}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', color: m.role === 'owner' ? 'var(--gold-light)' : 'var(--text-secondary)' }}>
                  {m.role === 'owner' ? <Crown size={13} /> : <User size={13} />}
                  {m.role}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
