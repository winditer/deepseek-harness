/** Durable pin storage over the sidebar entry's user-settings section. */
import type { ConfigForm } from '@deepseek-ai/dsh-client-ui-settings/client'
import { UNPINNED_PANELS_FIELD, type SidebarSettings } from '../settings.ts'
import type { PanelPinStorage } from './panel-pins.ts'

/**
 * Adapt the sidebar's settings section to the pin list: reads follow the
 * mirrored Host value, a pin change queues one whole-array field write, and a
 * refused write reloads Host state so the pin list can fall back to it.
 * @param form - The sidebar entry's configuration form.
 * @returns Storage for {@link createPanelPins}.
 */
export function createHostPinStorage(form: ConfigForm<SidebarSettings>): PanelPinStorage {
  return {
    read: () => {
      const stored = form.getSnapshot().value?.unpinnedPanels
      return Array.isArray(stored) ? stored : undefined
    },
    write: unpinned => form.set(UNPINNED_PANELS_FIELD, [...unpinned]),
    subscribe: listener => form.subscribe(listener),
  }
}
