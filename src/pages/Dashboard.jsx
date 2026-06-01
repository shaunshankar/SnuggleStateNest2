import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, ArrowDownRight, TrendingUp, Receipt, ArrowRight } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { api } from '../utils/api'
import { formatCurrency, formatDate, formatDateShort, getGreeting, daysUntil, ordinal } from '../utils/formatters'
import { CATEGORY_ICONS } from '../utils/categories'
import ProgressBar from '../components/ProgressBar'
import ProgressRing from '../components/ProgressRing'

export default function Dashboard() {
  const { user } = useAuth()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const now = new Date()
        const start = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
        const end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]

        const [txRes, budgetRes, billsRes, savingsRes] = await Promise.all([
          api.get('/transactions', { from: start, to: end, limit: 5 }),
          api.get('/budgets'),
          api.get('/bills'),
          api.get('/savings')
        ])

        const txns = txRes.transactions
        const income = txns.filter(t => t.type === 'income').reduce((s, t) => s + parseFloat(t.amount), 0)
        const expenses = txns.filter(t => t.type === 'expense').reduce((s, t) => s + parseFloat(t.amount), 0)

        const upcomingBills = billsRes.bills
          .filter(b => !b.is_paid)
          .map(b => ({ ...b, daysUntil: daysUntil(b.due_day) }))
          .filter(b => b.daysUntil <= 7)
          .sort((a, b) => a.daysUntil - b.daysUntil)

        setData({
          income, expenses, net: income - expenses,
          transactions: txns,
          budgets: budgetRes.budgets.slice(0, 5),
          upcomingBills,
          goals: savingsRes.goals.slice(0, 3)
        })
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) return (
    <div>
      <div className="skeleton" style={{ height: 32, width: 260, marginBottom: 8 }} />
      <div className="stat-grid">
        {[1,2,3].map(i => <div key={i} className="skeleton skeleton-card" />)}
      </div>
    </div>
  )

  const firstName = user?.name?.split(' ')[0] || 'there'

  return (
    <div>
      <div className="greeting">
        <h2>{getGreeting()}, <span>{firstName}</span></h2>
        <p>Here's your household financial snapshot</p>
      </div>

      {/* Summary stats */}
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-label">Income this month</div>
          <div className="stat-value positive">{formatCurrency(data.income)}</div>
          <div className="stat-sub" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <ArrowUpRight size={14} color="var(--success)" /> All sources
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Expenses this month</div>
          <div className="stat-value negative">{formatCurrency(data.expenses)}</div>
          <div className="stat-sub" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <ArrowDownRight size={14} color="var(--danger)" /> Total spent
          </div>
        </div>
        <div className="stat-card" style={{ borderColor: data.net >= 0 ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)' }}>
          <div className="stat-label">Net savings</div>
          <div className={`stat-value ${data.net >= 0 ? 'positive' : 'negative'}`}>{formatCurrency(data.net)}</div>
          <div className="stat-sub" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <TrendingUp size={14} color="var(--gold)" /> This month
          </div>
        </div>
      </div>

      <div className="dashboard-grid">
        {/* Budget overview */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ fontSize: '1rem' }}>Budget Overview</h3>
            <Link to="/budgets" style={{ color: 'var(--gold)', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 4 }}>
              View all <ArrowRight size={14} />
            </Link>
          </div>
          {data.budgets.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>No budgets set yet. <Link to="/budgets" style={{ color: 'var(--gold)' }}>Create one →</Link></p>
          ) : data.budgets.map(b => (
            <div key={b.id} style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: '0.82rem' }}>
                <span>{CATEGORY_ICONS[b.category]} {b.category.replace('_', ' ')}</span>
                <span style={{ color: 'var(--text-secondary)' }}>{formatCurrency(b.spent)} / {formatCurrency(b.monthly_limit)}</span>
              </div>
              <ProgressBar value={b.spent} max={parseFloat(b.monthly_limit)} />
            </div>
          ))}
        </div>

        {/* Upcoming bills */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ fontSize: '1rem' }}>Bills Due This Week</h3>
            <Link to="/bills" style={{ color: 'var(--gold)', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 4 }}>
              View all <ArrowRight size={14} />
            </Link>
          </div>
          {data.upcomingBills.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>No bills due this week 🎉</p>
          ) : data.upcomingBills.map(b => (
            <div key={b.id} className="bill-item">
              <div className="bill-icon">
                <Receipt size={18} color="var(--gold)" />
              </div>
              <div className="bill-info">
                <div className="bill-name">{b.name}</div>
                <div className={`bill-meta ${b.daysUntil <= 1 ? 'bill-overdue' : b.daysUntil <= 3 ? 'bill-due-soon' : ''}`}>
                  {b.daysUntil === 0 ? 'Due today' : b.daysUntil === 1 ? 'Due tomorrow' : `Due in ${b.daysUntil} days`}
                </div>
              </div>
              <div className="bill-amount">{formatCurrency(b.amount)}</div>
            </div>
          ))}
        </div>

        {/* Savings goals */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ fontSize: '1rem' }}>Savings Goals</h3>
            <Link to="/savings" style={{ color: 'var(--gold)', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 4 }}>
              View all <ArrowRight size={14} />
            </Link>
          </div>
          {data.goals.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>No savings goals yet. <Link to="/savings" style={{ color: 'var(--gold)' }}>Add one →</Link></p>
          ) : data.goals.map(g => {
            const pct = parseFloat(g.target_amount) > 0
              ? Math.round((parseFloat(g.current_amount) / parseFloat(g.target_amount)) * 100) : 0
            return (
              <div key={g.id} className="goal-card">
                <ProgressRing value={parseFloat(g.current_amount)} max={parseFloat(g.target_amount)} />
                <div className="goal-info">
                  <div className="goal-name">{g.name}</div>
                  <div className="goal-sub">{formatCurrency(g.current_amount)} of {formatCurrency(g.target_amount)}</div>
                </div>
                <div className="goal-amount">{pct}%</div>
              </div>
            )
          })}
        </div>

        {/* Recent transactions */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ fontSize: '1rem' }}>Recent Transactions</h3>
            <Link to="/transactions" style={{ color: 'var(--gold)', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 4 }}>
              View all <ArrowRight size={14} />
            </Link>
          </div>
          {data.transactions.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>No transactions yet. <Link to="/transactions" style={{ color: 'var(--gold)' }}>Add one →</Link></p>
          ) : data.transactions.map(t => (
            <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              <div style={{ width: 36, height: 36, background: 'var(--gold-dim)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', flexShrink: 0 }}>
                {CATEGORY_ICONS[t.category]}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.description}</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: 2 }}>{formatDateShort(t.date)}</div>
              </div>
              <div className={t.type === 'income' ? 'amount-income' : 'amount-expense'} style={{ fontSize: '0.95rem', whiteSpace: 'nowrap' }}>
                {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
