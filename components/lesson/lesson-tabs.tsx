'use client'

import { useRef, type KeyboardEvent, type ReactNode } from 'react'
import { Check, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

/** What a lesson view needs to sit inside a topic tab: the tab bar and the ids that tie the panel to its tab. */
export interface LessonTabsSlot { bar: ReactNode; panelId: string; tabId: string }

export interface TopicTab {
  /** `overview` or a concept id. */
  key: string
  label: string
  state: 'none' | 'making' | 'ready'
}

export const tabDomId = (scope: string, key: string) => `${scope}-tab-${key}`
export const panelDomId = (scope: string) => `${scope}-panel`

/**
 * Overview + one tab per key idea. A proper tablist: arrow keys, Home and End move between tabs (they never reach the
 * lesson's own step shortcuts), only the selected tab is in the tab order, and a long list scrolls sideways on a phone.
 */
export function TopicTabs({ scope, tabs, selected, onSelect }: { scope: string; tabs: readonly TopicTab[]; selected: string; onSelect: (key: string) => void }) {
  const refs = useRef(new Map<string, HTMLButtonElement>())
  const move = (event: KeyboardEvent, index: number) => {
    const rtl = (document.documentElement.dir || getComputedStyle(document.documentElement).direction) === 'rtl'
    let target = -1
    if (event.key === 'ArrowRight') target = rtl ? index - 1 : index + 1
    else if (event.key === 'ArrowLeft') target = rtl ? index + 1 : index - 1
    else if (event.key === 'Home') target = 0
    else if (event.key === 'End') target = tabs.length - 1
    else return
    event.preventDefault()
    event.stopPropagation()
    const next = tabs[(target + tabs.length) % tabs.length]
    if (!next) return
    onSelect(next.key)
    refs.current.get(next.key)?.focus()
  }
  return <div role="tablist" aria-label="Topics in this lesson" data-testid="topic-tabs" className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:thin]">
    {tabs.map((tab, index) => {
      const active = tab.key === selected
      return <button key={tab.key} type="button" role="tab" id={tabDomId(scope, tab.key)} aria-selected={active} aria-controls={panelDomId(scope)} tabIndex={active ? 0 : -1}
        ref={node => { if (node) refs.current.set(tab.key, node); else refs.current.delete(tab.key) }}
        data-state={tab.state} onClick={() => onSelect(tab.key)} onKeyDown={event => move(event, index)}
        className={cn('inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full border px-4 py-2 text-[length:var(--ds-small)] font-bold focus-visible:outline-2 focus-visible:outline-ring', active ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card hover:bg-secondary')}>
        {tab.label}
        {tab.state === 'ready' && <Check size={14} aria-label="ready" />}
        {tab.state === 'making' && <Loader2 size={14} className="animate-spin" aria-label="Co is making this" />}
      </button>
    })}
  </div>
}
