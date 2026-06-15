const bcrypt = require('bcryptjs')
const { getPool } = require('./_db')
const { signToken, requireAuth } = require('./_auth')
const { handleCors } = require('./_cors')

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return
  const action = req.query.action

  if (action === 'signup') {
    if (req.method !== 'POST') return res.status(405).end()
    const { email, password, name } = req.body || {}
    if (!email || !password || !name)
      return res.status(400).json({ message: 'Name, email and password are required' })
    if (password.length < 8)
      return res.status(400).json({ message: 'Password must be at least 8 characters' })
    const pool = getPool()
    try {
      const existing = await pool.query('SELECT id FROM nest.users WHERE email=$1', [email.toLowerCase()])
      if (existing.rows.length) return res.status(409).json({ message: 'An account with this email already exists' })
      const hash = await bcrypt.hash(password, 12)
      const { rows } = await pool.query(
        `INSERT INTO nest.users (email, name, password_hash)
         VALUES ($1,$2,$3)
         RETURNING id, email, name, household_id, role, monthly_income, email_notifications, budget_cycle_start_day`,
        [email.toLowerCase(), name.trim(), hash]
      )
      const user = rows[0]
      return res.status(201).json({ token: signToken({ userId: user.id, email: user.email, householdId: user.household_id }), user })
    } catch (err) { console.error(err); return res.status(500).json({ message: 'Server error' }) }
  }

  if (action === 'login') {
    if (req.method !== 'POST') return res.status(405).end()
    const { email, password } = req.body || {}
    if (!email || !password) return res.status(400).json({ message: 'Email and password are required' })
    const pool = getPool()
    try {
      const { rows } = await pool.query(
        `SELECT id, email, name, password_hash, household_id, role, monthly_income, email_notifications, budget_cycle_start_day
         FROM nest.users WHERE email=$1`,
        [email.toLowerCase()]
      )
      if (!rows.length) return res.status(401).json({ message: 'Invalid email or password' })
      const user = rows[0]
      if (!await bcrypt.compare(password, user.password_hash))
        return res.status(401).json({ message: 'Invalid email or password' })
      const { password_hash, ...safeUser } = user
      return res.json({ token: signToken({ userId: user.id, email: user.email, householdId: user.household_id }), user: safeUser })
    } catch (err) { console.error(err); return res.status(500).json({ message: 'Server error' }) }
  }

  if (action === 'me') {
    if (req.method !== 'GET') return res.status(405).end()
    const auth = requireAuth(req, res)
    if (!auth) return
    const pool = getPool()
    try {
      const { rows } = await pool.query(
        'SELECT id, email, name, household_id, role, monthly_income, email_notifications, budget_cycle_start_day FROM nest.users WHERE id=$1',
        [auth.userId]
      )
      if (!rows.length) return res.status(404).json({ message: 'User not found' })
      return res.json({ user: rows[0] })
    } catch (err) { console.error(err); return res.status(500).json({ message: 'Server error' }) }
  }

  res.status(404).json({ message: 'Not found' })
}
