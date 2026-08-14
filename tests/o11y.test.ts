import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Context } from '@deepseek-ai/cordis'
import { apply, type O11yHandle } from '../src/index.ts'
import type { O11yConfig } from '../src/config.ts'

function defaults(): O11yConfig {
  return {
    enabled: true,
    serviceName: 'dsh-plugin',
    endpoint: '',
    enableTraces: true,
    enableMetrics: true,
    enableLogs: true,
    metricExportIntervalMs: 60_000,
    bridgeSessionTelemetry: true,
  }
}

test('o11y: registers global providers and provides the o11y service', () => {
  const ctx = new Context()
  apply(ctx, defaults())
  const handle = (ctx as unknown as { get: (k: string) => O11yHandle }).get('o11y')
  assert.equal(handle.active, true)
  assert.equal(handle.serviceName, 'dsh-plugin')
})

test('o11y: disabled config provides no service', () => {
  const ctx = new Context()
  apply(ctx, { ...defaults(), enabled: false })
  const handle = (ctx as unknown as { get: (k: string) => O11yHandle | undefined }).get('o11y')
  assert.equal(handle, undefined)
})
