const { getPool } = require('./_db')
const { requireAuth } = require('./_auth')
const { handleCors } = require('./_cors')

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return
  const auth = requireAuth(req, res)
  if (!auth) return
  if (!auth.householdId) return res.status(403).json({ message: 'No household' })
  const pool = getPool()
  const id = req.query.id
  const action = req.query.action  // 'contribute'

  // POST /api/savings/contribute  (rewritten to ?action=contribute)
  if (action === 'contribute') {
    if (req.method !== 'POST') return res.status(405).end()
    const { goal_id, amount, date, notes } = req.body || {}
    if (!goal_id || !amount) return res.status(400).json({ message: 'goal_id and amount required' })
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
    } catch (err) { await client.query('ROLLBACK'); console.error(err); return res.status(500).json({ message: 'Server error' }) }
    finally { client.release() }
  }

  // /api/savings/:id  — update & delete
  if (id) {
    if (req.method === 'PUT') {
      const { name, target_amount, target_date, description } = req.body || {}
      try {
        const { rows } = await pool.query(
          `UPDATE nest.savings_goals SET name=$1,target_amount=$2,target_date=$3,description=$4
           WHERE id=$5 AND household_id=$6 RETURNING *`,
          [name, target_amount, target_date || null, description || null, id, auth.householdId]
        )
        if (!rows.length) return res.status(404).json({ message: 'Not found' })
        return res.json({ goal: rows[0] })
      } catch (err) { console.error(err); return res.status(500).json({ message: 'Server error' }) }
    }
    if (req.method === 'DELETE') {
      try {
        await pool.query('DELETE FROM nest.savings_goals WHERE id=$1 AND household_id=$2', [id, auth.householdId])
        return res.json({ success: true })
      } catch (err) { console.error(err); return res.status(500).json({ message: 'Server error' }) }
    }
    return res.status(405).end()
  }

  // /api/savings  — list & create
  if (req.method === 'GET') {
    try {
      const { rows } = await pool.query('SELECT * FROM nest.savings_goals WHERE household_id=$1 ORDER BY created_at DESC', [auth.householdId])
      return res.json({ goals: rows })
    } catch (err) { console.error(err); return res.status(500).json({ message: 'Server error' }) }
  }

  if (req.method === 'POST') {
    const { name, target_amount, target_date, description } = req.body || {}
    if (!name || !target_amount) return res.status(400).json({ message: 'Name and target amount required' })
    try {
      const { rows } = await pool.query(
        `INSERT INTO nest.savings_goals (household_id, name, target_amount, target_date, description, created_by)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
        [auth.householdId, name, target_amount, target_date || null, description || null, auth.userId]
      )
      return res.status(201).json({ goal: rows[0] })
    } catch (err) { console.error(err); return res.status(500).json({ message: 'Server error' }) }
  }

  res.status(405).end()
}
