import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { Context } from '@deepseek-ai/cordis'
import { logs, SeverityNumber, type LoggerProvider } from '@opentelemetry/api-logs'
import { apply, toLogRecordInput } from '../src/index.ts'
import type { O11yConfig } from '../src/config.ts'

function cfg(over: Partial<O11yConfig> = {}): O11yConfig {
  return {
    enabled: true,
    serviceName: 's',
    endpoint: '',
    enableTraces: false,
    enableMetrics: false,
    enableLogs: false,
    metricExportIntervalMs: 60_000,
    bridgeSessionTelemetry: true,
    serviceNamespace: '',
    resourceAttributes: {},
    sourceAttribution: true,
    coreScopePrefixes: ['dsh', '@deepseek-ai'],
    ...over,
  }
}

function spyLogger() {
  const emitted: unknown[] = []
  const fakeProvider = { getLogger: () => ({ emit: (rec: unknown) => { emitted.push(rec) } }) }
  logs.disable()
  logs.setGlobalLoggerProvider(fakeProvider as unknown as LoggerProvider)
  return emitted
}

function bridgeCtx() {
  let listener: ((record: unknown, next: () => unknown) => unknown) | undefined
  const ctx = {
    on: (event: string, handler: (record: unknown, next: () => unknown) => unknown) => {
      if (event === 'session-telemetry/record') listener = handler
      return () => {}
    },
    provide: () => {},
    effect: () => {},
  } as unknown as Context
  return { ctx, getListener: () => listener }
}

test('o11y: toLogRecordInput maps the official redacted record shape', () => {
  const record = {
    channel: 'ledger' as const,
    severity: 'warn' as const,
    attributes: { a: 1, nested: { x: 1 } },
    sourceEvent: { sessionId: 's1', envelope: { type: 'turn/end' } },
    body: { text: 'redacted payload' },
  }
  const out = toLogRecordInput(record)
  assert.equal(out.severityNumber, SeverityNumber.WARN)
  assert.equal(out.severityText, 'warn')
  assert.equal(out.body, JSON.stringify({ text: 'redacted payload' }))
  assert.equal(out.attributes.a, 1)
  assert.equal(out.attributes['dsh.channel'], 'ledger')
  assert.equal(out.attributes['session.id'], 's1')
  assert.equal(out.attributes['event.type'], 'turn/end')
  assert.equal('nested' in out.attributes, false, 'non-scalar attributes dropped')
})

test('o11y: toLogRecordInput defaults for an empty record', () => {
  const out = toLogRecordInput({})
  assert.equal(out.severityNumber, SeverityNumber.INFO)
  assert.equal(out.severityText, 'info')
  assert.equal(out.body, 'dsh session record')
  assert.deepEqual(out.attributes, {})
})

test('o11y: bridge emits the POST-redaction record (next result), not the incoming one', () => {
  const emitted = spyLogger()
  const { ctx, getListener } = bridgeCtx()
  apply(ctx, cfg())
  const listener = getListener()
  assert.ok(listener, 'bridge listener registered on session-telemetry/record')

  const incoming = { channel: 'ledger', severity: 'info', body: { secret: 'RAW' }, attributes: {} }
  const redacted = { channel: 'ledger', severity: 'info', body: { secret: '[REDACTED]' }, attributes: {} }
  const returned = listener!(incoming, () => redacted)

  assert.equal(returned, redacted, 'waterfall chain continues with the redacted record')
  assert.equal(emitted.length, 1)
  assert.deepEqual(emitted[0], toLogRecordInput(redacted), 'emits the redacted record, not the raw incoming one')
  assert.equal(JSON.stringify(emitted[0]).includes('RAW'), false, 'pre-redaction payload never exported')
})

test('o11y: bridge is best-effort — a throwing emit still returns next() result', () => {
  const fakeProvider = { getLogger: () => ({ emit: () => { throw new Error('boom') } }) }
  logs.disable()
  logs.setGlobalLoggerProvider(fakeProvider as unknown as LoggerProvider)
  const { ctx, getListener } = bridgeCtx()
  apply(ctx, cfg())
  const redacted = { channel: 'ops', severity: 'error', body: 'x' }
  const returned = getListener()!({ body: 'raw' }, () => redacted)
  assert.equal(returned, redacted, 'a throwing emit is swallowed and the redacted record still propagates')
})