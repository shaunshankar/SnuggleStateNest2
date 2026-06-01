import { useState, useEffect } from 'react'
import { Plus, Pencil, Trash2, CheckCircle, Receipt } from 'lucide-react'
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

  useEffect(() => { loadBills() }, [])

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
        <button className="btn btn-primary btn-sm" onClick={openAdd}>
          <Plus size={15} /> Add Bill
        </button>
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
    </div>
  )
}
