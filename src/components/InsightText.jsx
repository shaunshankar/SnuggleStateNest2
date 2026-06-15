// Renders plain-text AI insights: supports blank-line paragraphs,
// "-"/"*"/"•" bullet lines, and **bold** spans. No markdown dependency.

function renderInline(text, keyBase) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((p, i) => {
    if (p.startsWith('**') && p.endsWith('**')) {
      return <strong key={`${keyBase}-${i}`} style={{ color: 'var(--text-primary)' }}>{p.slice(2, -2)}</strong>
    }
    return p
  })
}

export default function InsightText({ text }) {
  if (!text) return null
  const lines = text.split('\n')
  const blocks = []
  let bullets = []

  const flush = (key) => {
    if (bullets.length) {
      blocks.push(
        <ul key={`ul-${key}`} style={{ margin: '6px 0', paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {bullets.map((b, i) => <li key={i} style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{renderInline(b, `b-${key}-${i}`)}</li>)}
        </ul>
      )
      bullets = []
    }
  }

  lines.forEach((raw, idx) => {
    const line = raw.trim()
    if (!line) { flush(idx); return }
    const bullet = line.match(/^(?:[-*•]|\d+\.)\s+(.*)$/)
    if (bullet) { bullets.push(bullet[1]); return }
    flush(idx)
    blocks.push(
      <p key={`p-${idx}`} style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.6, margin: '6px 0' }}>
        {renderInline(line, `p-${idx}`)}
      </p>
    )
  })
  flush('end')

  return <div>{blocks}</div>
}
