import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { api } from '../utils/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  const loadUser = useCallback(async () => {
    const token = localStorage.getItem('token')
    if (!token) { setLoading(false); return }
    try {
      const { user } = await api.get('/auth/me')
      setUser(user)
    } catch {
      localStorage.removeItem('token')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadUser() }, [loadUser])

  async function signUp(email, password, name) {
    const { token, user } = await api.post('/auth/signup', { email, password, name })
    localStorage.setItem('token', token)
    setUser(user)
    return user
  }

  async function signIn(email, password) {
    const { token, user } = await api.post('/auth/login', { email, password })
    localStorage.setItem('token', token)
    setUser(user)
    return user
  }

  async function signOut() {
    localStorage.removeItem('token')
    setUser(null)
  }

  async function refreshUser() {
    try {
      const { user } = await api.get('/auth/me')
      setUser(user)
      return user
    } catch { return null }
  }

  function updateToken(token) {
    localStorage.setItem('token', token)
  }

  return (
    <AuthContext.Provider value={{ user, loading, signUp, signIn, signOut, refreshUser, updateToken, setUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be inside AuthProvider')
  return ctx
}
