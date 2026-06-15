const { getPool } = require('./_db')
const { requireAuth } = require('./_auth')
const { handleCors } = require('./_cors')

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return
  const auth = requireAuth(req, res)
  if (!auth) return
  if (!auth.householdId) return res.status(403).json({ message: 'No household' })
  const pool = getPool()
  const id = req.query.id  // set by rewrite for /api/transactions/:id

  // /api/transactions/:id  — update & delete
  if (id) {
    if (req.method === 'PUT') {
      const { amount, type, category, description, date, notes } = req.body || {}
      try {
        const { rows } = await pool.query(
          `UPDATE nest.transactions SET amount=$1,type=$2,category=$3,description=$4,date=$5,notes=$6
           WHERE id=$7 AND household_id=$8 RETURNING *`,
          [amount, type, category, description, date, notes || null, id, auth.householdId]
        )
        if (!rows.length) return res.status(404).json({ message: 'Not found' })
        return res.json({ transaction: rows[0] })
      } catch (err) { console.error(err); return res.status(500).json({ message: 'Server error' }) }
    }
    if (req.method === 'DELETE') {
      try {
        await pool.query('DELETE FROM nest.transactions WHERE id=$1 AND household_id=$2', [id, auth.householdId])
        return res.json({ success: true })
      } catch (err) { console.error(err); return res.status(500).json({ message: 'Server error' }) }
    }
    return res.status(405).end()
  }

  // /api/transactions  — list & create
  if (req.method === 'GET') {
    const { category, type, source, search, from, to, limit = 100, offset = 0 } = req.query
    let where = ['household_id = $1']
    const params = [auth.householdId]
    let idx = 2
    if (category) { where.push(`category = $${idx++}`); params.push(category) }
    if (type) { where.push(`type = $${idx++}`); params.push(type) }
    if (source) { where.push(`source = $${idx++}`); params.push(source) }
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
  }

  if (req.method === 'POST') {
    // Batch import with deduplication
    if (Array.isArray(req.body?.transactions)) {
      const rows = req.body.transactions
      let imported = 0
      let skipped = 0
      try {
        for (const tx of rows) {
          const source = tx.source || 'everyday'
          const dup = await pool.query(
            `SELECT id FROM nest.transactions
             WHERE household_id=$1 AND date=$2 AND amount=$3 AND description=$4 AND source=$5`,
            [auth.householdId, tx.date, tx.amount, tx.description, source]
          )
          if (dup.rows.length) { skipped++; continue }
          await pool.query(
            `INSERT INTO nest.transactions
               (household_id, user_email, amount, type, category, description, date, notes, is_imported, source, created_by)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,true,$9,$10)`,
            [auth.householdId, auth.email, tx.amount, tx.type, tx.category, tx.description, tx.date, tx.notes || null, source, auth.userId]
          )
          imported++
        }
        return res.json({ imported, skipped })
      } catch (err) { console.error(err); return res.status(500).json({ message: 'Server error' }) }
    }

    // Single transaction
    const { amount, type, category, description, date, notes, is_imported, source } = req.body || {}
    if (!amount || !type || !category || !description || !date)
      return res.status(400).json({ message: 'Missing required fields' })
    try {
      const { rows } = await pool.query(
        `INSERT INTO nest.transactions
           (household_id, user_email, amount, type, category, description, date, notes, is_imported, source, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
        [auth.householdId, auth.email, amount, type, category, description, date, notes || null, is_imported || false, source || 'everyday', auth.userId]
      )
      return res.status(201).json({ transaction: rows[0] })
    } catch (err) { console.error(err); return res.status(500).json({ message: 'Server error' }) }
  }

  res.status(405).end()
}
