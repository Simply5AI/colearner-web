'use client'

import { useId, useRef, useState, type RefObject } from 'react'
import { MessageCircle } from 'lucide-react'
import { useLearnIdentity } from '@/components/learn/learn-common'
import type { LearnBand } from '@/lib/api/learn'
import { cn } from '@/lib/utils'
import { useCoContext } from './co-hooks'
import { AskCoPanel, type AskCoPanelProps } from './co-panel'
import type { CoContextRef } from './co-types'

type Tuning = Pick<AskCoPanelProps, 'pollBaseMs' | 'slowAfterMs' | 'storage' | 'materialHref'> & {
  /** Development harness only: the panel is open on first render. */
  defaultOpen?: boolean
}

const controlClass = (band: LearnBand) => cn('ds-button ds-button-secondary', band === 'kids' && 'min-h-[4.5rem] min-w-[4.5rem] rounded-full px-6 text-[length:var(--ds-h3)]')

export interface AskCoLauncherProps extends Tuning {
  band: LearnBand
  context: CoContextRef
  /** The opener. The lesson player focuses and presses it for the "/" shortcut. */
  controlRef?: RefObject<HTMLButtonElement | null>
  onOpenChange?: (open: boolean) => void
  /** Nonsecret cache scope. Defaults to the learner identity of the page. */
  actor?: string
  label?: string
  className?: string
}

/**
 * The Ask Co opener and its panel. The control is a real button that opens the dialog; the panel returns focus to it on close.
 * It is only rendered where Ask Co is available (the lesson says so with `askCo.status === 'AVAILABLE'`, the reader after
 * asking the context endpoint), so a working-looking control never opens onto a dead end.
 */
export function AskCoLauncher({ band, context, controlRef, onOpenChange, actor: given, label = 'Ask Co', className, defaultOpen = false, ...tuning }: AskCoLauncherProps) {
  const identity = useLearnIdentity()
  const actor = given ?? identity.actor
  const own = useRef<HTMLButtonElement>(null)
  const ref = controlRef ?? own
  const [open, setOpen] = useState(defaultOpen)
  const change = (next: boolean) => { setOpen(next); onOpenChange?.(next) }
  return <>
    <button ref={ref} type="button" aria-haspopup="dialog" aria-expanded={open} data-testid="ask-co-open" onClick={() => change(true)} className={cn(controlClass(band), className)}>
      <MessageCircle size={band === 'kids' ? 32 : 18} aria-hidden="true" />{label}
    </button>
    <AskCoPanel open={open} onOpenChange={change} context={context} band={band} actor={actor} {...tuning} />
  </>
}

/** Ask Co is not available for this material: a focusable, inert control that states the server's reason and never opens anything. */
export function AskCoDisabled({ band, reason }: { band: LearnBand; reason: string }) {
  const reasonId = useId()
  return <div className={cn('grid gap-1', band === 'kids' && 'justify-items-center')} data-testid="ask-co-unavailable">
    <button type="button" aria-disabled="true" aria-describedby={reasonId} onClick={event => event.preventDefault()} className={cn(controlClass(band), 'cursor-not-allowed opacity-70')}>
      <MessageCircle size={band === 'kids' ? 32 : 18} aria-hidden="true" />Ask Co
    </button>
    <p id={reasonId} className="text-[length:var(--ds-small)] text-muted-foreground">{reason}</p>
  </div>
}

/**
 * Ask Co about one material, for the library item (reader). It asks the context endpoint first: an available context gets
 * the real control, an unavailable one gets the server's reason, and while loading or when the answer cannot be read nothing
 * is shown, so the page never claims more than it knows.
 */
export function AskCoEntry({ materialId, band, actor, ...tuning }: { materialId: string; band: LearnBand; actor?: string } & Tuning) {
  const identity = useLearnIdentity()
  const scope = actor ?? identity.actor
  const context: CoContextRef = { kind: 'MATERIAL', materialId }
  const query = useCoContext(scope, context)
  const view = query.data
  if (!view) return null
  if (!view.available) return <AskCoDisabled band={band} reason={view.reason ?? 'Ask Co is not available for this material yet.'} />
  return <div className="flex flex-wrap items-center gap-3" data-testid="ask-co-entry">
    <AskCoLauncher band={band} context={context} actor={scope} {...tuning} />
    <p className="text-[length:var(--ds-small)] text-muted-foreground">Ask Co about this material. It answers from what you added.</p>
  </div>
}
