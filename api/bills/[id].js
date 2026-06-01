const { getPool } = require('../_db')
const { requireAuth } = require('../_auth')
const { handleCors } = require('../_cors')

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return

  const auth = requireAuth(req, res)
  if (!auth) return
  if (!auth.householdId) return res.status(403).json({ message: 'No household' })

  const id = req.query.id || req.params?.id
  if (!id) return res.status(400).json({ message: 'ID required' })

  const pool = getPool()

  if (req.method === 'PUT') {
    const { name, amount, due_day, frequency, category } = req.body || {}
    try {
      const { rows } = await pool.query(
        `UPDATE nest.bills SET name=$1, amount=$2, due_day=$3, frequency=$4, category=$5
         WHERE id=$6 AND household_id=$7 RETURNING *`,
        [name, amount, due_day, frequency, category, id, auth.householdId]
      )
      if (!rows.length) return res.status(404).json({ message: 'Not found' })
      res.json({ bill: rows[0] })
    } catch (err) {
      console.error(err)
      res.status(500).json({ message: 'Server error' })
    }

  } else if (req.method === 'DELETE') {
    try {
      await pool.query(
        'DELETE FROM nest.bills WHERE id=$1 AND household_id=$2',
        [id, auth.householdId]
      )
      res.json({ success: true })
    } catch (err) {
      console.error(err)
      res.status(500).json({ message: 'Server error' })
    }
  } else {
    res.status(405).end()
  }
}
