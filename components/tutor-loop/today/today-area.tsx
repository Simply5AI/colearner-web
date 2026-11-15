'use client'

import { useCallback, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ProgressTab } from '@/components/tutor-loop/progress/progress-tab'
import { ScheduleTab } from '@/components/tutor-loop/schedule/schedule-tab'
import { TodayTab } from './today-tab'

export const TODAY_TABS = [
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'This week' },
  { id: 'progress', label: 'Progress' },
] as const
export type TodayTabId = (typeof TODAY_TABS)[number]['id']

export const isTodayTab = (value: string | null | undefined): value is TodayTabId => TODAY_TABS.some((t) => t.id === value)

/** Today area: the briefing, this week's schedule and progress. `?tab=week|progress` selects a tab; no learner text goes in the URL. */
export function TodayArea({ initialTab = 'today' }: { initialTab?: TodayTabId }) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const fromUrl = params?.get('tab')
  const [local, setLocal] = useState<TodayTabId>(initialTab)
  const tab: TodayTabId = isTodayTab(fromUrl) ? fromUrl : local

  const select = useCallback(
    (next: TodayTabId) => {
      setLocal(next)
      const search = new URLSearchParams(params?.toString() ?? '')
      if (next === 'today') search.delete('tab')
      else search.set('tab', next)
      const qs = search.toString()
      router.replace(`${pathname ?? '/learn/today'}${qs ? `?${qs}` : ''}`, { scroll: false })
    },
    [params, pathname, router],
  )

  const onKey = (event: React.KeyboardEvent, index: number) => {
    const dir = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
    if (!dir) return
    event.preventDefault()
    const next = TODAY_TABS[(index + dir + TODAY_TABS.length) % TODAY_TABS.length]!
    select(next.id)
    requestAnimationFrame(() => document.getElementById(`today-tab-${next.id}`)?.focus())
  }

  return (
    <div className="tutor-frame flex flex-col gap-4 pb-32 pt-5" data-screen-label="Today" data-tab={tab}>
      <div role="tablist" aria-label="Today" className="flex gap-1 overflow-x-auto border-b border-border">
        {TODAY_TABS.map((item, index) => (
          <button
            key={item.id}
            id={`today-tab-${item.id}`}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            aria-controls="today-panel"
            tabIndex={tab === item.id ? 0 : -1}
            onClick={() => select(item.id)}
            onKeyDown={(e) => onKey(e, index)}
            className={`min-h-11 whitespace-nowrap border-b-4 px-4 font-bold ${tab === item.id ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground'}`}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div id="today-panel" role="tabpanel" aria-labelledby={`today-tab-${tab}`} className="flex flex-col">
        {tab === 'today' && <TodayTab onOpenProgress={() => select('progress')} />}
        {tab === 'week' && <ScheduleTab />}
        {tab === 'progress' && <ProgressTab onOpenSchedule={() => select('week')} />}
      </div>
    </div>
  )
}
