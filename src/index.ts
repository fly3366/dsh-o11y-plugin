import type { Context } from '@deepseek-ai/cordis'
import { trace, metrics } from '@opentelemetry/api'
import { logs, SeverityNumber } from '@opentelemetry/api-logs'
import { resourceFromAttributes } from '@opentelemetry/resources'
import { NodeTracerProvider, BatchSpanProcessor } from '@opentelemetry/sdk-trace-node'
import { MeterProvider, PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics'
import { LoggerProvider, BatchLogRecordProcessor } from '@opentelemetry/sdk-logs'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http'
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http'
import { Config, type O11yConfig } from './config.ts'

export { Config } from './config.ts'

export const name = 'dsh-o11y'
export const inject: string[] = []

/** Handle exposed as the `o11y` service so plugins can detect/inspect it. */
export interface O11yHandle {
  serviceName: string
  endpoint: string
  active: boolean
}

export function apply(ctx: Context, config: O11yConfig) {
  if (!config.enabled) return

  const endpoint =
    config.endpoint || process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318'
  const resource = resourceFromAttributes({ 'service.name': config.serviceName })

  const providers: { shutdown: () => Promise<void> }[] = []

  if (config.enableTraces) {
    const tracerProvider = new NodeTracerProvider({
      resource,
      spanProcessors: [new BatchSpanProcessor(new OTLPTraceExporter({ url: `${endpoint}/v1/traces` }))],
    })
    tracerProvider.register()
    providers.push(tracerProvider)
  }

  if (config.enableMetrics) {
    const meterProvider = new MeterProvider({
      resource,
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
      processors: [new BatchLogRecordProcessor({ exporter: new OTLPLogExporter({ url: `${endpoint}/v1/logs` }) })],
    })
    logs.setGlobalLoggerProvider(loggerProvider)
    providers.push(loggerProvider)
  }

  // Bridge dsh session telemetry (agent dimension) into OTel logs, for free.
  if (config.bridgeSessionTelemetry) {
    const logger = logs.getLogger('dsh-o11y')
    const on = (ctx as unknown as { on: (e: string, l: (r: unknown, next: () => unknown) => unknown) => void }).on
    on('session-telemetry/record', (record, next) => {
      try {
        const r = record as { severity?: string; kind?: string; attributes?: Record<string, unknown> }
        logger.emit({
          severityNumber: r.severity === 'warn' ? SeverityNumber.WARN : SeverityNumber.INFO,
          severityText: r.severity ?? 'info',
          body: `dsh ${r.kind ?? 'record'}`,
          attributes: (r.attributes ?? {}) as Record<string, string | number | boolean>,
        })
      } catch {
        // bridging is best-effort
      }
      return next()
    })
  }

  ctx.provide('o11y', {
    serviceName: config.serviceName,
    endpoint,
    active: true,
  } satisfies O11yHandle)

  ctx.effect(() => () => {
    for (const p of providers) void p.shutdown()
  })
}
