// @vitest-environment jsdom
/** The sidebar entry's settings section backs the launcher pin list. */
import { describe, expect, it } from 'vitest'
import { createHostPinStorage } from '../src/client/host-pins.ts'
import { createPanelPins } from '../src/client/panel-pins.ts'
import { createTestSettingsForm } from './settings-form.ts'

describe('sidebar host pin storage', () => {
  it('reads the stored section and queues one whole-array write', async () => {
    const form = createTestSettingsForm(['tasks'])
    const pins = createPanelPins(createHostPinStorage(form))
    expect(pins.unpinned.getSnapshot()).toEqual(['tasks'])
    pins.setPinned('notes', false)
    expect(pins.unpinned.getSnapshot()).toEqual(['tasks', 'notes'])
    await Promise.resolve()
    expect(form.written).toEqual([['tasks', 'notes']])
    expect(form.getSnapshot().value).toEqual({ unpinnedPanels: ['tasks', 'notes'] })
  })

  it('keeps the choice across a fresh pin list over the same stored section', async () => {
    const form = createTestSettingsForm()
    const first = createPanelPins(createHostPinStorage(form))
    first.setPinned('notes', false)
    await Promise.resolve()
    const second = createPanelPins(createHostPinStorage(form))
    expect(second.unpinned.getSnapshot()).toEqual(['notes'])
  })

  it('publishes a Host echo that arrives without a local change', () => {
    const form = createTestSettingsForm([])
    const pins = createPanelPins(createHostPinStorage(form))
    form.store(['notes'])
    expect(pins.unpinned.getSnapshot()).toEqual(['notes'])
  })

  it('reads no section before the Host accepts one', () => {
    const form = createTestSettingsForm()
    const storage = createHostPinStorage(form)
    expect(storage.read()).toBeUndefined()
    expect(createPanelPins(storage).unpinned.getSnapshot()).toEqual([])
  })

  it('falls back to the stored section when the Host refuses the write', async () => {
    const form = createTestSettingsForm(['tasks'])
    const pins = createPanelPins(createHostPinStorage(form))
    form.refuseNextWrite()
    pins.setPinned('notes', false)
    await Promise.resolve()
    expect(form.written).toEqual([['tasks', 'notes']])
    expect(pins.unpinned.getSnapshot()).toEqual(['tasks'])
  })
})
