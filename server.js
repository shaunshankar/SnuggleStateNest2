const express = require('express')
const cors = require('cors')
require('dotenv').config()

const app = express()
app.use(cors())
app.use(express.json({ limit: '10mb' }))

app.all('/api/auth/:action',  (req, res) => { req.query.action = req.params.action; require('./api/auth')(req, res) })
app.all('/api/ai/:action',    (req, res) => { req.query.action = req.params.action; require('./api/ai')(req, res) })

app.post('/api/households/join', (req, res) => { req.query.action = 'join'; require('./api/households')(req, res) })
app.all('/api/households', require('./api/households'))

app.all('/api/transactions/:id', (req, res) => { req.query.id = req.params.id; require('./api/transactions')(req, res) })
app.all('/api/transactions', require('./api/transactions'))

app.all('/api/budgets', require('./api/budgets'))

app.post('/api/bills/pay', (req, res) => { req.query.action = 'pay'; require('./api/bills')(req, res) })
app.all('/api/bills/:id', (req, res) => { req.query.id = req.params.id; require('./api/bills')(req, res) })
app.all('/api/bills', require('./api/bills'))

app.post('/api/savings/contribute', (req, res) => { req.query.action = 'contribute'; require('./api/savings')(req, res) })
app.all('/api/savings/:id', (req, res) => { req.query.id = req.params.id; require('./api/savings')(req, res) })
app.all('/api/savings', require('./api/savings'))

app.get('/api/reports', require('./api/reports'))

app.post('/api/loans/repay',    (req, res) => { req.query.action = 'repay';    require('./api/loans')(req, res) })
app.post('/api/loans/insights', (req, res) => { req.query.action = 'insights'; require('./api/loans')(req, res) })
app.all('/api/loans/:id',       (req, res) => { req.query.id = req.params.id;  require('./api/loans')(req, res) })
app.all('/api/loans',           require('./api/loans'))
app.all('/api/users',   require('./api/users'))
app.all('/api/cron',    require('./api/cron'))

const PORT = process.env.API_PORT || 3001
app.listen(PORT, () => console.log(`API server running on http://localhost:${PORT}`))
