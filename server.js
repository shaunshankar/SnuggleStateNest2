const express = require('express')
const cors = require('cors')
require('dotenv').config()

const app = express()
app.use(cors())
app.use(express.json({ limit: '10mb' }))

const auth    = require('./api/auth/[action]')
const txns    = require('./api/transactions/[[...slug]]')
const budgets = require('./api/budgets/index')
const bills   = require('./api/bills/[[...slug]]')
const savings = require('./api/savings/[[...slug]]')
const hh      = require('./api/households/[[...slug]]')
const reports = require('./api/reports/index')
const ai      = require('./api/ai/[action]')
const users   = require('./api/users/index')

// Auth
app.all('/api/auth/:action', (req, res) => { req.query.action = req.params.action; auth(req, res) })

// Transactions
app.all('/api/transactions/:id', (req, res) => { req.query.slug = [req.params.id]; txns(req, res) })
app.all('/api/transactions', (req, res) => { req.query.slug = undefined; txns(req, res) })

// Budgets
app.all('/api/budgets', budgets)

// Bills
app.all('/api/bills/pay', (req, res) => { req.query.slug = ['pay']; bills(req, res) })
app.all('/api/bills/:id', (req, res) => { req.query.slug = [req.params.id]; bills(req, res) })
app.all('/api/bills', (req, res) => { req.query.slug = undefined; bills(req, res) })

// Savings
app.all('/api/savings/contribute', (req, res) => { req.query.slug = ['contribute']; savings(req, res) })
app.all('/api/savings/:id', (req, res) => { req.query.slug = [req.params.id]; savings(req, res) })
app.all('/api/savings', (req, res) => { req.query.slug = undefined; savings(req, res) })

// Households
app.all('/api/households/join', (req, res) => { req.query.slug = ['join']; hh(req, res) })
app.all('/api/households', (req, res) => { req.query.slug = undefined; hh(req, res) })

// Reports
app.get('/api/reports', reports)

// AI
app.all('/api/ai/:action', (req, res) => { req.query.action = req.params.action; ai(req, res) })

// Users / Settings
app.all('/api/users', users)

const PORT = process.env.API_PORT || 3001
app.listen(PORT, () => console.log(`API server running on http://localhost:${PORT}`))
