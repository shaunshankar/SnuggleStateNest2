const { getPool } = require('../_db')
const { requireAuth } = require('../_auth')
const { handleCors } = require('../_cors')

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return
  if (req.method !== 'GET') return res.status(405).end()

  const auth = requireAuth(req, res)
  if (!auth) return

  const pool = getPool()
  try {
    const { rows } = await pool.query(
      `SELECT id, email, name, household_id, role, monthly_income, email_notifications
       FROM nest.users WHERE id = $1`,
      [auth.userId]
    )
    if (!rows.length) return res.status(404).json({ message: 'User not found' })
    res.json({ user: rows[0] })
  } catch (err) {
    console.error('me error', err)
    res.status(500).json({ message: 'Server error' })
  }
}
