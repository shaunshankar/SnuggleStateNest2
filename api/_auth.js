const jwt = require('jsonwebtoken')
require('dotenv').config()

function signToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' })
}

function verifyToken(req) {
  const auth = req.headers.authorization
  if (!auth || !auth.startsWith('Bearer ')) return null
  try {
    return jwt.verify(auth.slice(7), process.env.JWT_SECRET)
  } catch {
    return null
  }
}

function requireAuth(req, res) {
  const user = verifyToken(req)
  if (!user) {
    res.status(401).json({ message: 'Unauthorised' })
    return null
  }
  return user
}

module.exports = { signToken, verifyToken, requireAuth }
