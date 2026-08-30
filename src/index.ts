import type { Context } from '@deepseek-ai/cordis'
import Schema from '@deepseek-ai/schemastery'
import { metrics } from '@opentelemetry/api'
import { logs, SeverityNumber } from '@opentelemetry/api-logs'
import { resourceFromAttributes } from '@opentelemetry/resources'
import { NodeTracerProvider, BatchSpanProcessor } from '@opentelemetry/sdk-trace-node'
import { MeterProvider, PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics'
import { LoggerProvider, BatchLogRecordProcessor } from '@opentelemetry/sdk-logs'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http'
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http'
import type { O11yConfig } from './config.ts'

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
  const serviceName = config.serviceName || process.env.OTEL_SERVICE_NAME || 'dsh-plugin'
  const resource = resourceFromAttributes({ 'service.name': serviceName })

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

  // Expose o11y knobs in the dsh Web settings UI (dsh-settings namespace).
  // Guarded: no-ops when the settings service or package is unavailable.
  void registerSettingsSection(ctx, { serviceName, endpoint, config })

  ctx.provide('o11y', {
    serviceName,
    endpoint,
    active: true,
  } satisfies O11yHandle)

  ctx.effect(() => () => {
    for (const p of providers) void p.shutdown()
  })
}

const SettingsSchema = Schema.object({
  serviceName: Schema.string().default('dsh-plugin'),
  endpoint: Schema.string().default(''),
  enableTraces: Schema.boolean().default(true),
  enableMetrics: Schema.boolean().default(true),
  enableLogs: Schema.boolean().default(true),
  metricExportIntervalMs: Schema.number().default(60_000),
  bridgeSessionTelemetry: Schema.boolean().default(true),
})

/**
 * Register an `o11y` settings namespace so the dsh Web settings UI renders and
 * persists these knobs. Provider-affecting values apply on next dsh start.
 * No-ops when the settings service or dsh-settings package is unavailable.
 */
async function registerSettingsSection(
  ctx: Context,
  current: { serviceName: string; endpoint: string; config: O11yConfig },
): Promise<void> {
  try {
    const { installSettingsSection, settingsNamespace } = await import('@deepseek-ai/dsh-settings')
    installSettingsSection(
      ctx,
      settingsNamespace('o11y'),
      SettingsSchema,
      {
        serviceName: current.serviceName,
        endpoint: current.endpoint,
        enableTraces: current.config.enableTraces,
        enableMetrics: current.config.enableMetrics,
        enableLogs: current.config.enableLogs,
        metricExportIntervalMs: current.config.metricExportIntervalMs,
        bridgeSessionTelemetry: current.config.bridgeSessionTelemetry,
      },
      { setSource: () => {}, onChange: () => {} },
    )
  } catch {
    // settings not available in this dsh version; skip UI exposure
  }
}
