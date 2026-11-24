/** In-memory stand-in for the sidebar entry's Host configuration form. */
import type { ConfigForm, ConfigFormSnapshot } from '@deepseek-ai/dsh-client-ui-settings/client'
import type { SidebarSettings } from '../src/settings.ts'

/** A config form over one stored section, recording every write the sidebar queues. */
export interface TestSettingsForm extends ConfigForm<SidebarSettings> {
  /** Sections the sidebar asked the Host to store, in call order. */
  readonly written: readonly (readonly string[])[]
  /** Replace the stored section as a Host echo would, then notify subscribers. */
  store(unpinnedPanels: string[]): void
  /** Refuse the next write, as a stale-revision Host refuses one. */
  refuseNextWrite(): void
}

/**
 * Create a form whose stored section starts at `initial` and whose writes are
 * accepted and stored, exactly as an accepting Host would behave.
 * @param initial - Ids the Host already holds; omitted means no stored choice yet.
 * @returns The form stub and its recorded writes.
 */
export function createTestSettingsForm(initial?: string[]): TestSettingsForm {
  let stored = initial
  let revision = 1
  const listeners = new Set<() => void>()
  let snapshot: ConfigFormSnapshot<SidebarSettings> = build()
  const written: (readonly string[])[] = []
  let refuse = false
  const notify = (): void => {
    snapshot = build()
    for (const listener of [...listeners]) listener()
  }
  function build(): ConfigFormSnapshot<SidebarSettings> {
    return {
      status: stored === undefined ? 'loading' : 'ready',
      value: stored === undefined ? undefined : { unpinnedPanels: stored },
      base: undefined,
      user: stored === undefined ? undefined : { unpinnedPanels: stored },
      revision: stored === undefined ? undefined : revision,
      writable: true,
    }
  }
  return {
    written,
    getSnapshot: () => snapshot,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    mutate: async () => false,
    unset: async () => false,
    set: async (field, value) => {
      written.push(value as string[])
      if (refuse) {
        refuse = false
        return false
      }
      if (field !== 'unpinnedPanels') return false
      revision += 1
      stored = [...(value as string[])]
      notify()
      return true
    },
    store: (unpinnedPanels) => {
      stored = unpinnedPanels
      revision += 1
      notify()
    },
    refuseNextWrite: () => { refuse = true },
  }
}
