import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildStatusPayload, registerStatusRoutes, STATUS_PATH } from '../src/status-routes.ts'
import type { O11yConfig } from '../src/config.ts'

function cfg(over: Partial<O11yConfig> = {}): O11yConfig {
  return {
    enabled: true,
    serviceName: 'svc',
    endpoint: 'http://localhost:4318',
    enableTraces: true,
    enableMetrics: false,
    enableLogs: true,
    metricExportIntervalMs: 60_000,
    bridgeSessionTelemetry: true,
    serviceNamespace: 'acme',
    resourceAttributes: {},
    sourceAttribution: true,
    coreScopePrefixes: ['dsh', '@deepseek-ai'],
    ...over,
  }
}

interface Route { path: string; methods: string[]; fetch: (r: Request) => Promise<Response> }
function makeCtx(routes: Route[]) {
  return { connection: { fetch: { register: (r: Route) => { routes.push(r); return async () => {} } } } }
}

test('o11y status-routes: buildStatusPayload reflects config signals/namespace/bridge', () => {
  const p = buildStatusPayload(cfg(), 'svc', 'http://localhost:4318', true)
  assert.equal(p.active, true)
  assert.equal(p.serviceName, 'svc')
  assert.equal(p.endpoint, 'http://localhost:4318')
  assert.equal(p.serviceNamespace, 'acme')
  assert.equal(p.sourceAttribution, true)
  assert.equal(p.bridgeSessionTelemetry, true)
  assert.deepEqual(p.signals, { traces: true, metrics: false, logs: true })
  assert.deepEqual(p.coreScopePrefixes, ['dsh', '@deepseek-ai'])
})

test('o11y status-routes: registers GET and serves the JSON payload', async () => {
  const routes: Route[] = []
  registerStatusRoutes(makeCtx(routes) as never, buildStatusPayload(cfg(), 'svc', 'http://x', true))
  assert.equal(routes.length, 1)
  assert.equal(routes[0]!.path, STATUS_PATH)
  assert.deepEqual(routes[0]!.methods, ['GET'])
  const res = await routes[0]!.fetch(new Request('http://x/api/o11y/status'))
  assert.equal(res.status, 200)
  const body = await res.json() as { serviceNamespace: string; signals: { metrics: boolean } }
  assert.equal(body.serviceNamespace, 'acme')
  assert.equal(body.signals.metrics, false)
})

test('o11y status-routes: no-op when connection absent (headless)', () => {
  const routes: Route[] = []
  assert.doesNotThrow(() => registerStatusRoutes({} as never, buildStatusPayload(cfg(), 's', 'e', true)))
  assert.equal(routes.length, 0)
})