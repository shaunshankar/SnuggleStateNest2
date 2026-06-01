export function PageLoader() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0f1e' }}>
      <div style={{ textAlign: 'center' }}>
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none" style={{ margin: '0 auto 16px' }}>
          <circle cx="24" cy="24" r="20" stroke="rgba(201,168,76,0.2)" strokeWidth="4" />
          <path d="M24 4a20 20 0 0 1 20 20" stroke="#c9a84c" strokeWidth="4" strokeLinecap="round">
            <animateTransform attributeName="transform" type="rotate" from="0 24 24" to="360 24 24" dur="0.8s" repeatCount="indefinite" />
          </path>
        </svg>
        <p style={{ color: '#4a5a75', fontFamily: 'Inter', fontSize: '0.875rem' }}>Loading your Nest…</p>
      </div>
    </div>
  )
}

export function Spinner({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="rgba(201,168,76,0.2)" strokeWidth="3" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke="#c9a84c" strokeWidth="3" strokeLinecap="round">
        <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="0.7s" repeatCount="indefinite" />
      </path>
    </svg>
  )
}
