const express = require('express')
const cors = require('cors')
require('dotenv').config()

const app = express()
app.use(cors())
app.use(express.json({ limit: '10mb' }))

// Auth
app.all('/api/auth/:action', (req, res) => {
  req.query.action = req.params.action
  require('./api/auth/[action]')(req, res)
})

// Households
app.post('/api/households/join', require('./api/households/join'))
app.all('/api/households', require('./api/households/index'))

// Transactions
app.all('/api/transactions/:id', (req, res) => {
  req.query.id = req.params.id
  require('./api/transactions/[id]')(req, res)
})
app.all('/api/transactions', require('./api/transactions/index'))

// Budgets
app.all('/api/budgets', require('./api/budgets/index'))

// Bills
app.post('/api/bills/pay', require('./api/bills/pay'))
app.all('/api/bills/:id', (req, res) => {
  req.query.id = req.params.id
  require('./api/bills/[id]')(req, res)
})
app.all('/api/bills', require('./api/bills/index'))

// Savings
app.post('/api/savings/contribute', require('./api/savings/contribute'))
app.all('/api/savings/:id', (req, res) => {
  req.query.id = req.params.id
  require('./api/savings/[id]')(req, res)
})
app.all('/api/savings', require('./api/savings/index'))

// Reports
app.get('/api/reports', require('./api/reports/index'))

// AI
app.all('/api/ai/:action', (req, res) => {
  req.query.action = req.params.action
  require('./api/ai/[action]')(req, res)
})

// Users / Settings
app.all('/api/users', require('./api/users/index'))

const PORT = process.env.API_PORT || 3001
app.listen(PORT, () => console.log(`API server running on http://localhost:${PORT}`))
