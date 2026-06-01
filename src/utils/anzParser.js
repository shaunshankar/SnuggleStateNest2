const SMALL_WORDS = new Set(['&', 'and', 'or', 'the', 'a', 'an', 'at', 'by', 'for', 'in', 'of', 'on', 'to', 'vs'])

function toTitleCase(str) {
  return str.toLowerCase().replace(/\b\w+/g, (word, idx) =>
    idx === 0 || !SMALL_WORDS.has(word) ? word[0].toUpperCase() + word.slice(1) : word
  )
}

function parseCsvLine(line) {
  const result = []
  let current = ''
  let inQuotes = false
  for (const ch of line) {
    if (ch === '"') { inQuotes = !inQuotes }
    else if (ch === ',' && !inQuotes) { result.push(current.trim()); current = '' }
    else current += ch
  }
  result.push(current.trim())
  return result
}

const MERCHANT_RULES = [
  { category: 'groceries',     patterns: ['SUPABARN', 'WOOLWORTHS', 'COLES', 'IGA', 'ALDI', 'FOODWORKS'] },
  { category: 'transport',     patterns: ['UBER *TRIP', 'METRO PETROLEUM', '7-ELEVEN', 'WILSON PARKING', 'POINTPARKING', 'BP ', 'SHELL', 'CALTEX'] },
  { category: 'dining',        patterns: ['KFC', 'GYG', 'GAMI', 'MANOOSH', 'UBER *EATS', 'SHARETEA', 'LOKMA', 'KINGSLEY', 'NOI NOI', 'BARTON KEBAB', 'PENNYWORTH', 'ANTAKYA', ' HJS', 'YOGIS KITCHEN', 'EQ BAKEHOUSE', 'GONG CHA', 'MR SHISH', 'BIANCO DOME'] },
  { category: 'health',        patterns: ['MEDIBANK', 'BUPA', 'CHEMIST', 'PHARMACY'] },
  { category: 'entertainment', patterns: ['SPORTSBET', 'TICKETEK', 'RSL ART UNION', 'TOY FARM', 'VENUES CANBERRA', 'BRUMBIES', 'LMCT'] },
  { category: 'personal_care', patterns: ['AFTERPAY', 'APPLE.COM'] },
]

function categoriseRaw(raw, type) {
  if (type === 'income') return 'income'
  const up = raw.toUpperCase()
  for (const { category, patterns } of MERCHANT_RULES) {
    if (patterns.some(p => up.includes(p))) return category
  }
  return 'other'
}

