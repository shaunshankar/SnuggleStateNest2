// Amortise a single loan, returns schedule array + summary
export function amortiseLoan(balance, annualRate, minPayment, extraPayment = 0) {
  const r = annualRate / 100 / 12
  const monthly = parseFloat(minPayment) + parseFloat(extraPayment)
  const schedule = []
  let remaining = parseFloat(balance)
  let cumInterest = 0

  for (let m = 1; m <= 1200 && remaining > 0.005; m++) {
    const interest = remaining * r
    const payment = Math.min(monthly, remaining + interest)
    const principal = payment - interest
    remaining = Math.max(0, remaining - principal)
    cumInterest += interest
    schedule.push({ month: m, payment, interest, principal, balance: remaining, cumInterest })
  }

  return {
    schedule,
    months: schedule.length,
    totalInterest: cumInterest,
    totalPaid: cumInterest + parseFloat(balance)
  }
}

// Run a strategy across multiple loans, returns per-loan results
export function runStrategy(loans, extraBudget, strategy) {
  if (!loans.length) return []

  const sorted = [...loans]
  if (strategy === 'snowball') {
    sorted.sort((a, b) => parseFloat(a.current_balance) - parseFloat(b.current_balance))
  } else if (strategy === 'avalanche') {
    sorted.sort((a, b) => parseFloat(b.interest_rate) - parseFloat(a.interest_rate))
  }

  const states = sorted.map(l => ({
    id: l.id,
    name: l.name,
    rate: parseFloat(l.interest_rate),
    min: parseFloat(l.minimum_repayment),
    remaining: parseFloat(l.current_balance),
    originalBalance: parseFloat(l.current_balance),
    paidOff: false,
    payoffMonth: null,
    totalInterest: 0,
    totalPaid: 0,
    balanceHistory: [parseFloat(l.current_balance)]
  }))

  let rolledExtra = parseFloat(extraBudget) || 0

  for (let month = 1; month <= 1200; month++) {
    if (states.every(s => s.paidOff)) break
    const target = strategy !== 'minimum' ? states.find(s => !s.paidOff) : null

    for (const s of states) {
      if (s.paidOff) { s.balanceHistory.push(0); continue }

      const interest = s.remaining * (s.rate / 100 / 12)
      let payment = s.min + (target === s ? rolledExtra : 0)
      payment = Math.min(payment, s.remaining + interest)

      const principal = payment - interest
      s.remaining = Math.max(0, s.remaining - principal)
      s.totalInterest += interest
      s.totalPaid += payment
      s.balanceHistory.push(s.remaining)

      if (s.remaining <= 0.005 && !s.paidOff) {
        s.paidOff = true
        s.payoffMonth = month
        if (strategy !== 'minimum') rolledExtra += s.min
      }
    }
  }

  return states
}

export function monthsToDate(months) {
  const d = new Date()
  d.setMonth(d.getMonth() + Math.round(months))
  return d
}

export function formatPayoffDate(months) {
  if (!months || months >= 1200) return 'Over 100 years'
  const yrs = Math.floor(months / 12)
  const mos = months % 12
  const parts = []
  if (yrs > 0) parts.push(`${yrs}y`)
  if (mos > 0) parts.push(`${mos}m`)
  const date = monthsToDate(months)
  return `${parts.join(' ')} (${date.toLocaleDateString('en-AU', { month: 'short', year: 'numeric' })})`
}

export function weightedAvgRate(loans) {
  const totalBalance = loans.reduce((s, l) => s + parseFloat(l.current_balance), 0)
  if (!totalBalance) return 0
  return loans.reduce((s, l) => s + parseFloat(l.interest_rate) * parseFloat(l.current_balance), 0) / totalBalance
}
