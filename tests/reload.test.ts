import { test } from 'node:test'
import assert from 'node:assert/strict'
import { metrics, trace, type MeterProvider } from '@opentelemetry/api'
import { logs } from '@opentelemetry/api-logs'
import { teardownO11y } from '../src/index.ts'

// OTel global providers are process-wide and set-once. node:test runs this file
// in its own process, but globals persist across cases within it, so reset
// before each test to keep them order-independent. disable() is idempotent.
function resetGlobals(): void {
  trace.disable()
  metrics.disable()
  logs.disable()
}

test('o11y: teardown clears the global meter provider so an in-process reload can re-register', () => {
  resetGlobals()
  const fake1 = {} as unknown as MeterProvider
  const fake2 = {} as unknown as MeterProvider

  assert.equal(metrics.setGlobalMeterProvider(fake1), true, 'first registration succeeds')
  assert.equal(metrics.getMeterProvider(), fake1)

  // The bug being fixed: globals are set-once, so a reload's re-register no-ops
  // and telemetry stays bound to the provider from the first load.
  assert.equal(metrics.setGlobalMeterProvider(fake2), false, 'set-once blocks re-register before teardown')
  assert.equal(metrics.getMeterProvider(), fake1)

  teardownO11y([], { enableTraces: false, enableMetrics: true, enableLogs: false })
  assert.notEqual(metrics.getMeterProvider(), fake1, 'teardown clears the global meter provider')

  // After teardown the reload path registers a fresh provider again.
  assert.equal(metrics.setGlobalMeterProvider(fake2), true, 'reload re-registers after teardown')
  assert.equal(metrics.getMeterProvider(), fake2)
})

test('o11y: teardown scopes global clearing to enabled signals and always shuts down providers', () => {
  resetGlobals()
  const fake = {} as unknown as MeterProvider
  assert.equal(metrics.setGlobalMeterProvider(fake), true)

  let shutdowns = 0
  const provider = { shutdown: async () => { shutdowns += 1 } }

  // enableMetrics=false: the meter global must survive, but providers still shut down.
  teardownO11y([provider], { enableTraces: false, enableMetrics: false, enableLogs: false })
  assert.equal(shutdowns, 1, 'registered providers are shut down regardless of flags')
  assert.equal(metrics.getMeterProvider(), fake, 'meter global untouched when enableMetrics=false')

  // enableMetrics=true: the meter global is cleared.
  teardownO11y([], { enableTraces: false, enableMetrics: true, enableLogs: false })
  assert.notEqual(metrics.getMeterProvider(), fake, 'enableMetrics=true clears the meter global')
})
