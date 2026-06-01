import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Bird } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import toast from 'react-hot-toast'

export default function Signup() {
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' })
  const [loading, setLoading] = useState(false)
  const { signUp } = useAuth()
  const navigate = useNavigate()

  function set(k) { return e => setForm(f => ({ ...f, [k]: e.target.value })) }

  async function handleSubmit(e) {
    e.preventDefault()
    if (form.password !== form.confirm) return toast.error('Passwords do not match')
    setLoading(true)
    try {
      await signUp(form.email, form.password, form.name)
      navigate('/household-setup')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <Bird size={40} color="var(--gold)" style={{ margin: '0 auto 12px' }} />
          <h1>Create your Nest</h1>
          <p>Join SnuggleState Nest today</p>
        </div>
        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Full name</label>
            <input type="text" value={form.name} onChange={set('name')} placeholder="Your name" required autoFocus />
          </div>
          <div className="form-group">
            <label>Email address</label>
            <input type="email" value={form.email} onChange={set('email')} placeholder="you@example.com" required />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input type="password" value={form.password} onChange={set('password')} placeholder="Min. 8 characters" minLength={8} required />
          </div>
          <div className="form-group">
            <label>Confirm password</label>
            <input type="password" value={form.confirm} onChange={set('confirm')} placeholder="••••••••" required />
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} disabled={loading}>
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>
        <p className="auth-switch">Already have an account? <Link to="/login">Sign in</Link></p>
      </div>
    </div>
  )
}
