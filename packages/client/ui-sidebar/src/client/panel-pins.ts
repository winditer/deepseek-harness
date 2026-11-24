/** Launcher pin choices for the global panels, kept in memory and mirrored to durable storage. */
import { createSnapshotStore, type ObservableSnapshot } from '@deepseek-ai/dsh-client-store'

/** Panel whose launcher always shows and never enters the customization list. */
export const FIXED_PANEL_ID = 'plugins'

const NO_PANELS: readonly string[] = []

/** Durable half of the pin list. */
export interface PanelPinStorage {
  /** @returns the stored ids, or undefined while the Host has accepted no section yet. */
  read(): readonly string[] | undefined
  /**
   * Persist the complete ids list.
   * @param unpinned - Ids to store.
   * @returns true when the Host accepted the write, false when it refused and the stored value stands.
   */
  write(unpinned: readonly string[]): Promise<boolean>
  /** @returns the disposer that stops reporting stored-section changes. */
  subscribe(listener: () => void): () => void
}

/** Unpinned panel ids and their only mutation. */
export interface PanelPins {
  /** Unpinned panel ids; ids of panels that are not registered stay listed. */
  readonly unpinned: ObservableSnapshot<readonly string[]>
  /**
   * Pin or unpin one panel launcher; the fixed panel is ignored.
   * @param id - Panel id.
   * @param pinned - Whether the launcher is manually pinned.
   */
  readonly setPinned: (id: string, pinned: boolean) => void
  /** Stop following the stored section. */
  readonly dispose: () => void
}

/**
 * Create the panel pin list over optional durable storage. Without storage, or
 * before the Host answers a section, choices live only in this instance; a
 * pin change is published immediately and a refused write falls back to the
 * stored list.
 * @param storage - Durable storage; omitted when the deployment has no settings service.
 * @returns Unpinned panel ids, the pin mutation, and the storage subscription teardown.
 */
export function createPanelPins(storage?: PanelPinStorage): PanelPins {
  const store = createSnapshotStore<{ readonly unpinned: readonly string[] }>({ unpinned: NO_PANELS })
  /** Writes still awaiting acceptance; adoption waits so a stale echo cannot revert a newer choice. */
  let pending = 0
  const publish = (next: readonly string[]): void => {
    if (sameIds(store.getSnapshot().unpinned, next)) return
    store.set({ unpinned: next.length === 0 ? NO_PANELS : [...next] })
  }
  const adopt = (): void => {
    if (pending > 0) return
    const stored = storage?.read()
    if (stored !== undefined) publish(stored)
  }
  const settle = (accepted: boolean): void => {
    pending -= 1
    if (!accepted && pending === 0) adopt()
  }
  const unsubscribe = storage?.subscribe(adopt)
  adopt()
  return {
    unpinned: { getSnapshot: () => store.getSnapshot().unpinned, subscribe: listener => store.subscribe(listener) },
    setPinned: (id, pinned) => {
      const current = store.getSnapshot().unpinned
      if (id === FIXED_PANEL_ID || pinned !== current.includes(id)) return
      const next = pinned ? current.filter(entry => entry !== id) : [...current, id]
      store.set({ unpinned: next })
      if (storage === undefined) return
      pending += 1
      void storage.write(next).then(settle, () => { settle(false) })
    },
    dispose: () => { unsubscribe?.() },
  }
}

/**
 * Whether both lists hold the same ids in the same order, so an echo of the current choice publishes nothing.
 * @param left - Current ids.
 * @param right - Candidate ids.
 * @returns whether the lists are equal.
 */
function sameIds(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((id, index) => id === right[index])
}
