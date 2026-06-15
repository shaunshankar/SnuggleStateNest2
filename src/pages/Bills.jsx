import { useState, useEffect } from 'react'
import { Plus, Pencil, Trash2, CheckCircle, Receipt, Sparkles, X } from 'lucide-react'
import { api } from '../utils/api'
import { formatCurrency, daysUntil, ordinal } from '../utils/formatters'
import { CATEGORIES, CATEGORY_ICONS } from '../utils/categories'
import toast from 'react-hot-toast'

const EMPTY = { name: '', amount: '', due_day: '1', frequency: 'monthly', category: 'utilities' }

export default function Bills() {
  const [bills, setBills] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editBill, setEditBill] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [detecting, setDetecting] = useState(false)
  const [detected, setDetected] = useState(null)
  const [addingDetected, setAddingDetected] = useState(false)

  useEffect(() => { loadBills() }, [])

  async function handleDetect() {
    setDetecting(true)
    try {
      const { transactions } = await api.get('/transactions', { limit: 500 })
      if (!transactions?.length) { toast.error('No transactions to analyse yet — import a statement first'); return }
      const { bills } = await api.post('/ai/detect', { transactions })
      if (!bills?.length) { toast('No recurring bills found in your transactions', { icon: '🔍' }); return }
      setDetected(bills.map(b => ({
        name: b.name || '',
        amount: parseFloat(b.amount || 0).toFixed(2),
        due_day: Math.min(31, Math.max(1, parseInt(b.due_day) || 1)),
        frequency: ['monthly', 'weekly', 'fortnightly', 'yearly'].includes(b.frequency) ? b.frequency : 'monthly',
        category: CATEGORIES.includes(b.category) ? b.category : 'other',
        confidence: b.confidence || 'medium',
        selected: true
      })))
    } catch (err) { toast.error(err.message) }
    finally { setDetecting(false) }
  }

  function updateDetected(idx, field, value) {
    setDetected(rows => rows.map((r, i) => i === idx ? { ...r, [field]: value } : r))
  }

  async function handleAddDetected() {
    const selected = detected.filter(r => r.selected)
    if (!selected.length) return toast.error('No bills selected')
    setAddingDetected(true)
    try {
      const { imported, skipped } = await api.post('/bills', { bills: selected })
      toast.success(skipped > 0 ? `Added ${imported} bills, skipped ${skipped} already-existing` : `Added ${imported} bills`)
      setDetected(null)
      loadBills()
    } catch (err) { toast.error(err.message) }
    finally { setAddingDetected(false) }
  }

  async function loadBills() {
    setLoading(true)
    try {
      const { bills } = await api.get('/bills')
      setBills(bills)
    } catch (err) { toast.error(err.message) }
    finally { setLoading(false) }
  }

  function openAdd() { setForm(EMPTY); setEditBill(null); setShowModal(true) }
  function openEdit(b) {
    setForm({ name: b.name, amount: b.amount, due_day: String(b.due_day), frequency: b.frequency, category: b.category })
    setEditBill(b); setShowModal(true)
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    try {
      if (editBill) {
        const { bill } = await api.put(`/bills/${editBill.id}`, form)
        setBills(bs => bs.map(b => b.id === editBill.id ? bill : b))
        toast.success('Bill updated')
      } else {
        const { bill } = await api.post('/bills', form)
        setBills(bs => [...bs, bill])
        toast.success('Bill added')
      }
      setShowModal(false)
    } catch (err) { toast.error(err.message) }
    finally { setSaving(false) }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this bill?')) return
    try {
      await api.del(`/bills/${id}`)
      setBills(bs => bs.filter(b => b.id !== id))
      toast.success('Deleted')
    } catch (err) { toast.error(err.message) }
  }

  async function handlePay(id) {
    try {
      const { bill } = await api.post('/bills/pay', { bill_id: id })
      setBills(bs => bs.map(b => b.id === id ? bill : b))
      toast.success('Bill marked as paid ✓')
    } catch (err) { toast.error(err.message) }
  }

  const active = bills.filter(b => !b.is_paid)
  const paid = bills.filter(b => b.is_paid)
  const totalMonthly = active.filter(b => b.frequency === 'monthly').reduce((s, b) => s + parseFloat(b.amount), 0)

  function getBillStatus(b) {
    const days = daysUntil(b.due_day)
    if (days <= 0) return { label: 'Overdue', cls: 'bill-overdue' }
    if (days <= 3) return { label: `Due in ${days} day${days > 1 ? 's' : ''}`, cls: 'bill-due-soon' }
    if (days <= 7) return { label: `Due in ${days} days`, cls: '' }
    return { label: `Due ${ordinal(b.due_day)}`, cls: '' }
  }

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2>Bills & Subscriptions</h2>
          <p>Monthly total: {formatCurrency(totalMonthly)}</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary btn-sm" onClick={handleDetect} disabled={detecting}>
            <Sparkles size={15} /> {detecting ? 'Analysing…' : 'Detect bills (AI)'}
          </button>
          <button className="btn btn-primary btn-sm" onClick={openAdd}>
            <Plus size={15} /> Add Bill
          </button>
        </div>
      </div>

      {loading ? (
        [1,2,3].map(i => <div key={i} className="skeleton skeleton-card" style={{ height: 72, marginBottom: 10 }} />)
      ) : bills.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><Receipt size={24} color="var(--gold)" /></div>
          <h3>No bills yet</h3>
          <p>Add your recurring bills and subscriptions to get reminders before they're due.</p>
          <button className="btn btn-primary" onClick={openAdd}><Plus size={15} /> Add your first bill</button>
        </div>
      ) : (
        <>
          {active.length > 0 && (
            <div className="card" style={{ marginBottom: 20 }}>
              <h3 style={{ fontSize: '0.85rem', marginBottom: 16, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Upcoming</h3>
              {active.map(b => {
                const status = getBillStatus(b)
                return (
                  <div key={b.id} className="bill-item">
                    <div className="bill-icon"><Receipt size={18} color="var(--gold)" /></div>
                    <div className="bill-info">
                      <div className="bill-name">{b.name}</div>
                      <div className={`bill-meta ${status.cls}`}>{status.label} · {b.frequency}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div className="bill-amount">{formatCurrency(b.amount)}</div>
                      <button className="btn btn-ghost btn-icon btn-sm" style={{ color: 'var(--success)' }} title="Mark as paid" onClick={() => handlePay(b.id)}><CheckCircle size={16} /></button>
                      <button className="btn btn-ghost btn-icon btn-sm" onClick={() => openEdit(b)}><Pencil size={14} /></button>
                      <button className="btn btn-ghost btn-icon btn-sm" style={{ color: 'var(--danger)' }} onClick={() => handleDelete(b.id)}><Trash2 size={14} /></button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {paid.length > 0 && (
            <div className="card">
              <h3 style={{ fontSize: '0.85rem', marginBottom: 16, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Paid this month</h3>
              {paid.map(b => (
                <div key={b.id} className="bill-item" style={{ opacity: 0.5 }}>
                  <div className="bill-icon"><CheckCircle size={18} color="var(--success)" /></div>
                  <div className="bill-info">
                    <div className="bill-name">{b.name}</div>
                    <div className="bill-meta">Paid</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div className="bill-amount">{formatCurrency(b.amount)}</div>
                    <button className="btn btn-ghost btn-icon btn-sm" style={{ color: 'var(--danger)' }} onClick={() => handleDelete(b.id)}><Trash2 size={14} /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>{editBill ? 'Edit Bill' : 'Add Bill'}</h3>
            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="form-group">
                <label>Bill name</label>
                <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Netflix, Electricity" required />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Amount ($)</label>
                  <input type="number" step="0.01" min="0" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="0.00" required />
                </div>
                <div className="form-group">
                  <label>Due day of month</label>
                  <input type="number" min="1" max="31" value={form.due_day} onChange={e => setForm(f => ({ ...f, due_day: e.target.value }))} required />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Frequency</label>
                  <select value={form.frequency} onChange={e => setForm(f => ({ ...f, frequency: e.target.value }))}>
                    <option value="monthly">Monthly</option>
                    <option value="weekly">Weekly</option>
                    <option value="fortnightly">Fortnightly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Category</label>
                  <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                    {CATEGORIES.filter(c => c !== 'income').map(c => <option key={c} value={c}>{CATEGORY_ICONS[c]} {c.replace('_', ' ')}</option>)}
                  </select>
                </div>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* AI-detected bills review modal */}
      {detected && (
        <div className="modal-overlay" onClick={() => { if (!addingDetected) setDetected(null) }}>
          <div className="modal modal-wide" style={{ maxWidth: 760 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}><Sparkles size={18} color="var(--gold)" /> Detected recurring bills</h3>
              {!addingDetected && <button className="btn btn-ghost btn-icon" onClick={() => setDetected(null)}><X size={18} /></button>}
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', marginBottom: 16 }}>
              Review and tick the ones to add. Amounts and days are estimates — edit anything before adding. Bills that already exist are skipped automatically.
            </p>

            <div style={{ maxHeight: 420, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-card)', zIndex: 1 }}>
                  <tr>
                    {['', 'Name', 'Amount', 'Day', 'Frequency', 'Category', ''].map((h, i) => (
                      <th key={i} style={{ padding: '10px 10px', textAlign: 'left', fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid var(--border)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {detected.map((b, i) => (
                    <tr key={i} style={{ opacity: b.selected ? 1 : 0.4 }}>
                      <td style={{ padding: '6px 10px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        <input type="checkbox" checked={b.selected} onChange={e => updateDetected(i, 'selected', e.target.checked)} style={{ width: 14, height: 14, cursor: 'pointer' }} />
                      </td>
                      <td style={{ padding: '6px 10px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        <input value={b.name} onChange={e => updateDetected(i, 'name', e.target.value)} style={inputStyle} />
                      </td>
                      <td style={{ padding: '6px 10px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        <input type="number" step="0.01" value={b.amount} onChange={e => updateDetected(i, 'amount', e.target.value)} style={{ ...inputStyle, width: 84 }} />
                      </td>
                      <td style={{ padding: '6px 10px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        <input type="number" min="1" max="31" value={b.due_day} onChange={e => updateDetected(i, 'due_day', e.target.value)} style={{ ...inputStyle, width: 56 }} />
                      </td>
                      <td style={{ padding: '6px 10px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        <select value={b.frequency} onChange={e => updateDetected(i, 'frequency', e.target.value)} style={inputStyle}>
                          {['monthly', 'weekly', 'fortnightly', 'yearly'].map(f => <option key={f} value={f}>{f}</option>)}
                        </select>
                      </td>
                      <td style={{ padding: '6px 10px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        <select value={b.category} onChange={e => updateDetected(i, 'category', e.target.value)} style={inputStyle}>
                          {CATEGORIES.filter(c => c !== 'income').map(c => <option key={c} value={c}>{CATEGORY_ICONS[c]} {c.replace('_', ' ')}</option>)}
                        </select>
                      </td>
                      <td style={{ padding: '6px 10px', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'capitalize' }}>{b.confidence}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="modal-actions" style={{ marginTop: 16 }}>
              <button className="btn btn-ghost" onClick={() => setDetected(null)} disabled={addingDetected}>Cancel</button>
              <button className="btn btn-primary" onClick={handleAddDetected} disabled={addingDetected || detected.filter(b => b.selected).length === 0}>
                {addingDetected ? 'Adding…' : `Add ${detected.filter(b => b.selected).length} selected`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const inputStyle = {
  background: 'var(--bg-input)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6,
  color: 'var(--text-primary)', padding: '4px 8px', fontSize: '0.8rem', width: '100%'
}
