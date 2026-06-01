export default function ProgressBar({ value, max, height = 8 }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0
  const cls = pct >= 100 ? 'danger' : pct >= 75 ? 'warning' : 'ok'
  return (
    <div className="progress-bar-wrap" style={{ height }}>
      <div className={`progress-bar-fill ${cls}`} style={{ width: `${pct}%`, height }} />
    </div>
  )
}
