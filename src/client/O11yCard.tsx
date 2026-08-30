import { useSyncExternalStore } from 'react'

interface O11ySettings {
  serviceName?: string
  endpoint?: string
  enableTraces?: boolean
  enableMetrics?: boolean
  enableLogs?: boolean
}

interface ScopeSnapshot {
  status: 'loading' | 'ready' | 'unavailable'
  value: unknown
}

interface SettingsScope {
  getSnapshot(): ScopeSnapshot
  subscribe(listener: () => void): () => void
  set(field: string, value: unknown): Promise<void>
}

/** Minimal o11y settings card bound to the `o11y` settings namespace. */
export function makeO11yCard(scope: SettingsScope) {
  return function O11yCard() {
    const snap = useSyncExternalStore(
      (cb) => scope.subscribe(cb),
      () => scope.getSnapshot(),
    )
    if (snap.status !== 'ready' || !snap.value) {
      return <section><h3>o11y</h3><p>o11y settings unavailable.</p></section>
    }
    const v = snap.value as O11ySettings
    const set = (field: string, value: unknown) => void scope.set(field, value)
    return (
      <section style={{ display: 'grid', gap: 8 }}>
        <h3>o11y</h3>
        <label>
          serviceName{' '}
          <input value={v.serviceName ?? ''} onChange={(e) => set('serviceName', e.target.value)} />
        </label>
        <label>
          endpoint{' '}
          <input value={v.endpoint ?? ''} onChange={(e) => set('endpoint', e.target.value)} />
        </label>
        <label><input type="checkbox" checked={!!v.enableTraces} onChange={(e) => set('enableTraces', (e.target as HTMLInputElement).checked)} /> traces</label>
        <label><input type="checkbox" checked={!!v.enableMetrics} onChange={(e) => set('enableMetrics', (e.target as HTMLInputElement).checked)} /> metrics</label>
        <label><input type="checkbox" checked={!!v.enableLogs} onChange={(e) => set('enableLogs', (e.target as HTMLInputElement).checked)} /> logs</label>
      </section>
    )
  }
}
