import { useState, useEffect } from 'react'
import { Plus, Pencil, Trash2, Target, PlusCircle } from 'lucide-react'
import { api } from '../utils/api'
import { formatCurrency, formatDate } from '../utils/formatters'
import ProgressRing from '../components/ProgressRing'
import toast from 'react-hot-toast'

const EMPTY_GOAL = { name: '', target_amount: '', target_date: '', description: '' }
const EMPTY_CONTRIB = { amount: '', date: new Date().toISOString().split('T')[0], notes: '' }

export default function Savings() {
  const [goals, setGoals] = useState([])
  const [loading, setLoading] = useState(true)
  const [showGoalModal, setShowGoalModal] = useState(false)
  const [showContribModal, setShowContribModal] = useState(null)
  const [editGoal, setEditGoal] = useState(null)
  const [goalForm, setGoalForm] = useState(EMPTY_GOAL)
  const [contribForm, setContribForm] = useState(EMPTY_CONTRIB)
  const [saving, setSaving] = useState(false)
  const [celebrating, setCelebrating] = useState(null)

  useEffect(() => { loadGoals() }, [])

  async function loadGoals() {
    setLoading(true)
    try {
      const { goals } = await api.get('/savings')
      setGoals(goals)
    } catch (err) { toast.error(err.message) }
    finally { setLoading(false) }
  }

  function openAdd() { setGoalForm(EMPTY_GOAL); setEditGoal(null); setShowGoalModal(true) }
  function openEdit(g) { setGoalForm({ name: g.name, target_amount: g.target_amount, target_date: g.target_date?.split('T')[0] || '', description: g.description || '' }); setEditGoal(g); setShowGoalModal(true) }

  async function handleSaveGoal(e) {
    e.preventDefault()
    setSaving(true)
    try {
      if (editGoal) {
        const { goal } = await api.put(`/savings/${editGoal.id}`, goalForm)
        setGoals(gs => gs.map(g => g.id === editGoal.id ? goal : g))
        toast.success('Goal updated')
      } else {
        const { goal } = await api.post('/savings', goalForm)
        setGoals(gs => [goal, ...gs])
        toast.success('Goal created!')
      }
      setShowGoalModal(false)
    } catch (err) { toast.error(err.message) }
    finally { setSaving(false) }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this savings goal?')) return
    try {
      await api.del(`/savings/${id}`)
      setGoals(gs => gs.filter(g => g.id !== id))
      toast.success('Deleted')
    } catch (err) { toast.error(err.message) }
  }

  async function handleContribute(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const { goal } = await api.post('/savings/contribute', { goal_id: showContribModal.id, ...contribForm })
      setGoals(gs => gs.map(g => g.id === goal.id ? goal : g))
      const complete = parseFloat(goal.current_amount) >= parseFloat(goal.target_amount)
      if (complete) { setCelebrating(goal.id); setTimeout(() => setCelebrating(null), 2000) }
      toast.success(complete ? '🎉 Goal reached!' : 'Contribution added!')
      setShowContribModal(null)
      setContribForm(EMPTY_CONTRIB)
    } catch (err) { toast.error(err.message) }
    finally { setSaving(false) }
  }

  function projectedDate(goal) {
    if (parseFloat(goal.current_amount) >= parseFloat(goal.target_amount)) return 'Complete!'
    // placeholder
    return null
  }

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2>Savings Goals</h2>
          <p>Track your household savings and milestones</p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={openAdd}>
          <Plus size={15} /> New Goal
        </button>
      </div>

      {loading ? (
        [1,2].map(i => <div key={i} className="skeleton" style={{ height: 140, borderRadius: 12, marginBottom: 12 }} />)
      ) : goals.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><Target size={24} color="var(--gold)" /></div>
          <h3>No savings goals yet</h3>
          <p>Set up goals for the things that matter most — a holiday, a home, or an emergency fund.</p>
          <button className="btn btn-primary" onClick={openAdd}><Plus size={15} /> Create your first goal</button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
          {goals.map(g => {
            const current = parseFloat(g.current_amount)
            const target = parseFloat(g.target_amount)
            const pct = target > 0 ? Math.min(current / target, 1) : 0
            const pctDisplay = Math.round(pct * 100)
            const complete = pct >= 1

            return (
              <div key={g.id} className={`card card-gold ${celebrating === g.id ? 'celebrate' : ''}`} style={complete ? { borderColor: 'rgba(34,197,94,0.4)' } : {}}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                  <div>
                    <h3 style={{ fontSize: '1.1rem', marginBottom: 4 }}>{g.name}</h3>
                    {g.description && <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{g.description}</p>}
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button className="btn btn-ghost btn-icon btn-sm" onClick={() => openEdit(g)}><Pencil size={14} /></button>
                    <button className="btn btn-ghost btn-icon btn-sm" style={{ color: 'var(--danger)' }} onClick={() => handleDelete(g.id)}><Trash2 size={14} /></button>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
                  <ProgressRing value={current} max={target} size={72} strokeWidth={6} />
                  <div>
                    <div style={{ fontFamily: 'Playfair Display', fontSize: '1.5rem', color: complete ? 'var(--success)' : 'var(--gold-light)' }}>
                      {complete ? '🎉 Complete!' : `${pctDisplay}%`}
                    </div>
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                      {formatCurrency(current)} of {formatCurrency(target)}
                    </div>
                    {g.target_date && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>
                        Target: {formatDate(g.target_date)}
                      </div>
                    )}
                  </div>
                </div>

                <button
                  className="btn btn-secondary"
                  style={{ width: '100%', justifyContent: 'center' }}
                  onClick={() => { setContribForm(EMPTY_CONTRIB); setShowContribModal(g) }}
                  disabled={complete}
                >
                  <PlusCircle size={15} /> Add contribution
                </button>
              </div>
            )
          })}
        </div>
      )}

      {showGoalModal && (
        <div className="modal-overlay" onClick={() => setShowGoalModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>{editGoal ? 'Edit Goal' : 'New Savings Goal'}</h3>
            <form onSubmit={handleSaveGoal} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="form-group">
                <label>Goal name</label>
                <input type="text" value={goalForm.name} onChange={e => setGoalForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Europe Holiday" required />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Target amount ($)</label>
                  <input type="number" step="0.01" min="1" value={goalForm.target_amount} onChange={e => setGoalForm(f => ({ ...f, target_amount: e.target.value }))} placeholder="e.g. 5000" required />
                </div>
                <div className="form-group">
                  <label>Target date (optional)</label>
                  <input type="date" value={goalForm.target_date} onChange={e => setGoalForm(f => ({ ...f, target_date: e.target.value }))} />
                </div>
              </div>
              <div className="form-group">
                <label>Description (optional)</label>
                <textarea value={goalForm.description} onChange={e => setGoalForm(f => ({ ...f, description: e.target.value }))} rows={2} placeholder="What is this goal for?" />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setShowGoalModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showContribModal && (
        <div className="modal-overlay" onClick={() => setShowContribModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Add Contribution</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: 16 }}>
              Adding to: <strong style={{ color: 'var(--gold-light)' }}>{showContribModal.name}</strong>
            </p>
            <form onSubmit={handleContribute} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="form-row">
                <div className="form-group">
                  <label>Amount ($)</label>
                  <input type="number" step="0.01" min="0.01" value={contribForm.amount} onChange={e => setContribForm(f => ({ ...f, amount: e.target.value }))} placeholder="0.00" required autoFocus />
                </div>
                <div className="form-group">
                  <label>Date</label>
                  <input type="date" value={contribForm.date} onChange={e => setContribForm(f => ({ ...f, date: e.target.value }))} required />
                </div>
              </div>
              <div className="form-group">
                <label>Notes (optional)</label>
                <input type="text" value={contribForm.notes} onChange={e => setContribForm(f => ({ ...f, notes: e.target.value }))} placeholder="e.g. Tax return" />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setShowContribModal(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Adding…' : 'Add contribution'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
