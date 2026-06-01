const bcrypt = require('bcryptjs')
const { getPool } = require('../_db')
const { signToken } = require('../_auth')
const { handleCors } = require('../_cors')

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return
  if (req.method !== 'POST') return res.status(405).end()

  const { email, password } = req.body || {}
  if (!email || !password)
    return res.status(400).json({ message: 'Email and password are required' })

  const pool = getPool()
  try {
    const { rows } = await pool.query(
      `SELECT id, email, name, password_hash, household_id, role, monthly_income, email_notifications
       FROM nest.users WHERE email = $1`,
      [email.toLowerCase()]
    )
    if (!rows.length)
      return res.status(401).json({ message: 'Invalid email or password' })

    const user = rows[0]
    const valid = await bcrypt.compare(password, user.password_hash)
    if (!valid)
      return res.status(401).json({ message: 'Invalid email or password' })

    const { password_hash, ...safeUser } = user
    const token = signToken({ userId: user.id, email: user.email, householdId: user.household_id })
    res.json({ token, user: safeUser })
  } catch (err) {
    console.error('login error', err)
    res.status(500).json({ message: 'Server error' })
  }
}
