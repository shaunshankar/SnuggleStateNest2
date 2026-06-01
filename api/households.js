const { getPool } = require('./_db')
const { requireAuth, signToken } = require('./_auth')
const { handleCors } = require('./_cors')

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return
  const auth = requireAuth(req, res)
  if (!auth) return
  const pool = getPool()
  const action = req.query.action

  // POST /api/households/join  (rewritten to ?action=join)
  if (action === 'join') {
    if (req.method !== 'POST') return res.status(405).end()
    if (auth.householdId) return res.status(400).json({ message: 'You are already in a household' })
    const { invite_code } = req.body || {}
    if (!invite_code) return res.status(400).json({ message: 'Invite code is required' })
    try {
      const { rows } = await pool.query('SELECT * FROM nest.households WHERE invite_code=$1', [invite_code.toUpperCase().trim()])
      if (!rows.length) return res.status(404).json({ message: 'Invalid invite code' })
      const hh = rows[0]
      await pool.query(`UPDATE nest.users SET household_id=$1, role='member' WHERE id=$2`, [hh.id, auth.userId])
      const token = signToken({ userId: auth.userId, email: auth.email, householdId: hh.id })
      return res.json({ household: hh, token })
    } catch (err) { console.error(err); return res.status(500).json({ message: 'Server error' }) }
  }

  // GET /api/households
  if (req.method === 'GET') {
    if (!auth.householdId) return res.json({ household: null, members: [] })
    try {
      const [hhRes, membersRes] = await Promise.all([
        pool.query('SELECT * FROM nest.households WHERE id=$1', [auth.householdId]),
        pool.query('SELECT id, name, email, role FROM nest.users WHERE household_id=$1', [auth.householdId])
      ])
      return res.json({ household: hhRes.rows[0] || null, members: membersRes.rows })
    } catch (err) { console.error(err); return res.status(500).json({ message: 'Server error' }) }
  }

  // POST /api/households  (create)
  if (req.method === 'POST') {
    const { name } = req.body || {}
    if (!name) return res.status(400).json({ message: 'Household name is required' })
    if (auth.householdId) return res.status(400).json({ message: 'You are already in a household' })
    try {
      const codeRes = await pool.query('SELECT nest.generate_invite_code() AS code')
      const code = codeRes.rows[0].code
      const client = await pool.connect()
      try {
        await client.query('BEGIN')
        const hhRes = await client.query(
          'INSERT INTO nest.households (name, invite_code, created_by) VALUES ($1,$2,$3) RETURNING *',
          [name.trim(), code, auth.userId]
        )
        const hh = hhRes.rows[0]
        await client.query(`UPDATE nest.users SET household_id=$1, role='owner' WHERE id=$2`, [hh.id, auth.userId])
        await client.query('COMMIT')
        const token = signToken({ userId: auth.userId, email: auth.email, householdId: hh.id })
        return res.status(201).json({ household: hh, token })
      } catch (e) { await client.query('ROLLBACK'); throw e }
      finally { client.release() }
    } catch (err) { console.error(err); return res.status(500).json({ message: 'Server error' }) }
  }

  res.status(405).end()
}
