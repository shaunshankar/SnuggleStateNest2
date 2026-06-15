const { requireAuth } = require('./_auth')
const { handleCors } = require('./_cors')
require('dotenv').config()

const CATEGORIES = 'housing, groceries, transport, utilities, entertainment, dining, health, personal_care, education, subscriptions, insurance, shopping, fitness, gifts, fees, savings, income, other'

async function callClaude({ model, max_tokens, prompt }) {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is not configured on the server')
  }
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model, max_tokens, messages: [{ role: 'user', content: prompt }] })
  })
  const data = await response.json()
  if (!response.ok) {
    const detail = data?.error?.message || `Anthropic API error (${response.status})`
    throw new Error(detail)
  }
  return data.content?.[0]?.text?.trim() || ''
}

function extractJson(text, kind) {
  // kind: 'array' | 'object'
  const re = kind === 'array' ? /\[[\s\S]*\]/ : /\{[\s\S]*\}/
  const match = text.match(re)
  if (!match) return kind === 'array' ? [] : {}
  try { return JSON.parse(match[0]) } catch { return kind === 'array' ? [] : {} }
}

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return
  if (req.method !== 'POST') return res.status(405).end()
  const auth = requireAuth(req, res)
  if (!auth) return
  const action = req.query.action

  // ── Categorise a single transaction description ─────────────────
  if (action === 'categorise') {
    const { description } = req.body || {}
    if (!description) return res.status(400).json({ message: 'Description required' })
    try {
      const text = await callClaude({
        model: 'claude-haiku-4-5-20251001', max_tokens: 20,
        prompt: `What budget category does this transaction belong to?\nTransaction: "${description}"\nCategories: ${CATEGORIES}\nReturn ONLY the single category name, nothing else.`
      })
      return res.json({ category: text.toLowerCase() || 'other' })
    } catch { return res.json({ category: 'other' }) }
  }

  // ── Parse any bank/card statement CSV into transactions ─────────
  if (action === 'import') {
    const { csv, accountType } = req.body || {}
    if (!csv) return res.status(400).json({ message: 'CSV content required' })
    const isCard = accountType === 'credit_card'
    const signRule = isCard
      ? `This is a CREDIT CARD statement. Purchases/charges are spending -> type "expense". Payments, refunds and credits to the card -> type "income".`
      : `This is a bank account statement. Money out / debits -> type "expense". Money in / credits -> type "income".`
    try {
      const text = await callClaude({
        model: 'claude-haiku-4-5-20251001', max_tokens: 8000,
        prompt: `Parse this bank statement CSV into a JSON array. The columns may be in any order and there may be a header row.\nFor each transaction row extract:\n- date (YYYY-MM-DD)\n- description (merchant/payee name, cleaned up and human readable)\n- amount (positive number, no currency symbols)\n- type: "income" or "expense"\n- category: one of [${CATEGORIES}]\n\n${signRule}\n\nReturn ONLY a JSON array, no other text.\n\nCSV data:\n${csv}`
      })
      return res.json({ transactions: extractJson(text, 'array') })
    } catch (err) { console.error(err); return res.status(500).json({ message: err.message || 'Failed to parse statement' }) }
  }

  // ── Detect recurring bills + savings movements ──────────────────
  if (action === 'detect') {
    const { transactions } = req.body || {}
    if (!Array.isArray(transactions) || !transactions.length)
      return res.status(400).json({ message: 'Transactions required' })
    // Keep payload lean: only fields the model needs
    const lines = transactions
      .map(t => `${t.date?.split('T')[0] || t.date}|${t.type}|${t.category}|${parseFloat(t.amount).toFixed(2)}|${t.description}`)
      .join('\n')
    try {
      const text = await callClaude({
        model: 'claude-sonnet-4-6', max_tokens: 2500,
        prompt: `You are a personal finance assistant. Below are transactions (pipe-separated: date|type|category|amount|description).\n\nAnalyse them and identify:\n1. RECURRING BILLS & SUBSCRIPTIONS — payments that repeat on a regular cadence (utilities, streaming, insurance, phone, gym, software, memberships, etc.). Merge variations of the same merchant. Estimate the typical amount, the usual day of month, and the frequency.\n2. SAVINGS MOVEMENTS — transfers that appear to move money into savings (e.g. "transfer to savings", round-number transfers to own/other accounts, payments described as savings).\n\nReturn ONLY a JSON object of this exact shape:\n{\n  "bills": [{"name": string, "amount": number, "due_day": number (1-31), "frequency": "monthly"|"weekly"|"fortnightly"|"yearly", "category": one of [${CATEGORIES}], "confidence": "high"|"medium"|"low"}],\n  "savings": [{"description": string, "amount": number, "date": "YYYY-MM-DD"}]\n}\nOnly include bills you are reasonably confident recur. Do not invent data.\n\nTransactions:\n${lines}`
      })
      const parsed = extractJson(text, 'object')
      return res.json({ bills: parsed.bills || [], savings: parsed.savings || [] })
    } catch (err) { console.error(err); return res.status(500).json({ message: err.message || 'Failed to analyse transactions' }) }
  }

  // ── Financial insights (spending / budget / dashboard) ──────────
  if (action === 'insights') {
    const { mode, payload } = req.body || {}
    if (!mode) return res.status(400).json({ message: 'mode required' })
    const ctx = JSON.stringify(payload || {})
    let model = 'claude-sonnet-4-6'
    let max_tokens = 800
    let prompt

    if (mode === 'spending') {
      prompt = `You are a friendly Australian personal finance advisor. Based on this spending data (JSON), give concise, practical advice on where this household can lower costs.\n\nData:\n${ctx}\n\nProvide:\n1. The 2-3 biggest opportunities to cut costs, with rough dollar savings.\n2. Any signs of duplicate/overlapping subscriptions or price creep.\n3. One encouraging takeaway.\nUse AUD. Use short bullet points. Keep under 250 words.`
    } else if (mode === 'budget') {
      prompt = `You are a friendly Australian personal finance advisor. Here are the household's budgets with spend-so-far this month (JSON).\n\nData:\n${ctx}\n\nProvide:\n1. Which categories are over or at risk of going over (and projected overspend).\n2. Categories with room to spare.\n3. One concrete suggestion to rebalance.\nUse AUD. Short bullet points. Keep under 200 words.`
    } else { // dashboard
      model = 'claude-haiku-4-5-20251001'
      max_tokens = 350
      prompt = `You are a friendly Australian personal finance assistant. Based on this month's snapshot (JSON), write a brief, warm 2-3 sentence summary of how the household is tracking, plus one actionable tip. Use AUD. No lists, just a short paragraph.\n\nSnapshot:\n${ctx}`
    }

    try {
      const text = await callClaude({ model, max_tokens, prompt })
      return res.json({ insights: text || 'Unable to generate insights right now.' })
    } catch (err) { console.error(err); return res.status(500).json({ message: err.message || 'Failed to generate insights' }) }
  }

  res.status(404).json({ message: 'Not found' })
}
