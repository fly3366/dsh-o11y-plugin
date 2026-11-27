import type { Context } from '@deepseek-ai/cordis'
import { metrics, trace } from '@opentelemetry/api'
import { logs, SeverityNumber } from '@opentelemetry/api-logs'
import { buildResource, SourceSpanProcessor, SourceLogProcessor, namespaceView } from './namespace.ts'
import { NodeTracerProvider, BatchSpanProcessor } from '@opentelemetry/sdk-trace-node'
import { MeterProvider, PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics'
import { LoggerProvider, BatchLogRecordProcessor } from '@opentelemetry/sdk-logs'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http'
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http'
import type { O11yConfig } from './config.ts'
import { registerStatusRoutes, buildStatusPayload } from './status-routes.ts'

export { Config } from './config.ts'

export const name = 'dsh-o11y'
export const inject: string[] = []

/** Handle exposed as the `o11y` service so plugins can detect/inspect it. */
export interface O11yHandle {
  serviceName: string
  endpoint: string
  active: boolean
}

/** Which OTel signals apply() registered globally, used to scope teardown. */
export interface O11yTeardownFlags {
  enableTraces: boolean
  enableMetrics: boolean
  enableLogs: boolean
}

/**
 * Shut down providers and clear the OTel globals apply() set, so an in-process
 * reload can re-register them (globals are set-once per process).
 */
export function teardownO11y(
  providers: readonly { shutdown: () => Promise<void> }[],
  flags: O11yTeardownFlags,
): void {
  for (const p of providers) void p.shutdown()
  if (flags.enableTraces) trace.disable()
  if (flags.enableMetrics) metrics.disable()
  if (flags.enableLogs) logs.disable()
}

/** A dsh session-telemetry record (official capture shape) bridged into an OTel log. */
export interface SessionTelemetryRecord {
  sourceEvent?: { sessionId: string; envelope: { type?: string } }
  channel?: 'ledger' | 'ops'
  time?: number
  severity?: 'info' | 'warn' | 'error'
  attributes?: Record<string, unknown>
  body?: unknown
}

const SEVERITY_NUMBER: Record<string, SeverityNumber> = {
  info: SeverityNumber.INFO,
  warn: SeverityNumber.WARN,
  error: SeverityNumber.ERROR,
}

/**
 * Map a post-redaction dsh session-telemetry record to OTel log-record input.
 * Pure so the mapping is unit-testable without dispatching events. The body is
 * the redacted payload; identity attributes are added alongside the record's own.
 */
export function toLogRecordInput(record: SessionTelemetryRecord) {
  const attributes: Record<string, string | number | boolean> = {}
  for (const [key, value] of Object.entries(record.attributes ?? {})) {
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      attributes[key] = value
    }
  }
  if (record.channel) attributes['dsh.channel'] = record.channel
  if (record.sourceEvent?.sessionId) attributes['session.id'] = record.sourceEvent.sessionId
  if (record.sourceEvent?.envelope?.type) attributes['event.type'] = record.sourceEvent.envelope.type
  const body = typeof record.body === 'string'
    ? record.body
    : record.body === undefined ? '' : JSON.stringify(record.body)
  return {
    severityNumber: SEVERITY_NUMBER[record.severity ?? 'info'] ?? SeverityNumber.INFO,
    severityText: record.severity ?? 'info',
    body: body || 'dsh session record',
    attributes,
  }
}

export function apply(ctx: Context, config: O11yConfig) {
  if (!config.enabled) return

  const endpoint =
    config.endpoint || process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318'
  const serviceName = config.serviceName || process.env.OTEL_SERVICE_NAME || 'dsh-plugin'
  const resource = buildResource(serviceName, config.serviceNamespace, config.resourceAttributes)
  const nsOptions = { namespace: config.serviceNamespace, corePrefixes: config.coreScopePrefixes }

  const providers: { shutdown: () => Promise<void> }[] = []

  if (config.enableTraces) {
    const tracerProvider = new NodeTracerProvider({
      resource,
      spanProcessors: [
        ...(config.sourceAttribution ? [new SourceSpanProcessor(nsOptions)] : []),
        new BatchSpanProcessor(new OTLPTraceExporter({ url: `${endpoint}/v1/traces` })),
      ],
    })
    tracerProvider.register()
    providers.push(tracerProvider)
  }

  if (config.enableMetrics) {
    const meterProvider = new MeterProvider({
      resource,
      views: config.serviceNamespace ? [namespaceView(config.serviceNamespace)] : [],
      readers: [
        new PeriodicExportingMetricReader({
          exporter: new OTLPMetricExporter({ url: `${endpoint}/v1/metrics` }),
          exportIntervalMillis: config.metricExportIntervalMs,
        }),
      ],
    })
    metrics.setGlobalMeterProvider(meterProvider)
    providers.push(meterProvider)
  }

  if (config.enableLogs) {
    const loggerProvider = new LoggerProvider({
      resource,
      processors: [
        ...(config.sourceAttribution ? [new SourceLogProcessor(nsOptions)] : []),
        new BatchLogRecordProcessor({ exporter: new OTLPLogExporter({ url: `${endpoint}/v1/logs` }) }),
      ],
    })
    logs.setGlobalLoggerProvider(loggerProvider)
    providers.push(loggerProvider)
  }

  // Bridge dsh session telemetry into OTel logs. Export the POST-redaction
  // record (next()'s result) so the bridge respects the official redaction
  // waterfall instead of leaking pre-redaction payloads.
  if (config.bridgeSessionTelemetry) {
    const logger = logs.getLogger('dsh-o11y')
    const on = (ctx as unknown as { on: (e: string, l: (r: unknown, next: () => unknown) => unknown) => void }).on
    on('session-telemetry/record', (_record, next) => {
      const redacted = next() as SessionTelemetryRecord
      try {
        logger.emit(toLogRecordInput(redacted))
      } catch {
        // bridging is best-effort
      }
      return redacted
    })
  }

  ctx.provide('o11y', {
    serviceName,
    endpoint,
    active: true,
  } satisfies O11yHandle)

  // Web UI status route. `connection` is web-profile-only, so inject it nested
  // (not in the top-level inject array) to keep headless activation unchanged.
  ctx.inject(['connection'], (scope) =>
    registerStatusRoutes(scope, buildStatusPayload(config, serviceName, endpoint, true)))

  ctx.effect(() => () => teardownO11y(providers, config))
}
