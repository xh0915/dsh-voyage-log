/**
 * dsh-voyage-log — Client plugin entry (browser half).
 *
 * Mounts the voyage Remote namespace, registers the dictionaries, injects one
 * tab into the conversation view ring, and paints the styles the tab needs.
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import { DSH_VOYAGE_REMOTE } from './remote.ts'
import { NS, en, zh } from './locales.ts'
import { VoyageView, type VoyageActions, type VoyageViewSlotProps } from './view.tsx'
import type { VoyageLog } from '../schema.ts'
import { adoptStyles } from './styles.ts'

/** Required services: the Remote gateway, locale, and slots. */
export const inject = ['slots', 'remote', 'locale']

type RemoteResult<T> = { ok: true; value: T } | { ok: false; error: { message: string } }

/** Compose the voyage log tab. @param ctx - client root context. */
export function apply(ctx: ClientContext): void {
  adoptStyles()
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-voyage-log: dictionaries')

  let voyage: unknown
  const t = ctx.locale.bind(NS)

  ctx.effect(async () => {
    const dispose = await ctx.remote.$mount(DSH_VOYAGE_REMOTE)
    voyage = (ctx.reflect as unknown as { get(name: string): unknown }).get('remote.voyage')
    if (voyage === undefined) throw new Error('dsh-voyage-log: the voyage Remote namespace did not mount')
    return () => { voyage = undefined; void dispose() }
  }, 'dsh-voyage-log: remote')

  const actions: VoyageActions = {
    build: (sessionId: string) => {
      if (voyage === undefined) {
        return Promise.resolve<RemoteResult<VoyageLog>>({ ok: false, error: { message: t('state.notMounted') } })
      }
      const fn = (voyage as Record<string, unknown>).build
      if (typeof fn !== 'function') {
        return Promise.resolve<RemoteResult<VoyageLog>>({ ok: false, error: { message: t('state.notMounted') } })
      }
      return (fn as (id: string) => unknown)(sessionId) as ReturnType<VoyageActions['build']>
    },
  }

  ctx.slots.inject('conversation.view', () => ctx.slots.register({
    name: 'conversation.view',
    id: 'voyage-log',
    order: 30,
    label: () => t('view.label'),
    inject: () => ({ actions, t }),
  }, (props: VoyageViewSlotProps) => <VoyageView {...props} />))
}
