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
    const { category, type, search, from, to, limit = 100, offset = 0 } = req.query
    let where = ['household_id = $1']
    const params = [auth.householdId]
    let idx = 2
    if (category) { where.push(`category = $${idx++}`); params.push(category) }
    if (type) { where.push(`type = $${idx++}`); params.push(type) }
    if (from) { where.push(`date >= $${idx++}`); params.push(from) }
    if (to) { where.push(`date <= $${idx++}`); params.push(to) }
    if (search) { where.push(`description ILIKE $${idx++}`); params.push(`%${search}%`) }
    try {
      const { rows } = await pool.query(
        `SELECT * FROM nest.transactions WHERE ${where.join(' AND ')}
         ORDER BY date DESC, created_at DESC LIMIT $${idx++} OFFSET $${idx}`,
        [...params, parseInt(limit), parseInt(offset)]
      )
      return res.json({ transactions: rows })
    } catch (err) { console.error(err); return res.status(500).json({ message: 'Server error' }) }

  } else if (req.method === 'POST') {
    const { amount, type, category, description, date, notes, is_imported } = req.body || {}
    if (!amount || !type || !category || !description || !date)
      return res.status(400).json({ message: 'Missing required fields' })
    try {
      const { rows } = await pool.query(
        `INSERT INTO nest.transactions
           (household_id, user_email, amount, type, category, description, date, notes, is_imported, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
        [auth.householdId, auth.email, amount, type, category, description, date, notes || null, is_imported || false, auth.userId]
      )
      return res.status(201).json({ transaction: rows[0] })
    } catch (err) { console.error(err); return res.status(500).json({ message: 'Server error' }) }
  }

  res.status(405).end()
}
