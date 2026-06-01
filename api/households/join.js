const { getPool } = require('../_db')
const { requireAuth, signToken } = require('../_auth')
const { handleCors } = require('../_cors')

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return
  if (req.method !== 'POST') return res.status(405).end()
  const auth = requireAuth(req, res)
  if (!auth) return
  if (auth.householdId) return res.status(400).json({ message: 'You are already in a household' })

  const { invite_code } = req.body || {}
  if (!invite_code) return res.status(400).json({ message: 'Invite code is required' })

  const pool = getPool()
  try {
    const { rows } = await pool.query('SELECT * FROM nest.households WHERE invite_code=$1', [invite_code.toUpperCase().trim()])
    if (!rows.length) return res.status(404).json({ message: 'Invalid invite code' })
    const hh = rows[0]
    await pool.query(`UPDATE nest.users SET household_id=$1, role='member' WHERE id=$2`, [hh.id, auth.userId])
    const newToken = signToken({ userId: auth.userId, email: auth.email, householdId: hh.id })
    return res.json({ household: hh, token: newToken })
  } catch (err) { console.error(err); return res.status(500).json({ message: 'Server error' }) }
}
