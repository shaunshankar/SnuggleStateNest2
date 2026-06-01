import { useState, useEffect, useMemo } from 'react'
import { Plus, Pencil, Trash2, TrendingDown, Sparkles, ChevronDown, ChevronUp, X } from 'lucide-react'
import { api } from '../utils/api'
import { formatCurrency } from '../utils/formatters'
import { amortiseLoan, runStrategy, formatPayoffDate, weightedAvgRate } from '../utils/loanCalc'
import ProgressBar from '../components/ProgressBar'
import toast from 'react-hot-toast'

const TYPE_COLOURS = { home: '#3b82f6', car: '#22c55e', personal: '#a855f7', other: '#6b7280' }
const TYPE_LABELS = { home: '🏠 Home', car: '🚗 Car', personal: '💳 Personal', other: '📦 Other' }
const LOAN_TYPES = ['home', 'car', 'personal', 'other']
const STRATEGIES = ['minimum', 'snowball', 'avalanche']
const STRATEGY_LABELS = { minimum: 'Minimum Only', snowball: 'Snowball', avalanche: 'Avalanche' }

const EMPTY_LOAN = { name: '', type: 'home', original_amount: '', current_balance: '', interest_rate: '', minimum_repayment: '', repayment_frequency: 'monthly', start_date: '', years_remaining: '', extra_repayment: '', notes: '' }
const EMPTY_REPAY = { date: new Date().toISOString().split('T')[0], amount: '', is_extra: false, notes: '' }

// ── SVG Payoff Timeline Chart ─────────────────────────────────────────────────
function PayoffChart({ strategyResults, selectedStrategy, height = 200 }) {
  if (!strategyResults[selectedStrategy]?.length) return null
  const loans = strategyResults[selectedStrategy]
  const maxMonths = Math.max(...loans.map(l => l.balanceHistory.length))
  const maxBal = Math.max(...loans.map(l => l.originalBalance))
  const W = 560, H = height, PAD = { t: 12, r: 12, b: 32, l: 60 }
  const iW = W - PAD.l - PAD.r, iH = H - PAD.t - PAD.b

  const colours = ['#c9a84c', '#3b82f6', '#22c55e', '#a855f7', '#ef4444', '#f59e0b']

  function x(m) { return PAD.l + (m / maxMonths) * iW }
  function y(bal) { return PAD.t + iH - (bal / maxBal) * iH }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: H }}>
      {/* Grid lines */}
      {[0, 0.25, 0.5, 0.75, 1].map(f => (
        <g key={f}>
          <line x1={PAD.l} y1={PAD.t + iH * (1 - f)} x2={W - PAD.r} y2={PAD.t + iH * (1 - f)} stroke="rgba(255,255,255,0.06)" strokeWidth={1} />
          <text x={PAD.l - 6} y={PAD.t + iH * (1 - f) + 4} fontSize={10} fill="#4a5a75" textAnchor="end">
            {f === 0 ? '$0' : `$${(maxBal * f / 1000).toFixed(0)}k`}
          </text>
        </g>
      ))}
      {/* Loan lines */}
      {loans.map((loan, i) => {
        const pts = loan.balanceHistory.map((b, m) => `${x(m)},${y(b)}`).join(' ')
        return (
          <g key={loan.id}>
            <polyline points={pts} fill="none" stroke={colours[i % colours.length]} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            <text x={x(loan.balanceHistory.length - 1) + 4} y={y(0) - 4} fontSize={10} fill={colours[i % colours.length]}>{loan.name.split(' ')[0]}</text>
          </g>
        )
      })}
      {/* X axis labels */}
      {[0, 0.25, 0.5, 0.75, 1].map(f => {
        const m = Math.round(f * maxMonths)
        return <text key={f} x={x(m)} y={H - 6} fontSize={10} fill="#4a5a75" textAnchor="middle">{m}m</text>
      })}
    </svg>
  )
}

