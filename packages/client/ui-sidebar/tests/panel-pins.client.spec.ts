// @vitest-environment jsdom
/** Sidebar launcher pins stay in memory without storage and follow the stored section with it. */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createPanelPins, type PanelPinStorage } from '../src/client/panel-pins.ts'

const KEY = 'dsh.slot.manual-order.sidebar.panellist.v1'
afterEach(() => { localStorage.clear(); vi.restoreAllMocks() })

/** Storage whose writes stay pending until the test settles them, in call order. */
function pendingStorage(initial?: readonly string[]) {
  let stored = initial
  const listeners = new Set<() => void>()
  const settlements: ((accepted: boolean) => void)[] = []
  const rejections: (() => void)[] = []
  const writes: (readonly string[])[] = []
  const report = (): void => { for (const listener of [...listeners]) listener() }
  const storage: PanelPinStorage = {
    read: () => stored,
    write: (unpinned) => {
      writes.push(unpinned)
      return new Promise<boolean>((resolve, reject) => {
        settlements.push((accepted) => {
          if (accepted) stored = unpinned
          resolve(accepted)
          report()
        })
        rejections.push(() => { reject(new Error('offline')) })
      })
    },
    subscribe: (listener) => {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
  }
  return {
    storage,
    writes,
    /** Replace the stored section as a Host echo would, then notify subscribers. */
    store: (next?: readonly string[]) => { stored = next; report() },
    /** Settle the oldest pending write with the Host's answer. */
    settle: async (accepted: boolean) => { settlements.shift()!(accepted); await Promise.resolve() },
    /** Fail the oldest pending write as a transport failure would. */
    fail: async () => { rejections.shift()!(); await Promise.resolve() },
  }
}

describe('sidebar panel pins', () => {
  it('keeps unpinned panel ids in memory without storage or a stored section', () => {
    const pins = createPanelPins()
    const listener = vi.fn()
    pins.unpinned.subscribe(listener)
    const initial = pins.unpinned.getSnapshot()
    expect(initial).toEqual([])
    expect(pins.unpinned.getSnapshot()).toBe(initial)
    pins.setPinned('notes', false)
    pins.setPinned('tasks', false)
    expect(pins.unpinned.getSnapshot()).toEqual(['notes', 'tasks'])
    expect(localStorage.getItem(KEY)).toBeNull()
    expect(listener).toHaveBeenCalledTimes(2)
    expect(createPanelPins().unpinned.getSnapshot()).toEqual([])
    pins.setPinned('notes', true)
    expect(pins.unpinned.getSnapshot()).toEqual(['tasks'])
    expect(localStorage.getItem(KEY)).toBeNull()
  })

  it('ignores Plugins and repeated choices without republishing', () => {
    const pins = createPanelPins()
    pins.setPinned('notes', false)
    const snapshot = pins.unpinned.getSnapshot()
    const listener = vi.fn()
    pins.unpinned.subscribe(listener)
    pins.setPinned('plugins', false)
    pins.setPinned('notes', false)
    pins.setPinned('absent', true)
    expect(pins.unpinned.getSnapshot()).toBe(snapshot)
    expect(listener).not.toHaveBeenCalled()
  })

  it('keeps ids of panels that are not registered', () => {
    const pins = createPanelPins()
    pins.setPinned('removed-plugin', false)
    pins.setPinned('notes', false)
    expect(pins.unpinned.getSnapshot()).toEqual(['removed-plugin', 'notes'])
  })

  it('ignores a legacy stored list instead of restoring it', () => {
    localStorage.setItem(KEY, JSON.stringify({ unpinned: ['notes'] }))
    const pins = createPanelPins()
    const snapshot = pins.unpinned.getSnapshot()
    expect(snapshot).toEqual([])
    expect(pins.unpinned.getSnapshot()).toBe(snapshot)
    pins.setPinned('notes', false)
    expect(pins.unpinned.getSnapshot()).toEqual(['notes'])
  })

  it('starts from the stored section and stores every accepted choice', async () => {
    const host = pendingStorage(['tasks'])
    const pins = createPanelPins(host.storage)
    expect(pins.unpinned.getSnapshot()).toEqual(['tasks'])
    pins.setPinned('notes', false)
    expect(pins.unpinned.getSnapshot()).toEqual(['tasks', 'notes'])
    expect(host.writes).toEqual([['tasks', 'notes']])
    await host.settle(true)
    expect(pins.unpinned.getSnapshot()).toEqual(['tasks', 'notes'])
    expect(host.writes).toHaveLength(1)
  })

  it('follows the Host echo while no write is queued and keeps one empty reference', () => {
    const host = pendingStorage(['notes'])
    const pins = createPanelPins(host.storage)
    const listener = vi.fn()
    pins.unpinned.subscribe(listener)
    host.store(['tasks'])
    expect(pins.unpinned.getSnapshot()).toEqual(['tasks'])
    // An echo repeating the current choice publishes nothing.
    host.store(['tasks'])
    expect(listener).toHaveBeenCalledOnce()
    host.store([])
    expect(listener).toHaveBeenCalledTimes(2)
    const cleared = pins.unpinned.getSnapshot()
    expect(cleared).toEqual([])
    host.store(['tasks'])
    host.store([])
    expect(pins.unpinned.getSnapshot()).toBe(cleared)
    // A Host without an accepted section leaves the in-memory choice alone.
    host.store(undefined)
    expect(pins.unpinned.getSnapshot()).toBe(cleared)
  })

  it('waits for queued writes before adopting, so a stale echo cannot revert a newer choice', async () => {
    const host = pendingStorage([])
    const pins = createPanelPins(host.storage)
    pins.setPinned('notes', false)
    host.store([])
    expect(pins.unpinned.getSnapshot()).toEqual(['notes'])
    await host.settle(true)
    expect(pins.unpinned.getSnapshot()).toEqual(['notes'])
  })

  it('falls back to the stored section when the Host refuses a write', async () => {
    const host = pendingStorage(['tasks'])
    const pins = createPanelPins(host.storage)
    pins.setPinned('notes', false)
    expect(pins.unpinned.getSnapshot()).toEqual(['tasks', 'notes'])
    await host.settle(false)
    expect(pins.unpinned.getSnapshot()).toEqual(['tasks'])
  })

  it('falls back once the last refused write settles, not while another is queued', async () => {
    const host = pendingStorage([])
    const pins = createPanelPins(host.storage)
    pins.setPinned('notes', false)
    pins.setPinned('tasks', false)
    await host.settle(false)
    expect(pins.unpinned.getSnapshot()).toEqual(['notes', 'tasks'])
    await host.settle(false)
    expect(pins.unpinned.getSnapshot()).toEqual([])
  })

  it('falls back to the stored section after a transport failure', async () => {
    const host = pendingStorage(['tasks'])
    const pins = createPanelPins(host.storage)
    pins.setPinned('notes', false)
    await host.fail()
    expect(pins.unpinned.getSnapshot()).toEqual(['tasks'])
  })

  it('stops following the stored section once disposed', () => {
    const host = pendingStorage([])
    const pins = createPanelPins(host.storage)
    pins.dispose()
    host.store(['notes'])
    expect(pins.unpinned.getSnapshot()).toEqual([])
  })
})
