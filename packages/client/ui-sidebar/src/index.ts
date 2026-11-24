/** Host loader entry: the sidebar renders in the browser, and its launcher pins persist here. */
import type { Context, Volatile } from '@deepseek-ai/cordis'
// Type-only: the settings service on the plugin context, used for presentation only.
import type {} from '@deepseek-ai/dsh-settings'
import z from '@deepseek-ai/schemastery'
import { UNPINNED_PANELS_FIELD } from './settings.ts'

/** Sidebar preferences projected to the browser. */
export interface Config {
  /** Ids of the panel launchers the user removed from the sidebar. */
  unpinnedPanels: Volatile<string[]>
}

/**
 * Volatile so a pin change reaches the browser as a config update instead of
 * restarting this entry. The empty default keeps every registered launcher
 * visible, which is the state a profile without a stored choice expects.
 */
export const Config = z.object({
  [UNPINNED_PANELS_FIELD]: z.array(z.string()).default([]).volatile(),
})

/**
 * Opt the entry out of the generated settings page: the pin list is edited in
 * the sidebar's own More menu, not by typing panel ids.
 * @param ctx - Host plugin context.
 */
export function apply(ctx: Context): void {
  ctx.inject(['settings'], (child) => { child.effect(() => child.settings.configure({ auto: false }, ctx.fiber)) })
}
