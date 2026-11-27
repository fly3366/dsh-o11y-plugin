/* global window, fetch, AbortController */
// dsh-o11y browser half: a read-only deployment/status panel on the plugin
// detail page. Hand-written lazy-CJS factory (dsh third-party client-plugin
// format); React comes from the browser module table, so there is no bundler.
// Data arrives via a document-relative fetch to the Host's exact Connection
// Fetch route (api/o11y/status) — no leading slash, no hardcoded origin.
window.__ModuleLoader__.load({
  id: 'dsh-o11y-plugin',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const { useState, useEffect } = React

    const PACKAGE = 'dsh-o11y-plugin'
    const STATUS_ROUTE = 'api/o11y/status'

    const en = {
      title: 'Observability status',
      refresh: 'Refresh',
      loading: 'Loading…',
      inactive: 'o11y is not active.',
      error: 'Failed to load status.',
      traces: 'Traces',
      metrics: 'Metrics',
      logs: 'Logs',
      on: 'on',
      off: 'off',
      none: '(none)',
      endpoint: 'OTLP endpoint',
      serviceName: 'Service name',
      namespace: 'Namespace',
      sourceAttribution: 'Source attribution',
      bridge: 'Session bridge',
      corePrefixes: 'Core scope prefixes',
    }
    const zh = {
      title: '可观测状态',
      refresh: '刷新',
      loading: '加载中…',
      inactive: 'o11y 未启用。',
      error: '状态加载失败。',
      traces: 'Trace',
      metrics: 'Metric',
      logs: 'Log',
      on: '开',
      off: '关',
      none: '（无）',
      endpoint: 'OTLP endpoint',
      serviceName: '服务名',
      namespace: '命名空间',
      sourceAttribution: '来源归因',
      bridge: '会话桥接',
      corePrefixes: '本体 scope 前缀',
    }

    // Theme tokens only (--dsw-alias-*); no literal colors.
    const css = [
      '.o11y-panel{display:flex;flex-direction:column;gap:12px;padding:16px 0;color:var(--dsw-alias-label-primary);font-size:13px}',
      '.o11y-head{display:flex;align-items:center;justify-content:space-between;gap:8px}',
      '.o11y-title{font-size:14px;font-weight:600;color:var(--dsw-alias-label-primary)}',
      '.o11y-signals{display:flex;flex-wrap:wrap;gap:8px}',
      '.o11y-badge{display:inline-block;padding:1px 8px;border-radius:4px;font-size:11px}',
      '.o11y-on{color:var(--dsw-alias-state-business-primary);background:var(--dsw-alias-interactive-bg-active)}',
      '.o11y-off{color:var(--dsw-alias-label-tertiary);background:var(--dsw-alias-interactive-bg-hover)}',
      '.o11y-kvs{display:flex;flex-direction:column;gap:6px}',
      '.o11y-kv{display:flex;gap:8px;font-size:12px}',
      '.o11y-k{flex:0 0 140px;color:var(--dsw-alias-label-tertiary)}',
      '.o11y-v{color:var(--dsw-alias-label-secondary);word-break:break-all}',
      '.o11y-btn{padding:3px 10px;border-radius:6px;border:1px solid var(--dsw-alias-border-l3);background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary);font-size:12px;cursor:pointer}',
      '.o11y-btn:hover{background:var(--dsw-alias-interactive-bg-active)}',
      '.o11y-btn:disabled{opacity:.5;cursor:default}',
      '.o11y-muted{color:var(--dsw-alias-label-tertiary)}',
      '.o11y-error{color:var(--dsw-alias-state-error-primary)}',
    ].join('\n')

    function sig(label, on, t) {
      return h('span', { className: 'o11y-badge ' + (on ? 'o11y-on' : 'o11y-off') }, label + ': ' + (on ? t('on') : t('off')))
    }
    function kv(label, value) {
      return h('div', { className: 'o11y-kv' }, h('span', { className: 'o11y-k' }, label), h('span', { className: 'o11y-v' }, value))
    }

    function StatusPanel(props) {
      const subject = props.subject
      const t = typeof props.t === 'function' ? props.t : (k) => en[k] || k
      const isO11y = !!subject && subject.kind === 'bundle' && !!subject.pkg && subject.pkg.name === PACKAGE
      // Hooks run unconditionally (consistent order); the null render is below.
      const [state, setState] = useState({ phase: 'loading' })
      const [reloadKey, setReloadKey] = useState(0)

      useEffect(() => {
        if (!isO11y) return undefined
        const ac = new AbortController()
        let alive = true
        setState({ phase: 'loading' })
        fetch(STATUS_ROUTE, { signal: ac.signal })
          .then((res) => {
            if (res.status === 404) {
              if (alive) setState({ phase: 'inactive' })
              return null
            }
            if (!res.ok) throw new Error('http-' + res.status)
            return res.json()
          })
          .then((data) => {
            if (alive && data) setState({ phase: 'ready', data: data })
          })
          .catch((err) => {
            if (alive && err && err.name !== 'AbortError') setState({ phase: 'error' })
          })
        return () => {
          alive = false
          ac.abort()
        }
      }, [isO11y, reloadKey])

      if (!isO11y) return null

      const refresh = () => setReloadKey((k) => k + 1)
      const out = []
      out.push(h('style', { key: 'css' }, css))
      out.push(h('div', { className: 'o11y-head', key: 'head' },
        h('span', { className: 'o11y-title' }, t('title')),
        h('button', { className: 'o11y-btn', type: 'button', onClick: refresh, disabled: state.phase === 'loading' }, t('refresh')),
      ))

      if (state.phase === 'loading') {
        out.push(h('div', { className: 'o11y-muted', key: 'msg' }, t('loading')))
      } else if (state.phase === 'inactive') {
        out.push(h('div', { className: 'o11y-muted', key: 'msg' }, t('inactive')))
      } else if (state.phase === 'error') {
        out.push(h('div', { className: 'o11y-error', key: 'msg' }, t('error')))
      } else {
        const d = state.data
        const s = d.signals || {}
        out.push(h('div', { className: 'o11y-signals', key: 'sig' },
          sig(t('traces'), !!s.traces, t),
          sig(t('metrics'), !!s.metrics, t),
          sig(t('logs'), !!s.logs, t),
        ))
        out.push(h('div', { className: 'o11y-kvs', key: 'kvs' },
          kv(t('endpoint'), d.endpoint || t('none')),
          kv(t('serviceName'), d.serviceName || t('none')),
          kv(t('namespace'), d.serviceNamespace || t('none')),
          kv(t('sourceAttribution'), d.sourceAttribution ? t('on') : t('off')),
          kv(t('bridge'), d.bridgeSessionTelemetry ? t('on') : t('off')),
          kv(t('corePrefixes'), (d.coreScopePrefixes || []).join(', ') || t('none')),
        ))
      }
      return h('div', { className: 'o11y-panel' }, out)
    }

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register('o11y', { en: en, zh: zh }), 'o11y: dictionaries')
        ctx.effect(() => ctx.slots.inject('plugins.detail.section', () => ctx.slots.register({
          name: 'plugins.detail.section', id: 'o11y-status', order: 10, locale: 'o11y',
        }, StatusPanel)), 'o11y: status panel')
      },
    }
  },
})