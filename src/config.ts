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
  serviceNamespace: string
  resourceAttributes: Record<string, string>
  sourceAttribution: boolean
  coreScopePrefixes: string[]
}

export const Config: Schema<O11yConfig> = Schema.object({
  enabled: Schema.boolean().default(true),
  serviceName: Schema.string().default(''),
  endpoint: Schema.string().default(''),
  enableTraces: Schema.boolean().default(true),
  enableMetrics: Schema.boolean().default(true),
  enableLogs: Schema.boolean().default(true),
  metricExportIntervalMs: Schema.number().default(60_000),
  bridgeSessionTelemetry: Schema.boolean().default(true),
  serviceNamespace: Schema.string().default(''),
  resourceAttributes: Schema.dict(Schema.string()).default({}),
  sourceAttribution: Schema.boolean().default(true),
  coreScopePrefixes: Schema.array(Schema.string()).default(['dsh', '@deepseek-ai']),
})
