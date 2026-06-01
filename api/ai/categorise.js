const { requireAuth } = require('../_auth')
const { handleCors } = require('../_cors')
require('dotenv').config()

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return
  if (req.method !== 'POST') return res.status(405).end()

  const auth = requireAuth(req, res)
  if (!auth) return

  const { description } = req.body || {}
  if (!description) return res.status(400).json({ message: 'Description required' })

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
        max_tokens: 20,
        messages: [{
          role: 'user',
          content: `What budget category does this transaction belong to?\nTransaction: "${description}"\nCategories: housing, groceries, transport, utilities, entertainment, dining, health, personal_care, education, savings, income, other\nReturn ONLY the single category name, nothing else.`
        }]
      })
    })
    const data = await response.json()
    const category = data.content?.[0]?.text?.trim().toLowerCase() || 'other'
    res.json({ category })
  } catch (err) {
    console.error(err)
    res.json({ category: 'other' })
  }
}
