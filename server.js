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
app.post('/api/households/join', (req, res) => { req.query.action = 'join'; require('./api/households')(req, res) })
app.all('/api/households', require('./api/households'))

// Transactions
app.all('/api/transactions/:id', (req, res) => { req.query.id = req.params.id; require('./api/transactions')(req, res) })
app.all('/api/transactions', require('./api/transactions'))

// Budgets
app.all('/api/budgets', require('./api/budgets'))

// Bills
app.post('/api/bills/pay', (req, res) => { req.query.action = 'pay'; require('./api/bills')(req, res) })
app.all('/api/bills/:id', (req, res) => { req.query.id = req.params.id; require('./api/bills')(req, res) })
app.all('/api/bills', require('./api/bills'))

// Savings
app.post('/api/savings/contribute', (req, res) => { req.query.action = 'contribute'; require('./api/savings')(req, res) })
app.all('/api/savings/:id', (req, res) => { req.query.id = req.params.id; require('./api/savings')(req, res) })
app.all('/api/savings', require('./api/savings'))

// Reports
app.get('/api/reports', require('./api/reports'))

// AI
app.all('/api/ai/:action', (req, res) => { req.query.action = req.params.action; require('./api/ai/[action]')(req, res) })

// Users
app.all('/api/users', require('./api/users'))

const PORT = process.env.API_PORT || 3001
app.listen(PORT, () => console.log(`API server running on http://localhost:${PORT}`))
