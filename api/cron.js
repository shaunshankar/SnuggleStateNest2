const { getPool } = require('./_db')
const { handleCors } = require('./_cors')
require('dotenv').config()

module.exports = async function handler(req, res) {
  if (handleCors(req, res)) return
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).end()

  const pool = getPool()
  try {
    const now = new Date()
    const targetDay = now.getDate() + 3
    const { rows: bills } = await pool.query(
      `SELECT b.*, h.name AS household_name FROM nest.bills b
       JOIN nest.households h ON h.id=b.household_id
       WHERE b.due_day=$1 AND b.is_paid=false`,
      [targetDay > 28 ? targetDay - 28 : targetDay]
    )
    if (!bills.length) return res.json({ sent: 0 })

    const { Resend } = require('resend')
    const resend = new Resend(process.env.RESEND_API_KEY)
    let sent = 0
    for (const bill of bills) {
      const { rows: members } = await pool.query(
        'SELECT email, name FROM nest.users WHERE household_id=$1 AND email_notifications=true',
        [bill.household_id]
      )
      for (const member of members) {
        await resend.emails.send({
          from: 'onboarding@resend.dev',
          to: member.email,
          subject: `Reminder: ${bill.name} due in 3 days`,
          html: `<div style="font-family:Inter,sans-serif;max-width:500px;margin:0 auto;background:#0f1628;color:#fff;padding:32px;border-radius:12px;"><h2 style="color:#c9a84c;font-family:'Playfair Display',serif;">Bill Reminder</h2><p>Hi ${member.name},</p><p><strong>${bill.name}</strong> is due in 3 days.</p><div style="background:#1a2340;border:1px solid rgba(201,168,76,0.3);border-radius:8px;padding:16px;margin:16px 0;"><p style="margin:0;font-size:24px;color:#c9a84c;font-family:'Playfair Display',serif;">$${parseFloat(bill.amount).toFixed(2)}</p><p style="margin:4px 0 0;color:#8a9ab5;font-size:14px;">${bill.category} · due on the ${bill.due_day}th</p></div><p style="color:#8a9ab5;font-size:14px;">— SnuggleState Nest</p></div>`
        })
        sent++
      }
    }
    res.json({ sent })
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }) }
}
