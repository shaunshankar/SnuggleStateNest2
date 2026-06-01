const { requireAuth } = require('../_auth')
const { handleCors } = require('../_cors')
require('dotenv').config()

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return
  if (req.method !== 'POST') return res.status(405).end()

  const auth = requireAuth(req, res)
  if (!auth) return

  const { csv } = req.body || {}
  if (!csv) return res.status(400).json({ message: 'CSV content required' })

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 4096,
        messages: [{
          role: 'user',
          content: `Parse this bank statement CSV and return a JSON array. For each row extract:\n- date (YYYY-MM-DD)\n- description (merchant/payee name, cleaned up)\n- amount (positive number)\n- type: "income" if credit, "expense" if debit\n- category: one of [housing, groceries, transport, utilities, entertainment, dining, health, personal_care, education, savings, income, other]\n\nReturn ONLY a JSON array, no other text.\n\nCSV data:\n${csv}`
        }]
      })
    })
    const data = await response.json()
    const text = data.content?.[0]?.text?.trim() || '[]'
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    const transactions = jsonMatch ? JSON.parse(jsonMatch[0]) : []
    res.json({ transactions })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Failed to parse CSV' })
  }
}
