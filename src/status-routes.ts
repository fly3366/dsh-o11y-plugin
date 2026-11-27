/**
 * Web UI data channel: an exact Connection Fetch route exposing read-only o11y
 * deployment status as JSON to the plugin's own browser half (web/client.js).
 *
 * Registered under a nested `ctx.inject(['connection'])` because `connection`
 * is web-profile-only; headless activation is unchanged. The payload carries
 * operator configuration (endpoint/namespace/signals), never credentials or
 * host filesystem paths; errors return a stable code only.
 */
import type { Context } from '@deepseek-ai/cordis'
import type { O11yConfig } from './config.ts'

export const STATUS_PATH = '/api/o11y/status'

export interface O11yStatusPayload {
  active: boolean
  serviceName: string
  endpoint: string
  serviceNamespace: string
  sourceAttribution: boolean
  bridgeSessionTelemetry: boolean
  coreScopePrefixes: string[]
  signals: { traces: boolean; metrics: boolean; logs: boolean }
}

/** Pure payload builder from resolved config; unit-testable without a Request. */
export function buildStatusPayload(
  config: O11yConfig,
  serviceName: string,
  endpoint: string,
  active: boolean,
): O11yStatusPayload {
  return {
    active,
    serviceName,
    endpoint,
    serviceNamespace: config.serviceNamespace,
    sourceAttribution: config.sourceAttribution,
    bridgeSessionTelemetry: config.bridgeSessionTelemetry,
    coreScopePrefixes: config.coreScopePrefixes,
    signals: { traces: config.enableTraces, metrics: config.enableMetrics, logs: config.enableLogs },
  }
}

interface ConnectionLike {
  readonly fetch: {
    register(route: {
      readonly path: string
      readonly methods: readonly ('GET' | 'HEAD' | 'POST')[]
      readonly requestBody: 'buffered'
      readonly fetch: (request: Request) => Promise<Response>
    }): () => Promise<void>
  }
}

/** Register the GET status route on the (web-only) connection service. */
export function registerStatusRoutes(ctx: Context, payload: O11yStatusPayload): void {
  const connection = Reflect.get(ctx, 'connection') as ConnectionLike | undefined
  if (!connection) return
  connection.fetch.register({
    path: STATUS_PATH,
    methods: ['GET'],
    requestBody: 'buffered',
    fetch: async (request) => {
      try {
        request.signal.throwIfAborted()
        return Response.json(payload)
      } catch {
        return Response.json({ error: 'status-unavailable' }, { status: 500 })
      }
    },
  })
}