function cleanAndCategorise(raw, amountValue) {
  let desc = raw.trim()
  const isExpense = amountValue < 0
  let notes = null
  let isInternal = false
  let type = isExpense ? 'expense' : 'income'

  // ── ATM ────────────────────────────────────────────────────────
  if (/^(NON-ANZ ATM|ANZ ATM)/i.test(desc)) {
    const fee = desc.match(/\$?(\d+\.\d{2})\s*FEE/i)
    return {
      description: 'ATM Withdrawal',
      type: 'expense',
      category: 'other',
      notes: fee ? `Includes $${fee[1]} ATM fee` : null,
      isInternal: false
    }
  }

  // ── Own account transfer ────────────────────────────────────────
  if (/^ANZ M-BANKING FUNDS TFER\s+TRANSFER\s+\S+\s+TO\s+\d/i.test(desc)) {
    return { description: 'Own Account Transfer', type: 'expense', category: 'other', notes: null, isInternal: true }
  }

  // ── Recurring / generic bank transfer ──────────────────────────
  if (/^ANZ MOBILE BANKING RECURRING PAYMENT/i.test(desc)) {
    return { description: 'Bank Transfer', type: 'expense', category: 'other', notes: null, isInternal: false }
  }

  // ── Salary ─────────────────────────────────────────────────────
  const salaryMatch = desc.match(/^PAY\/SALARY FROM (.+)/i)
  if (salaryMatch) {
    return { description: toTitleCase(salaryMatch[1].trim()), type: 'income', category: 'income', notes: null, isInternal: false }
  }

  // ── ANZ Mobile Banking payment to person ───────────────────────
  const mobilePayMatch = desc.match(/^ANZ MOBILE BANKING PAYMENT \S+ TO (.+)/i)
  if (mobilePayMatch) {
    const payee = mobilePayMatch[1].trim()
    return { description: `Transfer to ${toTitleCase(payee)}`, type: 'expense', category: 'savings', notes: null, isInternal: false }
  }

  // ── ANZ M-Banking transfer ──────────────────────────────────────
  if (/^ANZ M-BANKING/i.test(desc)) {
    return { description: 'Bank Transfer', type: 'expense', category: 'other', notes: null, isInternal: true }
  }

  // ── PAYMENT TO ─────────────────────────────────────────────────
  const payToMatch = desc.match(/^PAYMENT TO (.+)/i)
  if (payToMatch) {
    const payee = payToMatch[1].trim()
    if (/COLES CR CARD|MYCARD CR CARD|ZIPMONEY|CREDIT CARD/i.test(payee)) {
      return { description: 'Credit Card Payment', type: 'expense', category: 'other', notes: null, isInternal: true }
    }
    if (/^(NIB|MEDIBANK|BUPA|AUTOPAY)/i.test(payee)) {
      return { description: toTitleCase(payee), type: 'expense', category: 'health', notes: null, isInternal: false }
    }
    return { description: toTitleCase(payee), type: 'expense', category: 'savings', notes: null, isInternal: false }
  }

  // ── PAYMENT FROM ───────────────────────────────────────────────
  const payFromMatch = desc.match(/^PAYMENT FROM (.+)/i)
  if (payFromMatch) {
    return { description: toTitleCase(payFromMatch[1].trim()), type: 'income', category: 'income', notes: null, isInternal: false }
  }

  // ── Tabcorp (gambling winnings) ────────────────────────────────
  if (/TABCORP/i.test(desc)) {
    return { description: 'Tabcorp', type: 'income', category: 'income', notes: null, isInternal: false }
  }

  // ── Standard merchant cleanup ───────────────────────────────────
  desc = desc.replace(/^VISA DEBIT PURCHASE CARD \d+\s*/i, '')
  desc = desc.replace(/^EFTPOS\s+/i, '')

  // Remove trailing location: split on first double-space occurrence
  const parts = desc.split(/\s{2,}/)
  desc = parts[0].trim()

  // Remove trailing store number (e.g. "COLES 0397")
  desc = desc.replace(/\s+\d{3,}$/, '')

  desc = toTitleCase(desc)

  return {
    description: desc,
    type,
    category: categoriseRaw(raw, type),
    notes: null,
    isInternal: false
  }
}

export function parseAnzCsv(csvText) {
  const lines = csvText.split(/\r?\n/).filter(l => l.trim())
  const rows = []

  for (const line of lines) {
    const cols = parseCsvLine(line)
    if (cols.length < 3) continue

    const [dateStr, amountStr, rawDesc] = cols

    // Parse DD/MM/YYYY → YYYY-MM-DD
    const dm = dateStr.match(/(\d{2})\/(\d{2})\/(\d{4})/)
    if (!dm) continue

    const date = `${dm[3]}-${dm[2]}-${dm[1]}`
    const amountValue = parseFloat(amountStr.replace(/[^-\d.]/g, ''))
    if (isNaN(amountValue)) continue

    const { description, type, category, notes, isInternal } = cleanAndCategorise(rawDesc, amountValue)

    rows.push({
      date,
      amount: Math.abs(amountValue).toFixed(2),
      description,
      type,
      category,
      notes,
      isInternal,
      rawDescription: rawDesc,
      selected: true
    })
  }

  return rows
}
