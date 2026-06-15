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
  const action = req.query.action  // 'pay'

  // POST /api/bills/pay  (rewritten to ?action=pay)
  if (action === 'pay') {
    if (req.method !== 'POST') return res.status(405).end()
    const { bill_id, paid_date } = req.body || {}
    if (!bill_id) return res.status(400).json({ message: 'bill_id required' })
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const billRes = await client.query('SELECT * FROM nest.bills WHERE id=$1 AND household_id=$2', [bill_id, auth.householdId])
      if (!billRes.rows.length) { await client.query('ROLLBACK'); return res.status(404).json({ message: 'Bill not found' }) }
      const bill = billRes.rows[0]
      const date = paid_date || new Date().toISOString().split('T')[0]
      await client.query('UPDATE nest.bills SET is_paid=true, paid_date=$1 WHERE id=$2', [date, bill_id])
      const txRes = await client.query(
        `INSERT INTO nest.transactions (household_id, user_email, amount, type, category, description, date, created_by)
         VALUES ($1,$2,$3,'expense',$4,$5,$6,$7) RETURNING *`,
        [auth.householdId, auth.email, bill.amount, bill.category, `${bill.name} (bill payment)`, date, auth.userId]
      )
      await client.query('COMMIT')
      return res.json({ bill: { ...bill, is_paid: true, paid_date: date }, transaction: txRes.rows[0] })
    } catch (err) { await client.query('ROLLBACK'); console.error(err); return res.status(500).json({ message: 'Server error' }) }
    finally { client.release() }
  }

  // /api/bills/:id  — update & delete
  if (id) {
    if (req.method === 'PUT') {
      const { name, amount, due_day, frequency, category } = req.body || {}
      try {
        const { rows } = await pool.query(
          `UPDATE nest.bills SET name=$1,amount=$2,due_day=$3,frequency=$4,category=$5
           WHERE id=$6 AND household_id=$7 RETURNING *`,
          [name, amount, due_day, frequency, category, id, auth.householdId]
        )
        if (!rows.length) return res.status(404).json({ message: 'Not found' })
        return res.json({ bill: rows[0] })
      } catch (err) { console.error(err); return res.status(500).json({ message: 'Server error' }) }
    }
    if (req.method === 'DELETE') {
      try {
        await pool.query('DELETE FROM nest.bills WHERE id=$1 AND household_id=$2', [id, auth.householdId])
        return res.json({ success: true })
      } catch (err) { console.error(err); return res.status(500).json({ message: 'Server error' }) }
    }
    return res.status(405).end()
  }

  // /api/bills  — list & create
  if (req.method === 'GET') {
    try {
      const { rows } = await pool.query('SELECT * FROM nest.bills WHERE household_id=$1 ORDER BY due_day ASC', [auth.householdId])
      return res.json({ bills: rows })
    } catch (err) { console.error(err); return res.status(500).json({ message: 'Server error' }) }
  }

  if (req.method === 'POST') {
    // Batch insert (AI-detected bills) with dedup by name
    if (Array.isArray(req.body?.bills)) {
      let imported = 0, skipped = 0
      try {
        for (const b of req.body.bills) {
          if (!b.name || !b.amount || !b.due_day || !b.frequency || !b.category) { skipped++; continue }
          const dup = await pool.query(
            'SELECT id FROM nest.bills WHERE household_id=$1 AND LOWER(name)=LOWER($2)',
            [auth.householdId, b.name]
          )
          if (dup.rows.length) { skipped++; continue }
          await pool.query(
            `INSERT INTO nest.bills (household_id, name, amount, due_day, frequency, category, detected, created_by)
             VALUES ($1,$2,$3,$4,$5,$6,true,$7)`,
            [auth.householdId, b.name, b.amount, b.due_day, b.frequency, b.category, auth.userId]
          )
          imported++
        }
        return res.json({ imported, skipped })
      } catch (err) { console.error(err); return res.status(500).json({ message: 'Server error' }) }
    }

    const { name, amount, due_day, frequency, category } = req.body || {}
    if (!name || !amount || !due_day || !frequency || !category)
      return res.status(400).json({ message: 'All fields required' })
    try {
      const { rows } = await pool.query(
        `INSERT INTO nest.bills (household_id, name, amount, due_day, frequency, category, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        [auth.householdId, name, amount, due_day, frequency, category, auth.userId]
      )
      return res.status(201).json({ bill: rows[0] })
    } catch (err) { console.error(err); return res.status(500).json({ message: 'Server error' }) }
  }

  res.status(405).end()
}
