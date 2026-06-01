const { Pool } = require('pg')
require('dotenv').config()

let pool

function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 5,
      idleTimeoutMillis: 30000
    })
  }
  return pool
}

module.exports = { getPool }
