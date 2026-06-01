import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Home, Users, Bird } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { api } from '../utils/api'
import toast from 'react-hot-toast'

export default function HouseholdSetup() {
  const [mode, setMode] = useState(null)
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const { refreshUser, updateToken, setUser } = useAuth()
  const navigate = useNavigate()

  async function handleCreate(e) {
    e.preventDefault()
    setLoading(true)
    try {
      const { household, token } = await api.post('/households', { name })
      updateToken(token)
      const user = await refreshUser()
      toast.success('Household created! Welcome home 🏡')
      navigate('/dashboard')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleJoin(e) {
    e.preventDefault()
    setLoading(true)
    try {
      const { token } = await api.post('/households/join', { invite_code: code })
      updateToken(token)
      await refreshUser()
      toast.success('Joined household!')
      navigate('/dashboard')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div style={{ width: '100%', maxWidth: 440 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <Bird size={48} color="var(--gold)" style={{ margin: '0 auto 12px' }} />
          <h1 style={{ fontFamily: 'Playfair Display', fontSize: '1.8rem', color: 'var(--gold-light)' }}>Set up your Nest</h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: 6 }}>Create a new household or join an existing one</p>
        </div>

        {!mode ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {[
              { key: 'create', icon: Home, title: 'Create', sub: 'Start a new household' },
              { key: 'join', icon: Users, title: 'Join', sub: 'Use an invite code' }
            ].map(({ key, icon: Icon, title, sub }) => (
              <button key={key} onClick={() => setMode(key)} style={{
                background: 'var(--bg-card)', border: '1px solid var(--gold-border)',
                borderRadius: 'var(--radius-lg)', padding: '28px 20px', textAlign: 'center',
                cursor: 'pointer', transition: 'all 0.15s'
              }}
                onMouseEnter={e => e.currentTarget.style.boxShadow = 'var(--glow-gold)'}
                onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
              >
                <Icon size={32} color="var(--gold)" style={{ margin: '0 auto 12px' }} />
                <p style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{title}</p>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 4 }}>{sub}</p>
              </button>
            ))}
          </div>
        ) : (
          <div className="auth-card">
            <button onClick={() => setMode(null)} style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 6 }}>
              ← Back
            </button>
            <h2 style={{ marginBottom: 20, color: 'var(--gold-light)' }}>
              {mode === 'create' ? 'Create a household' : 'Join a household'}
            </h2>
            <form onSubmit={mode === 'create' ? handleCreate : handleJoin} className="auth-form">
              {mode === 'create' ? (
                <div className="form-group">
                  <label>Household name</label>
                  <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. The Smith Household" required autoFocus />
                </div>
              ) : (
                <div className="form-group">
                  <label>Invite code</label>
                  <input
                    type="text" value={code} onChange={e => setCode(e.target.value.toUpperCase())}
                    placeholder="ABCD1234" maxLength={8} required autoFocus
                    style={{ textAlign: 'center', letterSpacing: 6, fontFamily: 'Playfair Display', fontSize: '1.2rem' }}
                  />
                </div>
              )}
              <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} disabled={loading}>
                {loading ? '…' : mode === 'create' ? 'Create household' : 'Join household'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}
