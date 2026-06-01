const bcrypt = require('bcryptjs')
const { getPool } = require('../_db')
const { signToken } = require('../_auth')
const { handleCors } = require('../_cors')

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return
  if (req.method !== 'POST') return res.status(405).end()

  const { email, password, name } = req.body || {}
  if (!email || !password || !name)
    return res.status(400).json({ message: 'Name, email and password are required' })
  if (password.length < 8)
    return res.status(400).json({ message: 'Password must be at least 8 characters' })

  const pool = getPool()
  try {
    const existing = await pool.query('SELECT id FROM nest.users WHERE email = $1', [email.toLowerCase()])
    if (existing.rows.length > 0)
      return res.status(409).json({ message: 'An account with this email already exists' })

    const hash = await bcrypt.hash(password, 12)
    const { rows } = await pool.query(
      `INSERT INTO nest.users (email, name, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, email, name, household_id, role, monthly_income, email_notifications`,
      [email.toLowerCase(), name.trim(), hash]
    )
    const user = rows[0]
    const token = signToken({ userId: user.id, email: user.email, householdId: user.household_id })
    res.status(201).json({ token, user })
  } catch (err) {
    console.error('signup error', err)
    res.status(500).json({ message: 'Server error' })
  }
}
