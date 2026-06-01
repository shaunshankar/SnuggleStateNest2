const bcrypt = require('bcryptjs')
const { getPool } = require('../_db')
const { requireAuth } = require('../_auth')
const { handleCors } = require('../_cors')

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return

  const auth = requireAuth(req, res)
  if (!auth) return

  const pool = getPool()

  if (req.method === 'GET') {
    try {
      const { rows } = await pool.query(
        'SELECT id, email, name, household_id, role, monthly_income, email_notifications FROM nest.users WHERE id=$1',
        [auth.userId]
      )
      if (!rows.length) return res.status(404).json({ message: 'Not found' })
      res.json({ user: rows[0] })
    } catch (err) {
      console.error(err)
      res.status(500).json({ message: 'Server error' })
    }

  } else if (req.method === 'PUT') {
    const { name, monthly_income, email_notifications, current_password, new_password } = req.body || {}

    try {
      if (new_password) {
        if (!current_password) return res.status(400).json({ message: 'Current password required' })
        const { rows } = await pool.query('SELECT password_hash FROM nest.users WHERE id=$1', [auth.userId])
        const valid = await bcrypt.compare(current_password, rows[0].password_hash)
        if (!valid) return res.status(401).json({ message: 'Current password is incorrect' })
        const hash = await bcrypt.hash(new_password, 12)
        await pool.query('UPDATE nest.users SET password_hash=$1 WHERE id=$2', [hash, auth.userId])
      }

      const { rows } = await pool.query(
        `UPDATE nest.users
         SET name=COALESCE($1, name),
             monthly_income=COALESCE($2, monthly_income),
             email_notifications=COALESCE($3, email_notifications)
         WHERE id=$4
         RETURNING id, email, name, household_id, role, monthly_income, email_notifications`,
        [name || null, monthly_income ?? null, email_notifications ?? null, auth.userId]
      )
      res.json({ user: rows[0] })
    } catch (err) {
      console.error(err)
      res.status(500).json({ message: 'Server error' })
    }

  } else if (req.method === 'DELETE') {
    try {
      await pool.query('UPDATE nest.users SET household_id=NULL, role=$1 WHERE id=$2', ['member', auth.userId])
      res.json({ success: true })
    } catch (err) {
      console.error(err)
      res.status(500).json({ message: 'Server error' })
    }
  } else {
    res.status(405).end()
  }
}
