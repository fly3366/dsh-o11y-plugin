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
    ...over,
  }
}

test('o11y: toLogRecordInput maps severity/kind/attributes with defaults', () => {
  assert.deepEqual(toLogRecordInput({ kind: 'turn', severity: 'warn', attributes: { a: 1 } }), {
    severityNumber: SeverityNumber.WARN,
    severityText: 'warn',
    body: 'dsh turn',
    attributes: { a: 1 },
  })
  assert.deepEqual(toLogRecordInput({}), {
    severityNumber: SeverityNumber.INFO,
    severityText: 'info',
    body: 'dsh record',
    attributes: {},
  })
})

test('o11y: apply wires the session-telemetry bridge and emits mapped log records', () => {
  // Spy logger via a fake global provider: disable() first so set-once semantics
  // can't leave a provider from another test in place.
  const emitted: unknown[] = []
  const fakeProvider = { getLogger: () => ({ emit: (rec: unknown) => { emitted.push(rec) } }) }
  logs.disable()
  logs.setGlobalLoggerProvider(fakeProvider as unknown as LoggerProvider)

  let listener: ((record: unknown, next: () => unknown) => unknown) | undefined
  const ctx = {
    on: (event: string, handler: (record: unknown, next: () => unknown) => unknown) => {
      if (event === 'session-telemetry/record') listener = handler
      return () => {}
    },
    provide: () => {},
    effect: () => {},
  } as unknown as Context

  apply(ctx, cfg())
  assert.ok(listener, 'bridge listener registered on session-telemetry/record')

  let nextCalled = false
  const record = { kind: 'turn', severity: 'warn', attributes: { sessionId: 's1' } }
  listener!(record, () => {
    nextCalled = true
    return undefined
  })

  assert.equal(nextCalled, true, 'next() is invoked so the middleware chain continues')
  assert.equal(emitted.length, 1, 'one log record emitted')
  assert.deepEqual(emitted[0], toLogRecordInput(record), 'emits the mapped record')
})

test('o11y: bridge is best-effort — a throwing emit still calls next()', () => {
  const fakeProvider = { getLogger: () => ({ emit: () => { throw new Error('boom') } }) }
  logs.disable()
  logs.setGlobalLoggerProvider(fakeProvider as unknown as LoggerProvider)

  let listener: ((record: unknown, next: () => unknown) => unknown) | undefined
  const ctx = {
    on: (event: string, handler: (record: unknown, next: () => unknown) => unknown) => {
      if (event === 'session-telemetry/record') listener = handler
      return () => {}
    },
    provide: () => {},
    effect: () => {},
  } as unknown as Context

  apply(ctx, cfg())
  let nextCalled = false
  listener!({ kind: 'x' }, () => {
    nextCalled = true
    return undefined
  })
  assert.equal(nextCalled, true, 'a throwing emit is swallowed and next() still runs')
})
