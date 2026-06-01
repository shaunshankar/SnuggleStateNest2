const { getPool } = require('./_db')
const { requireAuth } = require('./_auth')
const { handleCors } = require('./_cors')

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return
  const auth = requireAuth(req, res)
  if (!auth) return
  if (!auth.householdId) return res.status(403).json({ message: 'No household' })
  const pool = getPool()

  if (req.method === 'GET') {
    try {
      const now = new Date()
      const start = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]
      const [budgetsRes, spendRes] = await Promise.all([
        pool.query('SELECT * FROM nest.budgets WHERE household_id=$1 ORDER BY category', [auth.householdId]),
        pool.query(
          `SELECT category, SUM(amount) AS spent FROM nest.transactions
           WHERE household_id=$1 AND type='expense' AND date BETWEEN $2 AND $3 GROUP BY category`,
          [auth.householdId, start, end]
        )
      ])
      const spendMap = {}
      spendRes.rows.forEach(r => { spendMap[r.category] = parseFloat(r.spent) })
      const budgets = budgetsRes.rows.map(b => ({ ...b, spent: spendMap[b.category] || 0 }))
      return res.json({ budgets })
    } catch (err) { console.error(err); return res.status(500).json({ message: 'Server error' }) }
  }

  if (req.method === 'POST') {
    const { category, monthly_limit } = req.body || {}
    if (!category || monthly_limit == null) return res.status(400).json({ message: 'Category and limit required' })
    try {
      const { rows } = await pool.query(
        `INSERT INTO nest.budgets (household_id, category, monthly_limit, created_by)
         VALUES ($1,$2,$3,$4)
         ON CONFLICT (household_id, category) DO UPDATE SET monthly_limit=$3, updated_at=NOW()
         RETURNING *`,
        [auth.householdId, category, monthly_limit, auth.userId]
      )
      return res.status(201).json({ budget: rows[0] })
    } catch (err) { console.error(err); return res.status(500).json({ message: 'Server error' }) }
  }

  if (req.method === 'DELETE') {
    const { category } = req.query
    if (!category) return res.status(400).json({ message: 'Category required' })
    try {
      await pool.query('DELETE FROM nest.budgets WHERE household_id=$1 AND category=$2', [auth.householdId, category])
      return res.json({ success: true })
    } catch (err) { console.error(err); return res.status(500).json({ message: 'Server error' }) }
  }

  res.status(405).end()
}
