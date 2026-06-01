const { getPool } = require('../_db')
const { requireAuth } = require('../_auth')
const { handleCors } = require('../_cors')

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return
  if (req.method !== 'POST') return res.status(405).end()

  const auth = requireAuth(req, res)
  if (!auth) return
  if (!auth.householdId) return res.status(403).json({ message: 'No household' })

  const { bill_id, paid_date } = req.body || {}
  if (!bill_id) return res.status(400).json({ message: 'bill_id required' })

  const pool = getPool()
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const billRes = await client.query(
      'SELECT * FROM nest.bills WHERE id=$1 AND household_id=$2',
      [bill_id, auth.householdId]
    )
    if (!billRes.rows.length) {
      await client.query('ROLLBACK')
      return res.status(404).json({ message: 'Bill not found' })
    }
    const bill = billRes.rows[0]
    const date = paid_date || new Date().toISOString().split('T')[0]

    await client.query(
      `UPDATE nest.bills SET is_paid=true, paid_date=$1 WHERE id=$2`,
      [date, bill_id]
    )

    const txRes = await client.query(
      `INSERT INTO nest.transactions
         (household_id, user_email, amount, type, category, description, date, created_by)
       VALUES ($1,$2,$3,'expense',$4,$5,$6,$7) RETURNING *`,
      [auth.householdId, auth.email, bill.amount, bill.category, `${bill.name} (bill payment)`, date, auth.userId]
    )

    await client.query('COMMIT')
    res.json({ bill: { ...bill, is_paid: true, paid_date: date }, transaction: txRes.rows[0] })
  } catch (err) {
    await client.query('ROLLBACK')
    console.error(err)
    res.status(500).json({ message: 'Server error' })
  } finally {
    client.release()
  }
}
