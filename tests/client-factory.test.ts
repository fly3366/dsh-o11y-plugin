import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'

const CLIENT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'web', 'client.js')

interface Captured {
  id: string
  factory: (require: (name: string) => unknown) => {
    inject: string[]
    apply: (ctx: unknown) => void
  }
}

function loadFactory(): Captured {
  const src = readFileSync(CLIENT, 'utf8')
  let captured: Captured | undefined
  const sandbox = { window: { __ModuleLoader__: { load: (mod: Captured) => { captured = mod } } } }
  vm.runInNewContext(src, sandbox)
  assert.ok(captured, 'factory registered via window.__ModuleLoader__.load')
  return captured!
}

const reactStub = {
  createElement: (...args: unknown[]) => ({ args }),
  useState: (init: unknown) => [init, () => {}],
  useEffect: () => {},
}
const requireStub = (name: string) => {
  if (name === 'react') return reactStub
  throw new Error(`unexpected module request: ${name}`)
}

test('o11y client factory: loads with the package id and declares slots/locale inject', () => {
  const captured = loadFactory()
  const mod = captured.factory(requireStub)
  assert.equal(captured.id, 'dsh-o11y-plugin')
  // Spread into a main-realm array: vm contexts have a different Array.prototype.
  assert.deepEqual([...mod.inject], ['slots', 'locale'])
  assert.equal(typeof mod.apply, 'function')
})

test('o11y client factory: apply registers the locale namespace and the detail-section slot', () => {
  const mod = loadFactory().factory(requireStub)
  const locales: string[] = []
  const injected: string[] = []
  const registered: { name: string; id: string; locale?: string }[] = []
  let component: ((props: unknown) => unknown) | undefined
  const ctx = {
    effect: (fn: () => unknown) => fn(),
    locale: { register: (ns: string) => { locales.push(ns); return () => {} } },
    slots: {
      inject: (key: string, cb: () => unknown) => { injected.push(key); cb(); return () => {} },
      register: (opts: { name: string; id: string; locale?: string }, comp: (props: unknown) => unknown) => {
        registered.push(opts)
        component = comp
        return () => {}
      },
    },
  }
  mod.apply(ctx)
  assert.deepEqual(locales, ['o11y'])
  assert.deepEqual(injected, ['plugins.detail.section'])
  assert.equal(registered[0]!.name, 'plugins.detail.section')
  assert.equal(registered[0]!.id, 'o11y-status')
  assert.equal(registered[0]!.locale, 'o11y')
  assert.equal(typeof component, 'function')

  assert.equal(component!({ subject: { kind: 'item', id: 'other' } }), null)
  const el = component!({ subject: { kind: 'bundle', pkg: { name: 'dsh-o11y-plugin' } }, t: (k: string) => k })
  assert.ok(el, 'o11y subject renders a panel element')
})