// ── Amortisation Schedule Modal ───────────────────────────────────────────────
function AmortisationModal({ loan, onClose }) {
  const [withExtra, setWithExtra] = useState(false)
  const extra = withExtra ? parseFloat(loan.extra_repayment) || 0 : 0
  const { schedule } = useMemo(() =>
    amortiseLoan(loan.current_balance, loan.interest_rate, loan.minimum_repayment, extra),
    [loan, extra]
  )

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-wide" style={{ maxWidth: 740 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0 }}>Amortisation — {loan.name}</h3>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={18} /></button>
        </div>
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center' }}>
          <button className={`btn btn-sm ${!withExtra ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setWithExtra(false)}>Minimum only</button>
          <button className={`btn btn-sm ${withExtra ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setWithExtra(true)} disabled={!loan.extra_repayment}>
            With extra ${parseFloat(loan.extra_repayment || 0).toFixed(0)}/mo
          </button>
          <span style={{ marginLeft: 'auto', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            {schedule.length} months · Total interest: <strong style={{ color: 'var(--gold-light)' }}>{formatCurrency(schedule.reduce((s, r) => s + r.interest, 0))}</strong>
          </span>
        </div>
        <div style={{ maxHeight: 460, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-card)' }}>
              <tr>
                {['Month', 'Payment', 'Principal', 'Interest', 'Balance', 'Cum. Interest'].map(h => (
                  <th key={h} style={{ padding: '10px 12px', fontSize: '0.72rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.6px', borderBottom: '1px solid var(--border)', textAlign: h === 'Month' ? 'left' : 'right' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {schedule.map((row, i) => (
                <tr key={i} style={{ background: i % 12 === 0 && i > 0 ? 'rgba(201,168,76,0.04)' : 'transparent' }}>
                  <td style={{ padding: '7px 12px', fontSize: '0.78rem', color: 'var(--text-secondary)', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>{row.month}</td>
                  {[row.payment, row.principal, row.interest].map((v, j) => (
                    <td key={j} style={{ padding: '7px 12px', fontSize: '0.78rem', textAlign: 'right', borderBottom: '1px solid rgba(255,255,255,0.03)', color: j === 2 ? 'var(--danger)' : j === 1 ? 'var(--success)' : 'var(--text-primary)', fontFamily: 'Playfair Display' }}>
                      {formatCurrency(v)}
                    </td>
                  ))}
                  <td style={{ padding: '7px 12px', fontSize: '0.78rem', textAlign: 'right', borderBottom: '1px solid rgba(255,255,255,0.03)', fontFamily: 'Playfair Display', color: 'var(--text-primary)' }}>{formatCurrency(row.balance)}</td>
                  <td style={{ padding: '7px 12px', fontSize: '0.78rem', textAlign: 'right', borderBottom: '1px solid rgba(255,255,255,0.03)', fontFamily: 'Playfair Display', color: '#ef8888' }}>{formatCurrency(row.cumInterest)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function Loans() {
  const [loans, setLoans] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('loans') // 'loans' | 'calculator'
  const [calcMode, setCalcMode] = useState('payoff') // 'payoff' | 'optimizer'
  const [showLoanModal, setShowLoanModal] = useState(false)
  const [showRepayModal, setShowRepayModal] = useState(null)
  const [showSchedule, setShowSchedule] = useState(null)
  const [editLoan, setEditLoan] = useState(null)
  const [loanForm, setLoanForm] = useState(EMPTY_LOAN)
  const [repayForm, setRepayForm] = useState(EMPTY_REPAY)
  const [saving, setSaving] = useState(false)
  const [insights, setInsights] = useState(null)
  const [insightsLoading, setInsightsLoading] = useState(false)

  // Calculator state
  const [calcLoanId, setCalcLoanId] = useState('manual')
  const [calcInputs, setCalcInputs] = useState({ balance: '', rate: '', minPayment: '', yearsRemaining: '', extra: '' })
  const [budgetAmount, setBudgetAmount] = useState('')
  const [chartStrategy, setChartStrategy] = useState('avalanche')

  useEffect(() => { loadLoans() }, [])

  async function loadLoans() {
    setLoading(true)
    try {
      const { loans } = await api.get('/loans')
      setLoans(loans)
    } catch (err) { toast.error(err.message) }
    finally { setLoading(false) }
  }

  // Pre-populate calc from selected loan
  useEffect(() => {
    if (calcLoanId === 'manual') return
    const loan = loans.find(l => l.id === calcLoanId)
    if (!loan) return
    setCalcInputs({
      balance: loan.current_balance,
      rate: loan.interest_rate,
      minPayment: loan.minimum_repayment,
      yearsRemaining: loan.years_remaining,
      extra: loan.extra_repayment || ''
    })
  }, [calcLoanId, loans])

  function openAdd() { setLoanForm(EMPTY_LOAN); setEditLoan(null); setShowLoanModal(true) }
  function openEdit(loan) {
    setLoanForm({
      name: loan.name, type: loan.type, original_amount: loan.original_amount,
      current_balance: loan.current_balance, interest_rate: loan.interest_rate,
      minimum_repayment: loan.minimum_repayment, repayment_frequency: loan.repayment_frequency,
      start_date: loan.start_date?.split('T')[0] || '', years_remaining: loan.years_remaining,
      extra_repayment: loan.extra_repayment || '', notes: loan.notes || ''
    })
    setEditLoan(loan); setShowLoanModal(true)
  }

  async function handleSaveLoan(e) {
    e.preventDefault()
    setSaving(true)
    try {
      if (editLoan) {
        const { loan } = await api.put(`/loans/${editLoan.id}`, loanForm)
        setLoans(ls => ls.map(l => l.id === editLoan.id ? loan : l))
        toast.success('Loan updated')
      } else {
        const { loan } = await api.post('/loans', loanForm)
        setLoans(ls => [...ls, loan])
        toast.success('Loan added')
      }
      setShowLoanModal(false)
    } catch (err) { toast.error(err.message) }
    finally { setSaving(false) }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this loan?')) return
    try {
      await api.del(`/loans/${id}`)
      setLoans(ls => ls.filter(l => l.id !== id))
      toast.success('Deleted')
    } catch (err) { toast.error(err.message) }
  }

  async function handleRepay(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const loan = showRepayModal
      const r = parseFloat(loan.interest_rate) / 100 / 12
      const interest = parseFloat(loan.current_balance) * r
      const amount = parseFloat(repayForm.amount)
      const principal = Math.max(0, amount - interest)
      const newBal = Math.max(0, parseFloat(loan.current_balance) - principal)
      await api.post('/loans/repay', {
        loan_id: loan.id, date: repayForm.date, amount, is_extra: repayForm.is_extra,
        notes: repayForm.notes, principal_portion: principal, interest_portion: Math.min(interest, amount),
        balance_after: newBal
      })
      setLoans(ls => ls.map(l => l.id === loan.id ? { ...l, current_balance: newBal } : l))
      toast.success('Repayment logged')
      setShowRepayModal(null)
      setRepayForm(EMPTY_REPAY)
    } catch (err) { toast.error(err.message) }
    finally { setSaving(false) }
  }

  async function getInsights() {
    if (!loans.length) return toast.error('Add at least one loan first')
    setInsightsLoading(true)
    try {
      const { insights } = await api.post('/loans/insights', { loans })
      setInsights(insights)
    } catch (err) { toast.error(err.message) }
    finally { setInsightsLoading(false) }
  }

  // ── Calculations ────────────────────────────────────────────────
  const totalDebt = useMemo(() => loans.reduce((s, l) => s + parseFloat(l.current_balance), 0), [loans])
  const totalMinimum = useMemo(() => loans.reduce((s, l) => s + parseFloat(l.minimum_repayment), 0), [loans])
  const avgRate = useMemo(() => weightedAvgRate(loans), [loans])

  // Payoff calculator results (single loan mode)
  const payoffResults = useMemo(() => {
    if (!calcInputs.balance || !calcInputs.rate || !calcInputs.minPayment) return null
    const extra = parseFloat(calcInputs.extra) || 0
    const min = amortiseLoan(calcInputs.balance, calcInputs.rate, calcInputs.minPayment, 0)
    const withExtra = extra > 0 ? amortiseLoan(calcInputs.balance, calcInputs.rate, calcInputs.minPayment, extra) : null
    return { min, withExtra }
  }, [calcInputs])

  // Multi-loan strategy results
  const strategyResults = useMemo(() => {
    if (!loans.length) return {}
    const extra = parseFloat(budgetAmount) || 0
    return {
      minimum: runStrategy(loans, 0, 'minimum'),
      snowball: runStrategy(loans, extra, 'snowball'),
      avalanche: runStrategy(loans, extra, 'avalanche')
    }
  }, [loans, budgetAmount])

  // Best strategy (lowest total interest)
  const bestStrategy = useMemo(() => {
    if (!loans.length) return null
    const totals = STRATEGIES.map(s => ({
      strategy: s,
      totalInterest: (strategyResults[s] || []).reduce((sum, l) => sum + l.totalInterest, 0)
    }))
    return totals.sort((a, b) => a.totalInterest - b.totalInterest)[0]?.strategy
  }, [strategyResults, loans])

  return (
    <div>
      {/* Header */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2>Loans</h2>
          <p>Track and optimise your personal debt</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary btn-sm" onClick={getInsights} disabled={insightsLoading}>
            <Sparkles size={14} /> {insightsLoading ? 'Thinking…' : 'AI Insights'}
          </button>
          <button className="btn btn-primary btn-sm" onClick={openAdd}>
            <Plus size={14} /> Add Loan
          </button>
        </div>
      </div>

      {/* AI Insights panel */}
      {insights && (
        <div className="card card-gold" style={{ marginBottom: 20, position: 'relative' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--gold-light)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.8px' }}>✨ AI Insights</span>
            <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setInsights(null)}><X size={14} /></button>
          </div>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{insights}</p>
        </div>
      )}

      {/* Summary stats */}
      {loans.length > 0 && (
        <div className="stat-grid" style={{ marginBottom: 24 }}>
          <div className="stat-card">
            <div className="stat-label">Total Debt</div>
            <div className="stat-value negative">{formatCurrency(totalDebt)}</div>
            <div className="stat-sub">{loans.length} loan{loans.length > 1 ? 's' : ''}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Monthly Minimums</div>
            <div className="stat-value">{formatCurrency(totalMinimum)}</div>
            <div className="stat-sub">combined minimum repayments</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Avg Interest Rate</div>
            <div className="stat-value gold">{avgRate.toFixed(2)}%</div>
            <div className="stat-sub">weighted by balance</div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: 'var(--bg-card)', borderRadius: 10, padding: 4, border: '1px solid var(--border)', width: 'fit-content' }}>
        {[['loans', '🏦 My Loans'], ['calculator', '🧮 Calculator']].map(([tab, label]) => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{
            padding: '8px 20px', borderRadius: 8, fontSize: '0.875rem', fontWeight: 500,
            background: activeTab === tab ? 'var(--gold-dim)' : 'transparent',
            color: activeTab === tab ? 'var(--gold-light)' : 'var(--text-secondary)',
            border: activeTab === tab ? '1px solid var(--gold-border)' : '1px solid transparent',
            transition: 'all 0.15s', cursor: 'pointer'
          }}>{label}</button>
        ))}
      </div>

      {/* ── MY LOANS TAB ── */}
      {activeTab === 'loans' && (
        <>
          {loading ? (
            [1, 2].map(i => <div key={i} className="skeleton" style={{ height: 160, borderRadius: 12, marginBottom: 12 }} />)
          ) : loans.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon" style={{ fontSize: '1.5rem' }}>🏦</div>
              <h3>No loans yet</h3>
              <p>Add your home loan, car loan or personal loan to track your debt and find the fastest payoff path.</p>
              <button className="btn btn-primary" onClick={openAdd}><Plus size={15} /> Add your first loan</button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
              {loans.map(loan => {
                const pctPaid = parseFloat(loan.original_amount) > 0
                  ? Math.max(0, (1 - parseFloat(loan.current_balance) / parseFloat(loan.original_amount)) * 100) : 0
                const typeColour = TYPE_COLOURS[loan.type] || '#6b7280'
                const minResult = amortiseLoan(loan.current_balance, loan.interest_rate, loan.minimum_repayment, 0)

                return (
                  <div key={loan.id} className="card" style={{ borderColor: `${typeColour}30` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <h3 style={{ fontSize: '1rem', margin: 0 }}>{loan.name}</h3>
                          <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: 100, background: `${typeColour}20`, color: typeColour, border: `1px solid ${typeColour}40` }}>
                            {TYPE_LABELS[loan.type]}
                          </span>
                        </div>
                        <div style={{ fontFamily: 'Playfair Display', fontSize: '1.6rem', color: 'var(--danger)', lineHeight: 1 }}>
                          {formatCurrency(loan.current_balance)}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>
                          of {formatCurrency(loan.original_amount)} original
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-ghost btn-icon btn-sm" onClick={() => openEdit(loan)}><Pencil size={14} /></button>
                        <button className="btn btn-ghost btn-icon btn-sm" style={{ color: 'var(--danger)' }} onClick={() => handleDelete(loan.id)}><Trash2 size={14} /></button>
                      </div>
                    </div>

                    {/* Progress */}
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 5 }}>
                        <span>{pctPaid.toFixed(1)}% paid off</span>
                        <span style={{ color: 'var(--gold-light)' }}>{formatCurrency(parseFloat(loan.original_amount) - parseFloat(loan.current_balance))} repaid</span>
                      </div>
                      <div className="progress-bar-wrap" style={{ height: 8 }}>
                        <div className="progress-bar-fill ok" style={{ width: `${pctPaid}%`, background: `linear-gradient(90deg, ${typeColour}80, ${typeColour})` }} />
                      </div>
                    </div>

                    {/* Stats grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 14 }}>
                      {[
                        ['Rate', `${loan.interest_rate}%`],
                        ['Min/mo', formatCurrency(loan.minimum_repayment)],
                        ['Payoff', formatPayoffDate(minResult.months)]
                      ].map(([label, val]) => (
                        <div key={label} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '8px 10px' }}>
                          <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>{label}</div>
                          <div style={{ fontSize: '0.78rem', fontWeight: 600, marginTop: 2, color: 'var(--text-primary)' }}>{val}</div>
                        </div>
                      ))}
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn btn-secondary btn-sm" style={{ flex: 1, justifyContent: 'center' }}
                        onClick={() => { setRepayForm(EMPTY_REPAY); setShowRepayModal(loan) }}>
                        💰 Log repayment
                      </button>
                      <button className="btn btn-ghost btn-sm" onClick={() => setShowSchedule(loan)}
                        style={{ fontSize: '0.78rem' }}>
                        Schedule
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* ── CALCULATOR TAB ── */}
      {activeTab === 'calculator' && (
        <div>
          {/* Calc mode toggle */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: 'var(--bg-card)', borderRadius: 10, padding: 4, border: '1px solid var(--border)', width: 'fit-content' }}>
            {[['payoff', '📊 Payoff Calculator'], ['optimizer', '⚡ Budget Optimizer']].map(([m, label]) => (
              <button key={m} onClick={() => setCalcMode(m)} style={{
                padding: '7px 16px', borderRadius: 8, fontSize: '0.82rem', fontWeight: 500, cursor: 'pointer',
                background: calcMode === m ? 'var(--gold-dim)' : 'transparent',
                color: calcMode === m ? 'var(--gold-light)' : 'var(--text-secondary)',
                border: calcMode === m ? '1px solid var(--gold-border)' : '1px solid transparent',
                transition: 'all 0.15s'
              }}>{label}</button>
            ))}
          </div>

          {/* ── PAYOFF CALCULATOR ── */}
          {calcMode === 'payoff' && (
            <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 20 }}>
              <div className="card" style={{ alignSelf: 'start' }}>
                <h3 style={{ fontSize: '0.95rem', marginBottom: 16 }}>Loan Details</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {loans.length > 0 && (
                    <div className="form-group">
                      <label>Use existing loan</label>
                      <select value={calcLoanId} onChange={e => setCalcLoanId(e.target.value)}>
                        <option value="manual">Enter manually</option>
                        {loans.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                      </select>
                    </div>
                  )}
                  {[
                    ['balance', 'Current Balance ($)', 'e.g. 250000'],
                    ['rate', 'Interest Rate (% p.a.)', 'e.g. 6.5'],
                    ['minPayment', 'Min Monthly Repayment ($)', 'e.g. 1800'],
                    ['extra', 'Extra Monthly Repayment ($)', 'e.g. 500 (optional)']
                  ].map(([key, label, ph]) => (
                    <div key={key} className="form-group">
                      <label>{label}</label>
                      <input type="number" step="any" min="0" placeholder={ph} value={calcInputs[key]}
                        onChange={e => setCalcInputs(c => ({ ...c, [key]: e.target.value }))} />
                    </div>
                  ))}
                </div>
              </div>

              <div>
                {!payoffResults ? (
                  <div className="empty-state" style={{ padding: '40px 0' }}>
                    <p>Enter loan details to see the payoff comparison.</p>
                  </div>
                ) : (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
                      {[
                        { label: 'Minimum Only', result: payoffResults.min, highlight: false },
                        { label: `With Extra ${formatCurrency(calcInputs.extra)}/mo`, result: payoffResults.withExtra, highlight: true }
                      ].filter(x => x.result).map(({ label, result, highlight }) => (
                        <div key={label} className="card" style={{ borderColor: highlight ? 'var(--gold-border)' : 'var(--border)' }}>
                          {highlight && <div style={{ fontSize: '0.7rem', color: 'var(--gold-light)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.8px' }}>⭐ Recommended</div>}
                          <div style={{ fontWeight: 600, marginBottom: 12, fontSize: '0.9rem' }}>{label}</div>
                          {[
                            ['Payoff', formatPayoffDate(result.months)],
                            ['Total interest', formatCurrency(result.totalInterest)],
                            ['Total paid', formatCurrency(result.totalPaid)]
                          ].map(([k, v]) => (
                            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: '0.82rem' }}>
                              <span style={{ color: 'var(--text-secondary)' }}>{k}</span>
                              <span style={{ fontFamily: 'Playfair Display' }}>{v}</span>
                            </div>
                          ))}
                          {highlight && payoffResults.min && (
                            <div style={{ marginTop: 10, padding: '8px 10px', background: 'rgba(201,168,76,0.08)', borderRadius: 8, fontSize: '0.78rem', color: 'var(--gold-light)' }}>
                              💰 Save {formatCurrency(payoffResults.min.totalInterest - result.totalInterest)} in interest · {payoffResults.min.months - result.months} months faster
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Mini amortisation preview */}
                    <div className="card">
                      <h3 style={{ fontSize: '0.9rem', marginBottom: 12 }}>Balance over time</h3>
                      <svg viewBox="0 0 560 150" style={{ width: '100%', height: 150 }}>
                        {(() => {
                          const minSched = payoffResults.min.schedule
                          const extSched = payoffResults.withExtra?.schedule
                          const maxM = Math.max(minSched.length, extSched?.length || 0)
                          const maxBal = parseFloat(calcInputs.balance)
                          const W = 560, H = 150, PL = 50, PB = 24, PT = 8, PR = 8
                          const iW = W - PL - PR, iH = H - PT - PB
                          const px = m => PL + (m / maxM) * iW
                          const py = b => PT + iH - (b / maxBal) * iH

                          return (
                            <>
                              {[0, 0.5, 1].map(f => (
                                <g key={f}>
                                  <line x1={PL} y1={PT + iH * (1 - f)} x2={W - PR} y2={PT + iH * (1 - f)} stroke="rgba(255,255,255,0.05)" />
                                  <text x={PL - 5} y={PT + iH * (1 - f) + 4} fontSize={9} fill="#4a5a75" textAnchor="end">
                                    {f === 0 ? '$0' : `$${(maxBal * f / 1000).toFixed(0)}k`}
                                  </text>
                                </g>
                              ))}
                              <polyline
                                points={minSched.map((r, i) => `${px(i)},${py(r.balance)}`).join(' ')}
                                fill="none" stroke="rgba(239,68,68,0.6)" strokeWidth={1.5}
                              />
                              {extSched && (
                                <polyline
                                  points={extSched.map((r, i) => `${px(i)},${py(r.balance)}`).join(' ')}
                                  fill="none" stroke="var(--gold)" strokeWidth={2}
                                />
                              )}
                              <text x={W - PR - 4} y={PT + 12} fontSize={9} fill="rgba(239,68,68,0.8)" textAnchor="end">Minimum</text>
                              {extSched && <text x={W - PR - 4} y={PT + 24} fontSize={9} fill="var(--gold)" textAnchor="end">With extra</text>}
                            </>
                          )
                        })()}
                      </svg>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* ── BUDGET OPTIMIZER ── */}
          {calcMode === 'optimizer' && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 20 }}>
                <div className="card" style={{ alignSelf: 'start' }}>
                  <h3 style={{ fontSize: '0.95rem', marginBottom: 14 }}>Monthly Budget</h3>
                  <div className="form-group">
                    <label>Extra repayment budget ($)</label>
                    <input type="number" step="any" min="0" value={budgetAmount}
                      onChange={e => setBudgetAmount(e.target.value)} placeholder="e.g. 500" />
                  </div>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 8, lineHeight: 1.5 }}>
                    How much extra can you put towards loans each month, on top of minimums?
                  </p>
                </div>

                <div>
                  {!loans.length ? (
                    <div className="empty-state"><p>Add loans to use the budget optimizer.</p></div>
                  ) : (
                    <>
                      {/* Strategy comparison table */}
                      <div className="card" style={{ marginBottom: 20, padding: 0 }}>
                        <div className="table-wrap">
                          <table>
                            <thead>
                              <tr>
                                <th>Loan</th>
                                {STRATEGIES.map(s => (
                                  <th key={s} style={{ textAlign: 'right', color: bestStrategy === s ? 'var(--gold-light)' : undefined }}>
                                    {STRATEGY_LABELS[s]}{bestStrategy === s ? ' ⭐' : ''}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {loans.map(loan => (
                                <tr key={loan.id}>
                                  <td style={{ fontWeight: 500 }}>{loan.name}</td>
                                  {STRATEGIES.map(s => {
                                    const r = (strategyResults[s] || []).find(x => x.id === loan.id)
                                    return (
                                      <td key={s} style={{ textAlign: 'right', fontSize: '0.82rem' }}>
                                        {r ? <span style={{ color: 'var(--text-secondary)' }}>{formatPayoffDate(r.payoffMonth || r.months)}</span> : '—'}
                                      </td>
                                    )
                                  })}
                                </tr>
                              ))}
                              <tr style={{ borderTop: '1px solid var(--border)' }}>
                                <td style={{ fontWeight: 600, fontSize: '0.82rem' }}>Total interest</td>
                                {STRATEGIES.map(s => {
                                  const total = (strategyResults[s] || []).reduce((sum, l) => sum + l.totalInterest, 0)
                                  const minTotal = (strategyResults.minimum || []).reduce((sum, l) => sum + l.totalInterest, 0)
                                  const saved = minTotal - total
                                  return (
                                    <td key={s} style={{ textAlign: 'right' }}>
                                      <div style={{ fontFamily: 'Playfair Display', fontSize: '0.88rem', color: bestStrategy === s ? 'var(--gold-light)' : 'var(--text-primary)' }}>
                                        {formatCurrency(total)}
                                      </div>
                                      {s !== 'minimum' && saved > 0 && (
                                        <div style={{ fontSize: '0.72rem', color: 'var(--success)' }}>Save {formatCurrency(saved)}</div>
                                      )}
                                    </td>
                                  )
                                })}
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Payoff timeline chart */}
                      <div className="card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                          <h3 style={{ fontSize: '0.95rem', margin: 0 }}>Debt payoff timeline</h3>
                          <div style={{ display: 'flex', gap: 4 }}>
                            {STRATEGIES.map(s => (
                              <button key={s} onClick={() => setChartStrategy(s)} style={{
                                padding: '4px 10px', borderRadius: 6, fontSize: '0.72rem', cursor: 'pointer',
                                background: chartStrategy === s ? 'var(--gold-dim)' : 'transparent',
                                color: chartStrategy === s ? 'var(--gold-light)' : 'var(--text-secondary)',
                                border: chartStrategy === s ? '1px solid var(--gold-border)' : '1px solid transparent'
                              }}>{STRATEGY_LABELS[s]}</button>
                            ))}
                          </div>
                        </div>
                        <PayoffChart strategyResults={strategyResults} selectedStrategy={chartStrategy} />
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Add/Edit Loan Modal ── */}
      {showLoanModal && (
        <div className="modal-overlay" onClick={() => setShowLoanModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>{editLoan ? 'Edit Loan' : 'Add Loan'}</h3>
            <form onSubmit={handleSaveLoan} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="form-group">
                <label>Loan name</label>
                <input type="text" value={loanForm.name} onChange={e => setLoanForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Home Loan" required />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Type</label>
                  <select value={loanForm.type} onChange={e => setLoanForm(f => ({ ...f, type: e.target.value }))}>
                    {LOAN_TYPES.map(t => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Interest rate (% p.a.)</label>
                  <input type="number" step="0.01" min="0" value={loanForm.interest_rate} onChange={e => setLoanForm(f => ({ ...f, interest_rate: e.target.value }))} placeholder="e.g. 6.5" required />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Original amount ($)</label>
                  <input type="number" step="0.01" min="0" value={loanForm.original_amount} onChange={e => setLoanForm(f => ({ ...f, original_amount: e.target.value }))} required />
                </div>
                <div className="form-group">
                  <label>Current balance ($)</label>
                  <input type="number" step="0.01" min="0" value={loanForm.current_balance} onChange={e => setLoanForm(f => ({ ...f, current_balance: e.target.value }))} required />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Min monthly repayment ($)</label>
                  <input type="number" step="0.01" min="0" value={loanForm.minimum_repayment} onChange={e => setLoanForm(f => ({ ...f, minimum_repayment: e.target.value }))} required />
                </div>
                <div className="form-group">
                  <label>Years remaining</label>
                  <input type="number" step="0.5" min="0.5" value={loanForm.years_remaining} onChange={e => setLoanForm(f => ({ ...f, years_remaining: e.target.value }))} placeholder="e.g. 25" required />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Extra repayment/mo ($)</label>
                  <input type="number" step="0.01" min="0" value={loanForm.extra_repayment} onChange={e => setLoanForm(f => ({ ...f, extra_repayment: e.target.value }))} placeholder="0" />
                </div>
                <div className="form-group">
                  <label>Start date</label>
                  <input type="date" value={loanForm.start_date} onChange={e => setLoanForm(f => ({ ...f, start_date: e.target.value }))} />
                </div>
              </div>
              <div className="form-group">
                <label>Notes (optional)</label>
                <textarea value={loanForm.notes} onChange={e => setLoanForm(f => ({ ...f, notes: e.target.value }))} rows={2} placeholder="Lender, account number, etc." />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setShowLoanModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save loan'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Log Repayment Modal ── */}
      {showRepayModal && (
        <div className="modal-overlay" onClick={() => setShowRepayModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Log Repayment</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: 16 }}>
              Loan: <strong style={{ color: 'var(--gold-light)' }}>{showRepayModal.name}</strong> · Balance: <strong style={{ color: 'var(--danger)' }}>{formatCurrency(showRepayModal.current_balance)}</strong>
            </p>
            <form onSubmit={handleRepay} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="form-row">
                <div className="form-group">
                  <label>Amount ($)</label>
                  <input type="number" step="0.01" min="0.01" value={repayForm.amount} onChange={e => setRepayForm(f => ({ ...f, amount: e.target.value }))} placeholder={showRepayModal.minimum_repayment} required autoFocus />
                </div>
                <div className="form-group">
                  <label>Date</label>
                  <input type="date" value={repayForm.date} onChange={e => setRepayForm(f => ({ ...f, date: e.target.value }))} required />
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="checkbox" id="is_extra" checked={repayForm.is_extra} onChange={e => setRepayForm(f => ({ ...f, is_extra: e.target.checked }))} style={{ width: 16, height: 16 }} />
                <label htmlFor="is_extra" style={{ margin: 0, cursor: 'pointer' }}>This is an extra repayment</label>
              </div>
              <div className="form-group">
                <label>Notes (optional)</label>
                <input type="text" value={repayForm.notes} onChange={e => setRepayForm(f => ({ ...f, notes: e.target.value }))} placeholder="e.g. Annual bonus payment" />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setShowRepayModal(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Logging…' : 'Log repayment'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Amortisation Schedule Modal ── */}
      {showSchedule && <AmortisationModal loan={showSchedule} onClose={() => setShowSchedule(null)} />}
    </div>
  )
}
