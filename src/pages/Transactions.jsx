import { useState, useEffect, useRef, useMemo } from 'react'
import { Plus, Upload, Pencil, Trash2, X, ChevronDown } from 'lucide-react'
import { api } from '../utils/api'
import { formatCurrency, formatDate } from '../utils/formatters'
import { CATEGORIES, CATEGORY_ICONS } from '../utils/categories'
import { parseAnzCsv } from '../utils/anzParser'
import toast from 'react-hot-toast'

const EMPTY_FORM = {
  amount: '', type: 'expense', category: 'other',
  description: '', date: new Date().toISOString().split('T')[0], notes: ''
}

export default function Transactions() {
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [editTx, setEditTx] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [filters, setFilters] = useState({ search: '', category: '', type: '' })
  const [saving, setSaving] = useState(false)
  const [parsedRows, setParsedRows] = useState(null)
  const [importing, setImporting] = useState(false)
  const catTimer = useRef(null)

  useEffect(() => { loadTransactions() }, [filters])

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

  function openAdd() { setForm(EMPTY_FORM); setEditTx(null); setShowModal(true) }
  function openEdit(tx) {
    setForm({ amount: tx.amount, type: tx.type, category: tx.category, description: tx.description, date: tx.date.split('T')[0], notes: tx.notes || '' })
    setEditTx(tx); setShowModal(true)
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

  function handleCsvFile(e) {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const rows = parseAnzCsv(ev.target.result)
        if (!rows.length) return toast.error('No transactions found in file')
        setParsedRows(rows)
      } catch (err) {
        toast.error('Failed to parse CSV: ' + err.message)
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  function updateRow(idx, field, value) {
    setParsedRows(rows => rows.map((r, i) => i === idx ? { ...r, [field]: value } : r))
  }

  async function handleImport() {
    const selected = parsedRows.filter(r => r.selected)
    if (!selected.length) return toast.error('No transactions selected')
    setImporting(true)
    try {
      const { imported, skipped } = await api.post('/transactions', { transactions: selected })
      const msg = skipped > 0
        ? `Imported ${imported} transactions, skipped ${skipped} duplicate${skipped > 1 ? 's' : ''}`
        : `Imported ${imported} transactions`
      toast.success(msg)
      setShowImport(false)
      setParsedRows(null)
      loadTransactions()
    } catch (err) { toast.error(err.message) }
    finally { setImporting(false) }
  }

  // Summary for preview
  const summary = useMemo(() => {
    if (!parsedRows) return null
    const sel = parsedRows.filter(r => r.selected)
    const income = sel.filter(r => r.type === 'income')
    const expense = sel.filter(r => r.type === 'expense')
    return {
      incomeCount: income.length,
      expenseCount: expense.length,
      totalIncome: income.reduce((s, r) => s + parseFloat(r.amount), 0),
      totalExpense: expense.reduce((s, r) => s + parseFloat(r.amount), 0),
      selectedCount: sel.length
    }
  }, [parsedRows])

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2>Transactions</h2>
          <p>Track every dollar in and out of your household</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary btn-sm" onClick={() => { setParsedRows(null); setShowImport(true) }}>
            <Upload size={15} /> Import ANZ CSV
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
                  <td><span className="badge badge-category">{CATEGORY_ICONS[t.category]} {t.category.replace('_', ' ')}</span></td>
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
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : editTx ? 'Update' : 'Add transaction'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ANZ Import Modal */}
      {showImport && (
        <div className="modal-overlay" onClick={() => { if (!importing) { setShowImport(false); setParsedRows(null) } }}>
          <div className="modal modal-wide" style={{ maxWidth: parsedRows ? 900 : 480 }} onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0 }}>Import ANZ Bank Statement</h3>
              {!importing && (
                <button className="btn btn-ghost btn-icon" onClick={() => { setShowImport(false); setParsedRows(null) }}>
                  <X size={18} />
                </button>
              )}
            </div>

            {/* Upload phase */}
            {!parsedRows ? (
              <div style={{ textAlign: 'center', padding: '32px 0' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>📄</div>
                <p style={{ color: 'var(--text-secondary)', marginBottom: 8, fontSize: '0.9rem' }}>
                  Upload your ANZ bank statement CSV export.
                </p>
                <p style={{ color: 'var(--text-muted)', marginBottom: 24, fontSize: '0.8rem' }}>
                  Descriptions are cleaned automatically and transactions are categorised based on merchant patterns.
                </p>
                <label className="btn btn-primary" style={{ cursor: 'pointer', display: 'inline-flex' }}>
                  <Upload size={15} /> Choose CSV file
                  <input type="file" accept=".csv,.txt" style={{ display: 'none' }} onChange={handleCsvFile} />
                </label>
              </div>
            ) : (
              <>
                {/* Summary bar */}
                <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
                  <div style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 8, padding: '8px 14px', fontSize: '0.82rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Income </span>
                    <strong style={{ color: 'var(--success)' }}>{summary.incomeCount} txns · +{formatCurrency(summary.totalIncome)}</strong>
                  </div>
                  <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '8px 14px', fontSize: '0.82rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Expenses </span>
                    <strong style={{ color: 'var(--danger)' }}>{summary.expenseCount} txns · -{formatCurrency(summary.totalExpense)}</strong>
                  </div>
                  <div style={{ background: 'var(--gold-dim)', border: '1px solid var(--gold-border)', borderRadius: 8, padding: '8px 14px', fontSize: '0.82rem', marginLeft: 'auto' }}>
                    <strong style={{ color: 'var(--gold-light)' }}>{summary.selectedCount} selected</strong>
                  </div>
                </div>

                {/* Select all / deselect all */}
                <div style={{ display: 'flex', gap: 10, marginBottom: 10, alignItems: 'center' }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => setParsedRows(r => r.map(x => ({ ...x, selected: true })))}>Select all</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setParsedRows(r => r.map(x => ({ ...x, selected: false })))}>Deselect all</button>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginLeft: 4 }}>{parsedRows.length} total rows</span>
                </div>

                {/* Preview table */}
                <div style={{ maxHeight: 420, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-card)', zIndex: 1 }}>
                      <tr>
                        <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: '0.72rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.6px', borderBottom: '1px solid var(--border)', width: 32 }}></th>
                        <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: '0.72rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.6px', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>Date</th>
                        <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: '0.72rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.6px', borderBottom: '1px solid var(--border)' }}>Description</th>
                        <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: '0.72rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.6px', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>Amount</th>
                        <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: '0.72rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.6px', borderBottom: '1px solid var(--border)' }}>Type</th>
                        <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: '0.72rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.6px', borderBottom: '1px solid var(--border)' }}>Category</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsedRows.map((row, i) => (
                        <tr key={i} style={{ opacity: row.selected ? 1 : 0.35 }}>
                          <td style={{ padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                            <input type="checkbox" checked={row.selected} onChange={e => updateRow(i, 'selected', e.target.checked)} style={{ width: 14, height: 14, cursor: 'pointer' }} />
                          </td>
                          <td style={{ padding: '8px 12px', fontSize: '0.8rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                            {formatDate(row.date)}
                          </td>
                          <td style={{ padding: '8px 12px', fontSize: '0.82rem', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span>{row.description}</span>
                              {row.isInternal && (
                                <span style={{ fontSize: '0.65rem', background: 'rgba(255,255,255,0.08)', color: 'var(--text-muted)', padding: '1px 6px', borderRadius: 4 }}>internal</span>
                              )}
                            </div>
                            {row.notes && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>{row.notes}</div>}
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'Playfair Display', fontSize: '0.9rem', whiteSpace: 'nowrap', borderBottom: '1px solid rgba(255,255,255,0.04)', color: row.type === 'income' ? 'var(--success)' : 'var(--danger)' }}>
                            {row.type === 'income' ? '+' : '-'}{formatCurrency(row.amount)}
                          </td>
                          <td style={{ padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                            <span className={`badge badge-${row.type}`}>{row.type}</span>
                          </td>
                          <td style={{ padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                            <select
                              value={row.category}
                              onChange={e => updateRow(i, 'category', e.target.value)}
                              style={{ background: 'var(--bg-input)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: 'var(--text-primary)', padding: '4px 8px', fontSize: '0.78rem', width: '100%' }}
                            >
                              {CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_ICONS[c]} {c.replace('_', ' ')}</option>)}
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => setParsedRows(null)}>← Choose different file</button>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button className="btn btn-ghost" onClick={() => { setShowImport(false); setParsedRows(null) }} disabled={importing}>Cancel</button>
                    <button className="btn btn-primary" onClick={handleImport} disabled={importing || summary.selectedCount === 0}>
                      {importing ? 'Importing…' : `Import ${summary.selectedCount} transaction${summary.selectedCount !== 1 ? 's' : ''}`}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
