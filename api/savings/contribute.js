const { getPool } = require('../_db')
const { requireAuth } = require('../_auth')
const { handleCors } = require('../_cors')

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return
  if (req.method !== 'POST') return res.status(405).end()
  const auth = requireAuth(req, res)
  if (!auth) return
  if (!auth.householdId) return res.status(403).json({ message: 'No household' })

  const { goal_id, amount, date, notes } = req.body || {}
  if (!goal_id || !amount) return res.status(400).json({ message: 'goal_id and amount required' })

  const pool = getPool()
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const goalRes = await client.query('SELECT * FROM nest.savings_goals WHERE id=$1 AND household_id=$2', [goal_id, auth.householdId])
    if (!goalRes.rows.length) { await client.query('ROLLBACK'); return res.status(404).json({ message: 'Goal not found' }) }
    const goal = goalRes.rows[0]
    const contribDate = date || new Date().toISOString().split('T')[0]
    const contribRes = await client.query(
      `INSERT INTO nest.savings_contributions (goal_id, household_id, amount, date, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [goal_id, auth.householdId, amount, contribDate, notes || null, auth.userId]
    )
    const newAmount = parseFloat(goal.current_amount) + parseFloat(amount)
    const updatedGoal = await client.query('UPDATE nest.savings_goals SET current_amount=$1 WHERE id=$2 RETURNING *', [newAmount, goal_id])
    await client.query(
      `INSERT INTO nest.transactions (household_id, user_email, amount, type, category, description, date, notes, created_by)
       VALUES ($1,$2,$3,'expense','savings',$4,$5,$6,$7)`,
      [auth.householdId, auth.email, amount, `Savings: ${goal.name}`, contribDate, notes || null, auth.userId]
    )
    await client.query('COMMIT')
    return res.json({ contribution: contribRes.rows[0], goal: updatedGoal.rows[0] })
  } catch (err) {
    await client.query('ROLLBACK'); console.error(err); return res.status(500).json({ message: 'Server error' })
  } finally { client.release() }
}
