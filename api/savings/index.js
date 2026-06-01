const { getPool } = require('../_db')
const { requireAuth } = require('../_auth')
const { handleCors } = require('../_cors')

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return

  const auth = requireAuth(req, res)
  if (!auth) return
  if (!auth.householdId) return res.status(403).json({ message: 'No household' })

  const pool = getPool()

  if (req.method === 'GET') {
    try {
      const { rows } = await pool.query(
        'SELECT * FROM nest.savings_goals WHERE household_id=$1 ORDER BY created_at DESC',
        [auth.householdId]
      )
      res.json({ goals: rows })
    } catch (err) {
      console.error(err)
      res.status(500).json({ message: 'Server error' })
    }

  } else if (req.method === 'POST') {
    const { name, target_amount, target_date, description } = req.body || {}
    if (!name || !target_amount)
      return res.status(400).json({ message: 'Name and target amount required' })

    try {
      const { rows } = await pool.query(
        `INSERT INTO nest.savings_goals (household_id, name, target_amount, target_date, description, created_by)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
        [auth.householdId, name, target_amount, target_date || null, description || null, auth.userId]
      )
      res.status(201).json({ goal: rows[0] })
    } catch (err) {
      console.error(err)
      res.status(500).json({ message: 'Server error' })
    }
  } else {
    res.status(405).end()
  }
}
