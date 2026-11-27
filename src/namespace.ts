/**
 * Enterprise source/tenant namespacing for incoming OTel signals.
 *
 * dsh and its plugins emit through the standard `@opentelemetry/api` globals;
 * o11y installs the global providers. These helpers stamp each incoming signal
 * with a deployment namespace and a core-vs-plugin source attribution derived
 * from the emitting instrumentation scope, so enterprise backends can separate
 * tenants and attribute telemetry to dsh core or to a specific plugin.
 *
 * Traces stamp in `onStart` (a span's attributes are frozen once ended); logs
 * stamp in `onEmit` (the SDK sanctions mutation for that call only); metrics
 * stamp per data point via a catch-all view attributes processor. Processors
 * and views are constructor-only, so callers prepend them before exporters.
 */
import type { Context } from '@opentelemetry/api'
import { defaultResource, resourceFromAttributes, type Resource } from '@opentelemetry/resources'
import type { Span, SpanProcessor } from '@opentelemetry/sdk-trace-node'
import type { LogRecordProcessor, ReadWriteLogRecord } from '@opentelemetry/sdk-logs'
import type { IAttributesProcessor, ViewOptions } from '@opentelemetry/sdk-metrics'

export interface NamespaceOptions {
  /** Deployment/tenant namespace; empty disables namespace stamping. */
  namespace: string
  /** Scope-name prefixes treated as dsh core (everything else is a plugin). */
  corePrefixes: readonly string[]
}

/** Attribute keys stamped on incoming signals. */
export const SOURCE_KEY = 'dsh.source'
export const SOURCE_NAME_KEY = 'dsh.source.name'
export const NAMESPACE_KEY = 'dsh.namespace'

export function classifyScope(scopeName: string, corePrefixes: readonly string[]): 'core' | 'plugin' {
  return corePrefixes.some((prefix) => scopeName.startsWith(prefix)) ? 'core' : 'plugin'
}

/** Per-signal source attribution; namespace only when configured. */
export function sourceAttributes(scopeName: string, options: NamespaceOptions): Record<string, string> {
  const attrs: Record<string, string> = {
    [SOURCE_KEY]: classifyScope(scopeName, options.corePrefixes),
    [SOURCE_NAME_KEY]: scopeName,
  }
  if (options.namespace) attrs[NAMESPACE_KEY] = options.namespace
  return attrs
}

/** Shared resource: SDK defaults overridden by service name/namespace + custom attrs. */
export function buildResource(
  serviceName: string,
  namespace: string,
  extra: Record<string, string>,
): Resource {
  const attrs: Record<string, string> = { 'service.name': serviceName, ...extra }
  if (namespace) attrs['service.namespace'] = namespace
  return defaultResource().merge(resourceFromAttributes(attrs))
}

/** Stamps incoming spans with source attribution at start (before they end). */
export class SourceSpanProcessor implements SpanProcessor {
  private readonly options: NamespaceOptions
  constructor(options: NamespaceOptions) { this.options = options }
  onStart(span: Span, _parentContext: Context): void {
    span.setAttributes(sourceAttributes(span.instrumentationScope.name, this.options))
  }
  onEnd(): void {}
  forceFlush(): Promise<void> { return Promise.resolve() }
  shutdown(): Promise<void> { return Promise.resolve() }
}

/** Stamps incoming log records with source attribution during onEmit. */
export class SourceLogProcessor implements LogRecordProcessor {
  private readonly options: NamespaceOptions
  constructor(options: NamespaceOptions) { this.options = options }
  onEmit(record: ReadWriteLogRecord, _context?: Context): void {
    record.setAttributes(sourceAttributes(record.instrumentationScope.name, this.options))
  }
  forceFlush(): Promise<void> { return Promise.resolve() }
  shutdown(): Promise<void> { return Promise.resolve() }
}

/** Catch-all view stamping every metric data point with the deployment namespace. */
export function namespaceView(namespace: string): ViewOptions {
  const processor: IAttributesProcessor = {
    process: (incoming) => ({ ...incoming, [NAMESPACE_KEY]: namespace }),
  }
  return { attributesProcessors: [processor] }
}