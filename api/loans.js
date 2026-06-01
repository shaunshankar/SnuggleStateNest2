const { getPool } = require('./_db')
const { requireAuth } = require('./_auth')
const { handleCors } = require('./_cors')
require('dotenv').config()

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return
  const auth = requireAuth(req, res)
  if (!auth) return

  const pool = getPool()
  const id = req.query.id
  const action = req.query.action

  // ── POST /api/loans/repay ──────────────────────────────────────
  if (action === 'repay') {
    if (req.method !== 'POST') return res.status(405).end()
    const { loan_id, date, amount, principal_portion, interest_portion, balance_after, is_extra, notes } = req.body || {}
    if (!loan_id || !date || !amount) return res.status(400).json({ message: 'loan_id, date and amount required' })
    try {
      const check = await pool.query('SELECT id FROM nest.loans WHERE id=$1 AND user_id=$2', [loan_id, auth.userId])
      if (!check.rows.length) return res.status(404).json({ message: 'Loan not found' })
      const { rows } = await pool.query(
        `INSERT INTO nest.loan_repayments (loan_id, date, amount, principal_portion, interest_portion, balance_after, is_extra, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
        [loan_id, date, amount, principal_portion || null, interest_portion || null, balance_after || null, is_extra || false, notes || null]
      )
      if (balance_after != null) {
        await pool.query('UPDATE nest.loans SET current_balance=$1, updated_at=NOW() WHERE id=$2', [balance_after, loan_id])
      }
      return res.status(201).json({ repayment: rows[0] })
    } catch (err) { console.error(err); return res.status(500).json({ message: 'Server error' }) }
  }

  // ── POST /api/loans/insights ───────────────────────────────────
  if (action === 'insights') {
    if (req.method !== 'POST') return res.status(405).end()
    const { loans } = req.body || {}
    if (!loans?.length) return res.status(400).json({ message: 'Loan data required' })
    try {
      const loanSummary = loans.map(l =>
        `- ${l.name} (${l.type}): balance $${parseFloat(l.current_balance).toFixed(2)}, rate ${l.interest_rate}% p.a., minimum $${l.minimum_repayment}/month, ${l.years_remaining} years remaining`
      ).join('\n')

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 800,
          messages: [{
            role: 'user',
            content: `You are a personal finance advisor. Analyse these loans and give concise, actionable advice.\n\nLoans:\n${loanSummary}\n\nProvide:\n1. Which loan to prioritise and why (2-3 sentences)\n2. How much interest could be saved with an extra $100/month (calculate approximately)\n3. Whether refinancing might be worth exploring for any of these loans\n4. A plain-English summary of the overall debt situation\n\nBe specific, practical, and encouraging. Use Australian dollar amounts. Keep total response under 400 words.`
          }]
        })
      })
      const data = await response.json()
      return res.json({ insights: data.content?.[0]?.text || 'Unable to generate insights at this time.' })
    } catch (err) { console.error(err); return res.status(500).json({ message: 'Failed to generate insights' }) }
  }

  // ── PUT/DELETE /api/loans?id=:id ───────────────────────────────
  if (id) {
    if (req.method === 'PUT') {
      const { name, type, original_amount, current_balance, interest_rate, minimum_repayment, repayment_frequency, start_date, years_remaining, extra_repayment, notes } = req.body || {}
      try {
        const { rows } = await pool.query(
          `UPDATE nest.loans SET name=$1, type=$2, original_amount=$3, current_balance=$4, interest_rate=$5,
           minimum_repayment=$6, repayment_frequency=$7, start_date=$8, years_remaining=$9, extra_repayment=$10, notes=$11
           WHERE id=$12 AND user_id=$13 RETURNING *`,
          [name, type, original_amount, current_balance, interest_rate, minimum_repayment,
           repayment_frequency || 'monthly', start_date || null, years_remaining, extra_repayment || 0, notes || null, id, auth.userId]
        )
        if (!rows.length) return res.status(404).json({ message: 'Not found' })
        return res.json({ loan: rows[0] })
      } catch (err) { console.error(err); return res.status(500).json({ message: 'Server error' }) }
    }

    if (req.method === 'DELETE') {
      try {
        await pool.query('DELETE FROM nest.loans WHERE id=$1 AND user_id=$2', [id, auth.userId])
        return res.json({ success: true })
      } catch (err) { console.error(err); return res.status(500).json({ message: 'Server error' }) }
    }

    // GET /api/loans?id=:id — get loan with repayments
    if (req.method === 'GET') {
      try {
        const [loanRes, repRes] = await Promise.all([
          pool.query('SELECT * FROM nest.loans WHERE id=$1 AND user_id=$2', [id, auth.userId]),
          pool.query('SELECT * FROM nest.loan_repayments WHERE loan_id=$1 ORDER BY date DESC', [id])
        ])
        if (!loanRes.rows.length) return res.status(404).json({ message: 'Not found' })
        return res.json({ loan: loanRes.rows[0], repayments: repRes.rows })
      } catch (err) { console.error(err); return res.status(500).json({ message: 'Server error' }) }
    }

    return res.status(405).end()
  }

  // ── GET /api/loans ─────────────────────────────────────────────
  if (req.method === 'GET') {
    try {
      const { rows } = await pool.query(
        'SELECT * FROM nest.loans WHERE user_id=$1 ORDER BY created_at ASC',
        [auth.userId]
      )
      return res.json({ loans: rows })
    } catch (err) { console.error(err); return res.status(500).json({ message: 'Server error' }) }
  }

  // ── POST /api/loans ────────────────────────────────────────────
  if (req.method === 'POST') {
    const { name, type, original_amount, current_balance, interest_rate, minimum_repayment, repayment_frequency, start_date, years_remaining, extra_repayment, notes } = req.body || {}
    if (!name || !original_amount || !current_balance || !interest_rate || !minimum_repayment || !years_remaining)
      return res.status(400).json({ message: 'Missing required fields' })
    try {
      const { rows } = await pool.query(
        `INSERT INTO nest.loans (user_id, name, type, original_amount, current_balance, interest_rate, minimum_repayment, repayment_frequency, start_date, years_remaining, extra_repayment, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
        [auth.userId, name, type || 'other', original_amount, current_balance, interest_rate, minimum_repayment,
         repayment_frequency || 'monthly', start_date || null, years_remaining, extra_repayment || 0, notes || null]
      )
      return res.status(201).json({ loan: rows[0] })
    } catch (err) { console.error(err); return res.status(500).json({ message: 'Server error' }) }
  }

  res.status(405).end()
}
