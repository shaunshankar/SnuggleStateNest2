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
        'SELECT * FROM nest.bills WHERE household_id=$1 ORDER BY due_day ASC',
        [auth.householdId]
      )
      res.json({ bills: rows })
    } catch (err) {
      console.error(err)
      res.status(500).json({ message: 'Server error' })
    }

  } else if (req.method === 'POST') {
    const { name, amount, due_day, frequency, category } = req.body || {}
    if (!name || !amount || !due_day || !frequency || !category)
      return res.status(400).json({ message: 'All fields required' })

    try {
      const { rows } = await pool.query(
        `INSERT INTO nest.bills (household_id, name, amount, due_day, frequency, category, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        [auth.householdId, name, amount, due_day, frequency, category, auth.userId]
      )
      res.status(201).json({ bill: rows[0] })
    } catch (err) {
      console.error(err)
      res.status(500).json({ message: 'Server error' })
    }
  } else {
    res.status(405).end()
  }
}
