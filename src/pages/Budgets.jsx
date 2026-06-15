import { useState, useEffect } from 'react'
import { Plus, Pencil, Trash2, TrendingUp, Sparkles, Wand2, X } from 'lucide-react'
import { api } from '../utils/api'
import { useAuth } from '../hooks/useAuth'
import { formatCurrency, cycleWindow, cycleLabel } from '../utils/formatters'
import { CATEGORIES, CATEGORY_ICONS, CATEGORY_COLOURS } from '../utils/categories'
import ProgressBar from '../components/ProgressBar'
import InsightText from '../components/InsightText'
import toast from 'react-hot-toast'

export default function Budgets() {
  const [budgets, setBudgets] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editBudget, setEditBudget] = useState(null)
  const [form, setForm] = useState({ category: 'groceries', monthly_limit: '' })
  const [saving, setSaving] = useState(false)
  const [insights, setInsights] = useState('')
  const [insightsLoading, setInsightsLoading] = useState(false)
  const { user } = useAuth()
  const [showAssistant, setShowAssistant] = useState(false)
  const [planIncome, setPlanIncome] = useState('')
  const [avgSpending, setAvgSpending] = useState([])
  const [plan, setPlan] = useState(null)
  const [planLoading, setPlanLoading] = useState(false)
  const [applying, setApplying] = useState(false)

  async function handleInsights() {
    setInsightsLoading(true)
    try {
      const payload = budgets.map(b => ({ category: b.category, monthly_limit: parseFloat(b.monthly_limit), spent: b.spent || 0 }))
      const { insights } = await api.post('/ai/insights', { mode: 'budget', payload })
      setInsights(insights)
    } catch (err) { toast.error(err.message) }
    finally { setInsightsLoading(false) }
  }

  async function openAssistant() {
    setPlan(null)
    setShowAssistant(true)
    try {
      const reports = await api.get('/reports')
      // categoryBreakdown totals span ~3 months → average per month
      const spend = (reports.categoryBreakdown || [])
        .filter(r => r.type === 'expense')
        .map(r => ({ category: r.category, avgMonthly: parseFloat(r.total) / 3 }))
      setAvgSpending(spend)
      const incomeGuess = parseFloat(user?.monthly_income) || reports.currentMonth?.income || ''
      setPlanIncome(incomeGuess ? String(Math.round(incomeGuess)) : '')
    } catch (err) { toast.error(err.message) }
  }

  async function generatePlan() {
    if (!planIncome || parseFloat(planIncome) <= 0) return toast.error('Enter your monthly income first')
    setPlanLoading(true)
    try {
      const { plan } = await api.post('/ai/budget-plan', {
        income: parseFloat(planIncome),
        spending: avgSpending,
        existing: budgets.map(b => ({ category: b.category, monthly_limit: parseFloat(b.monthly_limit) }))
      })
      if (!plan?.length) { toast('Could not build a plan from your data', { icon: '🤔' }); return }
      setPlan(plan
        .filter(p => CATEGORIES.includes(p.category) && p.category !== 'income' && p.category !== 'other')
        .map(p => ({
          category: p.category,
          monthly_limit: Math.max(0, Math.round(parseFloat(p.monthly_limit) || 0)),
          reason: p.reason || '',
          selected: true
        })))
    } catch (err) { toast.error(err.message) }
    finally { setPlanLoading(false) }
  }

  function updatePlan(idx, field, value) {
    setPlan(rows => rows.map((r, i) => i === idx ? { ...r, [field]: value } : r))
  }

  async function applyPlan() {
    const selected = plan.filter(p => p.selected && p.monthly_limit > 0)
    if (!selected.length) return toast.error('Nothing selected')
    setApplying(true)
    try {
      for (const p of selected) {
        await api.post('/budgets', { category: p.category, monthly_limit: p.monthly_limit })
      }
      toast.success(`Applied ${selected.length} budget${selected.length !== 1 ? 's' : ''}`)
      setShowAssistant(false)
      setPlan(null)
      loadBudgets()
    } catch (err) { toast.error(err.message) }
    finally { setApplying(false) }
  }

  const cycleStartDay = user?.budget_cycle_start_day || 1
  const { daysTotal: daysInMonth, daysPassed, daysLeft } = cycleWindow(cycleStartDay)
  const periodLabel = cycleLabel(cycleStartDay)

  useEffect(() => { loadBudgets() }, [])

  async function loadBudgets() {
    setLoading(true)
    try {
      const { budgets } = await api.get('/budgets')
      setBudgets(budgets)
    } catch (err) { toast.error(err.message) }
    finally { setLoading(false) }
  }

  function openAdd() { setForm({ category: 'groceries', monthly_limit: '' }); setEditBudget(null); setShowModal(true) }
  function openEdit(b) { setForm({ category: b.category, monthly_limit: b.monthly_limit }); setEditBudget(b); setShowModal(true) }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const { budget } = await api.post('/budgets', form)
      setBudgets(bs => {
        const exists = bs.find(b => b.category === budget.category)
        return exists ? bs.map(b => b.category === budget.category ? { ...budget, spent: b.spent } : b) : [...bs, { ...budget, spent: 0 }]
      })
      toast.success(editBudget ? 'Budget updated' : 'Budget created')
      setShowModal(false)
    } catch (err) { toast.error(err.message) }
    finally { setSaving(false) }
  }

  async function handleDelete(category) {
    if (!confirm('Remove this budget?')) return
    try {
      await api.del(`/budgets?category=${category}`)
      setBudgets(bs => bs.filter(b => b.category !== category))
      toast.success('Budget removed')
    } catch (err) { toast.error(err.message) }
  }

  const totalBudget = budgets.reduce((s, b) => s + parseFloat(b.monthly_limit), 0)
  const totalSpent = budgets.reduce((s, b) => s + (b.spent || 0), 0)
  const usedCategories = budgets.map(b => b.category)

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2>Budget Manager</h2>
          <p>{daysLeft} days left in this cycle ({periodLabel})</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary btn-sm" onClick={openAssistant}>
            <Wand2 size={15} /> AI budget assistant
          </button>
          <button className="btn btn-primary btn-sm" onClick={openAdd}>
            <Plus size={15} /> Add Budget
          </button>
        </div>
      </div>

      {/* Summary row */}
      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 24 }}>
        <div className="stat-card">
          <div className="stat-label">Total Budget</div>
          <div className="stat-value gold">{formatCurrency(totalBudget)}</div>
          <div className="stat-sub">per month</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Spent So Far</div>
          <div className={`stat-value ${totalSpent > totalBudget ? 'negative' : 'positive'}`}>{formatCurrency(totalSpent)}</div>
          <div className="stat-sub">{totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0}% of budget</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Remaining</div>
          <div className={`stat-value ${totalBudget - totalSpent < 0 ? 'negative' : 'positive'}`}>{formatCurrency(Math.max(0, totalBudget - totalSpent))}</div>
          <div className="stat-sub">{daysLeft} days to go</div>
        </div>
      </div>

      {!loading && budgets.length > 0 && (
        <div className="card" style={{ marginBottom: 20, borderColor: 'var(--gold-border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: insights ? 12 : 0 }}>
            <h3 style={{ fontSize: '1rem', display: 'flex', alignItems: 'center', gap: 8 }}><Sparkles size={17} color="var(--gold)" /> AI budget insights</h3>
            <button className="btn btn-secondary btn-sm" onClick={handleInsights} disabled={insightsLoading}>
              {insightsLoading ? 'Thinking…' : insights ? 'Refresh' : 'Generate'}
            </button>
          </div>
          {insights && <InsightText text={insights} />}
        </div>
      )}

      {loading ? (
        <div>{[1,2,3].map(i => <div key={i} className="skeleton skeleton-card" style={{ height: 80, marginBottom: 12 }} />)}</div>
      ) : budgets.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><TrendingUp size={24} color="var(--gold)" /></div>
          <h3>No budgets set</h3>
          <p>Set spending limits for each category to track your household's finances.</p>
          <button className="btn btn-primary" onClick={openAdd}><Plus size={15} /> Create your first budget</button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {budgets.map(b => {
            const spent = b.spent || 0
            const limit = parseFloat(b.monthly_limit)
            const pct = limit > 0 ? (spent / limit) * 100 : 0
            const projected = daysPassed > 0 ? (spent / daysPassed) * daysInMonth : 0

            return (
              <div key={b.id} className="card">
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: `${CATEGORY_COLOURS[b.category]}20`, border: `1px solid ${CATEGORY_COLOURS[b.category]}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', flexShrink: 0 }}>
                    {CATEGORY_ICONS[b.category]}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <span style={{ fontWeight: 600, textTransform: 'capitalize' }}>{b.category.replace('_', ' ')}</span>
                      <span style={{ fontFamily: 'Playfair Display', fontSize: '1rem', color: pct >= 100 ? 'var(--danger)' : pct >= 75 ? 'var(--warning)' : 'var(--success)' }}>
                        {formatCurrency(spent)} <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>/ {formatCurrency(limit)}</span>
                      </span>
                    </div>
                    <ProgressBar value={spent} max={limit} height={10} />
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn btn-ghost btn-icon btn-sm" onClick={() => openEdit(b)}><Pencil size={14} /></button>
                    <button className="btn btn-ghost btn-icon btn-sm" style={{ color: 'var(--danger)' }} onClick={() => handleDelete(b.category)}><Trash2 size={14} /></button>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 20, fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                  <span>{pct.toFixed(0)}% used</span>
                  <span>Projected: <span style={{ color: projected > limit ? 'var(--danger)' : 'var(--success)' }}>{formatCurrency(projected)}</span></span>
                  <span>Remaining: <span style={{ color: limit - spent < 0 ? 'var(--danger)' : 'var(--text-primary)' }}>{formatCurrency(Math.max(0, limit - spent))}</span></span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>{editBudget ? 'Edit Budget' : 'Add Budget'}</h3>
            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="form-group">
                <label>Category</label>
                <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} disabled={!!editBudget}>
                  {CATEGORIES.filter(c => c !== 'income').filter(c => !usedCategories.includes(c) || c === form.category).map(c => (
                    <option key={c} value={c}>{CATEGORY_ICONS[c]} {c.replace('_', ' ')}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Monthly limit ($)</label>
                <input type="number" step="0.01" min="1" value={form.monthly_limit} onChange={e => setForm(f => ({ ...f, monthly_limit: e.target.value }))} placeholder="e.g. 500" required />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* AI budget assistant */}
      {showAssistant && (
        <div className="modal-overlay" onClick={() => { if (!applying && !planLoading) setShowAssistant(false) }}>
          <div className="modal modal-wide" style={{ maxWidth: 680 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}><Wand2 size={18} color="var(--gold)" /> AI budget assistant</h3>
              {!applying && !planLoading && <button className="btn btn-ghost btn-icon" onClick={() => setShowAssistant(false)}><X size={18} /></button>}
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', marginBottom: 16 }}>
              I'll suggest monthly limits from your income and recent spending. Review, tweak, and apply the ones you like.
            </p>

            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', marginBottom: 16 }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label>Monthly take-home income ($)</label>
                <input type="number" step="1" min="0" value={planIncome} onChange={e => setPlanIncome(e.target.value)} placeholder="e.g. 6000" />
              </div>
              <button className="btn btn-primary" onClick={generatePlan} disabled={planLoading}>
                {planLoading ? 'Building…' : plan ? 'Regenerate' : 'Generate plan'}
              </button>
            </div>

            {plan && (() => {
              const total = plan.filter(p => p.selected).reduce((s, p) => s + (parseFloat(p.monthly_limit) || 0), 0)
              const income = parseFloat(planIncome) || 0
              const over = total > income
              return (
                <>
                  <div style={{ maxHeight: 360, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-card)', zIndex: 1 }}>
                        <tr>
                          {['', 'Category', 'Limit', 'Why'].map((h, i) => (
                            <th key={i} style={{ padding: '10px 10px', textAlign: 'left', fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid var(--border)' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {plan.map((p, i) => (
                          <tr key={i} style={{ opacity: p.selected ? 1 : 0.4 }}>
                            <td style={{ padding: '6px 10px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                              <input type="checkbox" checked={p.selected} onChange={e => updatePlan(i, 'selected', e.target.checked)} style={{ width: 14, height: 14, cursor: 'pointer' }} />
                            </td>
                            <td style={{ padding: '6px 10px', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: '0.84rem', whiteSpace: 'nowrap', textTransform: 'capitalize' }}>
                              {CATEGORY_ICONS[p.category]} {p.category.replace('_', ' ')}
                            </td>
                            <td style={{ padding: '6px 10px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                              <input type="number" step="1" min="0" value={p.monthly_limit} onChange={e => updatePlan(i, 'monthly_limit', parseFloat(e.target.value) || 0)}
                                style={{ background: 'var(--bg-input)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: 'var(--text-primary)', padding: '4px 8px', fontSize: '0.8rem', width: 90 }} />
                            </td>
                            <td style={{ padding: '6px 10px', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: '0.76rem', color: 'var(--text-muted)' }}>{p.reason}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, fontSize: '0.84rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>
                      Total: <strong style={{ color: over ? 'var(--danger)' : 'var(--success)' }}>{formatCurrency(total)}</strong>
                      {income > 0 && <span style={{ color: 'var(--text-muted)' }}> of {formatCurrency(income)} income</span>}
                      {over && <span style={{ color: 'var(--danger)' }}> — over income</span>}
                    </span>
                  </div>

                  <div className="modal-actions" style={{ marginTop: 12 }}>
                    <button className="btn btn-ghost" onClick={() => setShowAssistant(false)} disabled={applying}>Cancel</button>
                    <button className="btn btn-primary" onClick={applyPlan} disabled={applying || plan.filter(p => p.selected).length === 0}>
                      {applying ? 'Applying…' : `Apply ${plan.filter(p => p.selected).length} budgets`}
                    </button>
                  </div>
                </>
              )
            })()}
          </div>
        </div>
      )}
    </div>
  )
}
