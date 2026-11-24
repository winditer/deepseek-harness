/** Sidebar preferences the Host stores in the user-settings document. */

/** Settings namespace owned by the `ui-sidebar` entry in the web composition. */
export const SIDEBAR_SETTINGS_NAMESPACE = 'ui-sidebar'

/** Field carrying the ids of the panel launchers the user removed from the sidebar. */
export const UNPINNED_PANELS_FIELD = 'unpinnedPanels'

/** Sidebar section this plugin owns. */
export interface SidebarSettings {
  /**
   * Ids of the panel launchers the user unpinned, in the order they were
   * removed. Ids of panels that are not registered stay listed, so disabling a
   * plugin keeps the user's choice for when it returns.
   */
  unpinnedPanels: string[]
}
