const express = require('express')
const cors = require('cors')
require('dotenv').config()

const app = express()
app.use(cors())
app.use(express.json({ limit: '10mb' }))

// Auth
app.post('/api/auth/signup', require('./api/auth/signup'))
app.post('/api/auth/login', require('./api/auth/login'))
app.get('/api/auth/me', require('./api/auth/me'))

// Households
app.all('/api/households/join', require('./api/households/join'))
app.all('/api/households', require('./api/households/index'))

// Transactions
app.all('/api/transactions', require('./api/transactions/index'))
app.all('/api/transactions/:id', (req, res) => {
  req.query.id = req.params.id
  require('./api/transactions/[id]')(req, res)
})

// Budgets
app.all('/api/budgets', require('./api/budgets/index'))

// Bills
app.all('/api/bills/pay', require('./api/bills/pay'))
app.all('/api/bills', require('./api/bills/index'))
app.all('/api/bills/:id', (req, res) => {
  req.query.id = req.params.id
  require('./api/bills/[id]')(req, res)
})

// Savings
app.all('/api/savings/contribute', require('./api/savings/contribute'))
app.all('/api/savings', require('./api/savings/index'))
app.all('/api/savings/:id', (req, res) => {
  req.query.id = req.params.id
  require('./api/savings/[id]')(req, res)
})

// Reports
app.get('/api/reports', require('./api/reports/index'))

// AI
app.post('/api/ai/categorise', require('./api/ai/categorise'))
app.post('/api/ai/import', require('./api/ai/import'))

// Users / Settings
app.all('/api/users', require('./api/users/index'))

const PORT = process.env.API_PORT || 3001
app.listen(PORT, () => console.log(`API server running on http://localhost:${PORT}`))
