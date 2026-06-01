import { useState, useEffect, useRef } from 'react'
import { Plus, Upload, Pencil, Trash2, X, Check } from 'lucide-react'
import { api } from '../utils/api'
import { formatCurrency, formatDate } from '../utils/formatters'
import { CATEGORIES, CATEGORY_ICONS } from '../utils/categories'
import toast from 'react-hot-toast'

const EMPTY_FORM = { amount: '', type: 'expense', category: 'other', description: '', date: new Date().toISOString().split('T')[0], notes: '' }

export default function Transactions() {
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [editTx, setEditTx] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [filters, setFilters] = useState({ search: '', category: '', type: '' })
  const [saving, setSaving] = useState(false)
  const [csvRows, setCsvRows] = useState(null)
  const [csvLoading, setCsvLoading] = useState(false)
  const catTimer = useRef(null)

  useEffect(() => { loadTransactions() }, [])

  async function loadTransactions() {
    setLoading(true)
    try {
      const params = {}
      if (filters.search) params.search = filters.search
      if (filters.category) params.category = filters.category
      if (filters.type) params.type = filters.type
      const { transactions } = await api.get('/transactions', params)
      setTransactions(transactions)
    } catch (err) { toast.error(err.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { loadTransactions() }, [filters])

  function openAdd() { setForm(EMPTY_FORM); setEditTx(null); setShowModal(true) }
  function openEdit(tx) {
    setForm({ amount: tx.amount, type: tx.type, category: tx.category, description: tx.description, date: tx.date.split('T')[0], notes: tx.notes || '' })
    setEditTx(tx)
    setShowModal(true)
  }

  function onDescChange(e) {
    const val = e.target.value
    setForm(f => ({ ...f, description: val }))
    clearTimeout(catTimer.current)
    if (val.length > 3) {
      catTimer.current = setTimeout(async () => {
        try {
          const { category } = await api.post('/ai/categorise', { description: val })
          setForm(f => ({ ...f, category }))
        } catch { /* silent */ }
      }, 500)
    }
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    try {
      if (editTx) {
        const { transaction } = await api.put(`/transactions/${editTx.id}`, form)
        setTransactions(ts => ts.map(t => t.id === editTx.id ? transaction : t))
        toast.success('Transaction updated')
      } else {
        const { transaction } = await api.post('/transactions', form)
        setTransactions(ts => [transaction, ...ts])
        toast.success('Transaction added')
      }
      setShowModal(false)
    } catch (err) { toast.error(err.message) }
    finally { setSaving(false) }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this transaction?')) return
    try {
      await api.del(`/transactions/${id}`)
      setTransactions(ts => ts.filter(t => t.id !== id))
      toast.success('Deleted')
    } catch (err) { toast.error(err.message) }
  }

  async function handleCsvUpload(e) {
    const file = e.target.files[0]
    if (!file) return
    setCsvLoading(true)
    try {
      const csv = await file.text()
      const { transactions } = await api.post('/ai/import', { csv })
      setCsvRows(transactions.map(t => ({ ...t, selected: true })))
    } catch (err) { toast.error('Failed to parse CSV: ' + err.message) }
    finally { setCsvLoading(false) }
  }

  async function handleImportConfirm() {
    const selected = csvRows.filter(r => r.selected)
    if (!selected.length) return toast.error('No rows selected')
    setSaving(true)
    try {
      for (const row of selected) {
        await api.post('/transactions', { ...row, is_imported: true })
      }
      toast.success(`Imported ${selected.length} transactions`)
      setShowImport(false)
      setCsvRows(null)
      loadTransactions()
    } catch (err) { toast.error(err.message) }
    finally { setSaving(false) }
  }

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2>Transactions</h2>
          <p>Track every dollar in and out of your household</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary btn-sm" onClick={() => setShowImport(true)}>
            <Upload size={15} /> Import CSV
          </button>
          <button className="btn btn-primary btn-sm" onClick={openAdd}>
            <Plus size={15} /> Add
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="filters">
        <input placeholder="Search description…" value={filters.search} onChange={e => setFilters(f => ({ ...f, search: e.target.value }))} style={{ width: 220 }} />
        <select value={filters.category} onChange={e => setFilters(f => ({ ...f, category: e.target.value }))}>
          <option value="">All categories</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_ICONS[c]} {c.replace('_', ' ')}</option>)}
        </select>
        <select value={filters.type} onChange={e => setFilters(f => ({ ...f, type: e.target.value }))}>
          <option value="">All types</option>
          <option value="income">Income</option>
          <option value="expense">Expense</option>
        </select>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Description</th>
                <th>Category</th>
                <th>Type</th>
                <th style={{ textAlign: 'right' }}>Amount</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>Loading…</td></tr>
              ) : transactions.length === 0 ? (
                <tr><td colSpan={6} style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>
                  No transactions yet — add your first one above 💸
                </td></tr>
              ) : transactions.map(t => (
                <tr key={t.id}>
                  <td style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{formatDate(t.date)}</td>
                  <td>
                    <div style={{ fontWeight: 500 }}>{t.description}</div>
                    {t.notes && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t.notes}</div>}
                  </td>
                  <td>
                    <span className="badge badge-category">{CATEGORY_ICONS[t.category]} {t.category.replace('_', ' ')}</span>
                  </td>
                  <td><span className={`badge badge-${t.type}`}>{t.type}</span></td>
                  <td style={{ textAlign: 'right' }}>
                    <span className={t.type === 'income' ? 'amount-income' : 'amount-expense'}>
                      {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                      <button className="btn btn-ghost btn-icon" onClick={() => openEdit(t)}><Pencil size={14} /></button>
                      <button className="btn btn-ghost btn-icon" style={{ color: 'var(--danger)' }} onClick={() => handleDelete(t.id)}><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>{editTx ? 'Edit Transaction' : 'Add Transaction'}</h3>
            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="form-row">
                <div className="form-group">
                  <label>Type</label>
                  <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                    <option value="expense">Expense</option>
                    <option value="income">Income</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Amount ($)</label>
                  <input type="number" step="0.01" min="0" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="0.00" required />
                </div>
              </div>
              <div className="form-group">
                <label>Description</label>
                <input type="text" value={form.description} onChange={onDescChange} placeholder="e.g. Woolworths" required />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Category</label>
                  <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_ICONS[c]} {c.replace('_', ' ')}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Date</label>
                  <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} required />
                </div>
              </div>
              <div className="form-group">
                <label>Notes (optional)</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Any additional notes…" rows={2} />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving…' : editTx ? 'Update' : 'Add transaction'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CSV Import Modal */}
      {showImport && (
        <div className="modal-overlay" onClick={() => { setShowImport(false); setCsvRows(null) }}>
          <div className="modal modal-wide" onClick={e => e.stopPropagation()}>
            <h3>Import from CSV</h3>
            {!csvRows ? (
              <div style={{ textAlign: 'center', padding: '32px 0' }}>
                <p style={{ color: 'var(--text-secondary)', marginBottom: 20, fontSize: '0.875rem' }}>
                  Upload your bank statement CSV and Claude AI will categorise each transaction automatically.
                </p>
                <label className="btn btn-secondary" style={{ cursor: 'pointer' }}>
                  {csvLoading ? 'Parsing with AI…' : '📄 Choose CSV file'}
                  <input type="file" accept=".csv" style={{ display: 'none' }} onChange={handleCsvUpload} disabled={csvLoading} />
                </label>
              </div>
            ) : (
              <>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: 16 }}>
                  Review and select which transactions to import ({csvRows.filter(r => r.selected).length} selected)
                </p>
                <div className="table-wrap" style={{ maxHeight: 360, overflowY: 'auto' }}>
                  <table>
                    <thead>
                      <tr>
                        <th style={{ width: 40 }}></th>
                        <th>Date</th>
                        <th>Description</th>
                        <th>Category</th>
                        <th>Type</th>
                        <th style={{ textAlign: 'right' }}>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {csvRows.map((r, i) => (
                        <tr key={i}>
                          <td>
                            <input type="checkbox" checked={r.selected} onChange={e => setCsvRows(rows => rows.map((row, j) => j === i ? { ...row, selected: e.target.checked } : row))} />
                          </td>
                          <td style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>{r.date}</td>
                          <td style={{ fontSize: '0.8rem' }}>{r.description}</td>
                          <td><select value={r.category} onChange={e => setCsvRows(rows => rows.map((row, j) => j === i ? { ...row, category: e.target.value } : row))} style={{ padding: '4px 8px', fontSize: '0.75rem' }}>
                            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                          </select></td>
                          <td><span className={`badge badge-${r.type}`}>{r.type}</span></td>
                          <td style={{ textAlign: 'right', fontFamily: 'Playfair Display' }}>{formatCurrency(r.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="modal-actions">
                  <button className="btn btn-ghost" onClick={() => { setShowImport(false); setCsvRows(null) }}>Cancel</button>
                  <button className="btn btn-primary" onClick={handleImportConfirm} disabled={saving}>
                    {saving ? 'Importing…' : `Import ${csvRows.filter(r => r.selected).length} transactions`}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
