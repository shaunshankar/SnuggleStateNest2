import { useState, useEffect } from 'react'
import { Plus, Pencil, Trash2, TrendingUp, Sparkles } from 'lucide-react'
import { api } from '../utils/api'
import { formatCurrency } from '../utils/formatters'
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

  async function handleInsights() {
    setInsightsLoading(true)
    try {
      const payload = budgets.map(b => ({ category: b.category, monthly_limit: parseFloat(b.monthly_limit), spent: b.spent || 0 }))
      const { insights } = await api.post('/ai/insights', { mode: 'budget', payload })
      setInsights(insights)
    } catch (err) { toast.error(err.message) }
    finally { setInsightsLoading(false) }
  }

  const now = new Date()
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const daysPassed = now.getDate()
  const daysLeft = daysInMonth - daysPassed

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
          <p>{daysLeft} days left in {now.toLocaleString('en-AU', { month: 'long' })}</p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={openAdd}>
          <Plus size={15} /> Add Budget
        </button>
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
    </div>
  )
}
