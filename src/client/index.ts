import type { Context } from '@deepseek-ai/cordis'
import { makeO11yCard } from './O11yCard.tsx'

export const name = 'o11y-ui'
export const inject = ['slots', 'settingsScope']

interface ScopeSnapshot {
  status: 'loading' | 'ready' | 'unavailable'
  value: unknown
}
interface SettingsScope {
  getSnapshot(): ScopeSnapshot
  subscribe(listener: () => void): () => void
  set(field: string, value: unknown): Promise<void>
}

/**
 * Client half: register a minimal o11y settings card into the
 * `settings.plugin.item` slot, keyed by the `o11y` settings namespace so the
 * Plugins settings tab pairs it with the server-registered namespace.
 */
export function apply(ctx: Context): void {
  const c = ctx as unknown as {
    settingsScope: { bind: (spec: { namespace: string }) => SettingsScope }
    slots: {
      inject: (slot: string, gen: () => Generator<unknown, void, unknown>) => () => void
      register: (opts: { name: string; key: string; inject: () => unknown }, comp: unknown) => unknown
    }
  }
  const scope = c.settingsScope.bind({ namespace: 'o11y' })
  const Card = makeO11yCard(scope)
  ctx.effect(() =>
    c.slots.inject('settings.plugin.item', function* () {
      yield c.slots.register(
        { name: 'settings.plugin.item', key: 'o11y', inject: () => ({}) },
        Card,
      )
    }),
  )
}
