import { useState, useEffect } from 'react'
import { BarChart3 } from 'lucide-react'
import { api } from '../utils/api'
import { formatCurrency } from '../utils/formatters'
import { CATEGORY_COLOURS, CATEGORY_ICONS } from '../utils/categories'

function BarChart({ data, valueKey, labelKey, colour = 'var(--gold)' }) {
  const max = Math.max(...data.map(d => d[valueKey]), 1)
  return (
    <div className="bar-chart">
      {data.map((d, i) => (
        <div key={i} className="bar-group">
          <div
            className="bar"
            style={{ height: `${Math.max((d[valueKey] / max) * 100, 2)}%`, background: colour, minHeight: 2 }}
            title={formatCurrency(d[valueKey])}
          />
          <span className="bar-label">{d[labelKey]}</span>
        </div>
      ))}
    </div>
  )
}

export default function Reports() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/reports')
      .then(d => setData(d))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div>
      <div className="page-header"><h2>Reports</h2></div>
      {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 200, borderRadius: 12, marginBottom: 16 }} />)}
    </div>
  )

  if (!data) return <div className="empty-state"><h3>Could not load reports</h3></div>

  const expenses = data.categoryBreakdown.filter(r => r.type === 'expense')
  const topExpenses = [...expenses].sort((a, b) => b.total - a.total).slice(0, 6)

  const monthlyMap = {}
  data.monthlyTrends.forEach(r => {
    if (!monthlyMap[r.month]) monthlyMap[r.month] = { income: 0, expenses: 0 }
    monthlyMap[r.month][r.type === 'income' ? 'income' : 'expenses'] = parseFloat(r.total)
  })
  const monthlyArr = Object.entries(monthlyMap).map(([month, v]) => ({ month: month.slice(0, 7), ...v }))

  return (
    <div>
      <div className="page-header">
        <h2>Reports</h2>
        <p>Last 3 months of household finances</p>
      </div>

      {/* Summary row */}
      <div className="stat-grid" style={{ marginBottom: 28 }}>
        <div className="stat-card">
          <div className="stat-label">This month income</div>
          <div className="stat-value positive">{formatCurrency(data.currentMonth.income)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">This month expenses</div>
          <div className="stat-value negative">{formatCurrency(data.currentMonth.expenses)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Net this month</div>
          <div className={`stat-value ${data.currentMonth.net >= 0 ? 'positive' : 'negative'}`}>{formatCurrency(data.currentMonth.net)}</div>
        </div>
        <div className="stat-card card-gold">
          <div className="stat-label">Savings rate</div>
          <div className="stat-value gold">{data.savingsRate}%</div>
          <div className="stat-sub">of income saved</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

        {/* Monthly income vs expenses */}
        <div className="card" style={{ gridColumn: '1 / -1' }}>
          <h3 style={{ fontSize: '1rem', marginBottom: 20 }}>Income vs Expenses (Last 3 Months)</h3>
          {monthlyArr.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>No data yet</p>
          ) : (
            <div style={{ display: 'flex', gap: 24, height: 180, alignItems: 'flex-end' }}>
              {monthlyArr.map((m, i) => {
                const maxVal = Math.max(...monthlyArr.flatMap(x => [x.income, x.expenses]), 1)
                return (
                  <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', gap: 6 }}>
                      <div style={{ flex: 1, background: 'rgba(34,197,94,0.4)', borderRadius: '4px 4px 0 0', height: `${(m.income / maxVal) * 100}%`, minHeight: 2, transition: 'height 0.6s' }} title={`Income: ${formatCurrency(m.income)}`} />
                      <div style={{ flex: 1, background: 'rgba(239,68,68,0.4)', borderRadius: '4px 4px 0 0', height: `${(m.expenses / maxVal) * 100}%`, minHeight: 2, transition: 'height 0.6s' }} title={`Expenses: ${formatCurrency(m.expenses)}`} />
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textAlign: 'center' }}>{m.month}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                      <span style={{ color: 'var(--success)' }}>+{formatCurrency(m.income).replace('$', '')}</span> / <span style={{ color: 'var(--danger)' }}>-{formatCurrency(m.expenses).replace('$', '')}</span>
                    </div>
                  </div>
                )
              })}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: '0.72rem', color: 'var(--text-secondary)', alignSelf: 'flex-end', paddingBottom: 32 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 10, height: 10, background: 'rgba(34,197,94,0.6)', borderRadius: 2, display: 'inline-block' }} /> Income</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 10, height: 10, background: 'rgba(239,68,68,0.5)', borderRadius: 2, display: 'inline-block' }} /> Expenses</span>
              </div>
            </div>
          )}
        </div>

        {/* Top spending categories */}
        <div className="card">
          <h3 style={{ fontSize: '1rem', marginBottom: 20 }}>Top Spending Categories</h3>
          {topExpenses.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>No expense data yet</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {topExpenses.map((e, i) => {
                const maxTotal = topExpenses[0]?.total || 1
                return (
                  <div key={i}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: 4 }}>
                      <span>{CATEGORY_ICONS[e.category]} {e.category.replace('_', ' ')}</span>
                      <span style={{ fontFamily: 'Playfair Display', color: 'var(--gold-light)' }}>{formatCurrency(e.total)}</span>
                    </div>
                    <div className="progress-bar-wrap" style={{ height: 6 }}>
                      <div className="progress-bar-fill ok" style={{ width: `${(e.total / maxTotal) * 100}%`, background: CATEGORY_COLOURS[e.category] || 'var(--gold)' }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Monthly breakdown bar chart */}
        <div className="card">
          <h3 style={{ fontSize: '1rem', marginBottom: 20 }}>Expense Breakdown</h3>
          {topExpenses.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>No data yet</p>
          ) : (
            <div className="chart-wrap">
              <div className="bar-chart" style={{ height: 140 }}>
                {topExpenses.slice(0, 8).map((e, i) => {
                  const max = topExpenses[0]?.total || 1
                  return (
                    <div key={i} className="bar-group">
                      <div className="bar" style={{ height: `${(e.total / max) * 100}%`, background: CATEGORY_COLOURS[e.category] || 'var(--gold)', minHeight: 4 }} title={formatCurrency(e.total)} />
                      <span className="bar-label">{CATEGORY_ICONS[e.category]}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
