import Schema from '@deepseek-ai/schemastery'

export interface O11yConfig {
  enabled: boolean
  serviceName: string
  endpoint: string
  enableTraces: boolean
  enableMetrics: boolean
  enableLogs: boolean
  metricExportIntervalMs: number
  bridgeSessionTelemetry: boolean
}

export const Config: Schema<O11yConfig> = Schema.object({
  enabled: Schema.boolean().default(true),
  serviceName: Schema.string().default('dsh-plugin'),
  endpoint: Schema.string().default(''),
  enableTraces: Schema.boolean().default(true),
  enableMetrics: Schema.boolean().default(true),
  enableLogs: Schema.boolean().default(true),
  metricExportIntervalMs: Schema.number().default(60_000),
  bridgeSessionTelemetry: Schema.boolean().default(true),
})
