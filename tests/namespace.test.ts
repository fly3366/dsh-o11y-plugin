import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  classifyScope, sourceAttributes, buildResource,
  SourceSpanProcessor, SourceLogProcessor, namespaceView,
  SOURCE_KEY, SOURCE_NAME_KEY, NAMESPACE_KEY,
} from '../src/namespace.ts'

const opts = { namespace: 'acme', corePrefixes: ['dsh', '@deepseek-ai'] }

test('namespace: classifyScope separates dsh core from plugins', () => {
  assert.equal(classifyScope('dsh-o11y', opts.corePrefixes), 'core')
  assert.equal(classifyScope('@deepseek-ai/dsh-session', opts.corePrefixes), 'core')
  assert.equal(classifyScope('deepjit', opts.corePrefixes), 'plugin')
  assert.equal(classifyScope('my-plugin', opts.corePrefixes), 'plugin')
})

test('namespace: sourceAttributes stamps source + name + namespace', () => {
  const attrs = sourceAttributes('deepjit', opts)
  assert.equal(attrs[SOURCE_KEY], 'plugin')
  assert.equal(attrs[SOURCE_NAME_KEY], 'deepjit')
  assert.equal(attrs[NAMESPACE_KEY], 'acme')
  const noNs = sourceAttributes('dsh-x', { namespace: '', corePrefixes: opts.corePrefixes })
  assert.equal(noNs[SOURCE_KEY], 'core')
  assert.equal(NAMESPACE_KEY in noNs, false, 'empty namespace omits the key')
})

test('namespace: buildResource merges service name/namespace + custom attrs over defaults', () => {
  const resource = buildResource('my-service', 'acme', { 'deployment.environment': 'prod' })
  assert.equal(resource.attributes['service.name'], 'my-service')
  assert.equal(resource.attributes['service.namespace'], 'acme')
  assert.equal(resource.attributes['deployment.environment'], 'prod')
})

test('namespace: SourceSpanProcessor stamps span attributes at onStart', () => {
  let captured: Record<string, unknown> | undefined
  const span = {
    instrumentationScope: { name: 'deepjit' },
    setAttributes: (a: Record<string, unknown>) => { captured = a },
  }
  new SourceSpanProcessor(opts).onStart(span as never, undefined as never)
  assert.equal(captured![SOURCE_KEY], 'plugin')
  assert.equal(captured![SOURCE_NAME_KEY], 'deepjit')
  assert.equal(captured![NAMESPACE_KEY], 'acme')
})

test('namespace: SourceLogProcessor stamps log record attributes at onEmit', () => {
  let captured: Record<string, unknown> | undefined
  const record = {
    instrumentationScope: { name: '@deepseek-ai/dsh-session' },
    setAttributes: (a: Record<string, unknown>) => { captured = a },
  }
  new SourceLogProcessor(opts).onEmit(record as never)
  assert.equal(captured![SOURCE_KEY], 'core')
  assert.equal(captured![SOURCE_NAME_KEY], '@deepseek-ai/dsh-session')
})

test('namespace: namespaceView attributes processor stamps every data point', () => {
  const view = namespaceView('acme')
  const processor = view.attributesProcessors![0]!
  const out = processor.process({ a: 1 })
  assert.equal(out.a, 1)
  assert.equal(out[NAMESPACE_KEY], 'acme')
})