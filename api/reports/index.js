const { getPool } = require('../_db')
const { requireAuth } = require('../_auth')
const { handleCors } = require('../_cors')

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return
  if (req.method !== 'GET') return res.status(405).end()

  const auth = requireAuth(req, res)
  if (!auth) return
  if (!auth.householdId) return res.status(403).json({ message: 'No household' })

  const pool = getPool()
  try {
    const now = new Date()
    const months = []
    for (let i = 2; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      months.push({
        label: d.toLocaleString('en-AU', { month: 'short', year: 'numeric' }),
        start: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`,
        end: new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0]
      })
    }

    const [categoryRes, monthlyRes, savingsRateRes] = await Promise.all([
      pool.query(
        `SELECT category, type, SUM(amount) AS total
         FROM nest.transactions
         WHERE household_id=$1 AND date >= $2
         GROUP BY category, type ORDER BY total DESC`,
        [auth.householdId, months[0].start]
      ),
      pool.query(
        `SELECT
           TO_CHAR(date, 'YYYY-MM') AS month,
           type,
           SUM(amount) AS total
         FROM nest.transactions
         WHERE household_id=$1 AND date >= $2
         GROUP BY month, type ORDER BY month`,
        [auth.householdId, months[0].start]
      ),
      pool.query(
        `SELECT
           SUM(CASE WHEN type='income' THEN amount ELSE 0 END) AS income,
           SUM(CASE WHEN type='expense' THEN amount ELSE 0 END) AS expenses
         FROM nest.transactions
         WHERE household_id=$1 AND date >= $2`,
        [auth.householdId, `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`]
      )
    ])

    const income = parseFloat(savingsRateRes.rows[0]?.income || 0)
    const expenses = parseFloat(savingsRateRes.rows[0]?.expenses || 0)
    const savingsRate = income > 0 ? ((income - expenses) / income * 100).toFixed(1) : 0

    res.json({
      categoryBreakdown: categoryRes.rows,
      monthlyTrends: monthlyRes.rows,
      months: months.map(m => m.label),
      savingsRate: parseFloat(savingsRate),
      currentMonth: { income, expenses, net: income - expenses }
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Server error' })
  }
}
