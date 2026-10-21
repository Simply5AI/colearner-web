'use client'

import { useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { LearnLoadError, LearnSkeleton, useLearnIdentity } from '@/components/learn/learn-common'
import type { LearnBand } from '@/lib/api/learn'
import { isPracticeId } from '@/lib/api/practice'
import { HubView, type HubHistory, type HubTab } from './hub'
import { usePracticeHistory, usePracticeHub } from './hub-hooks'

/**
 * L9: loads the hub (and, on the Past sessions tab, the cursor history) and chooses between loading, denied,
 * unavailable-with-retry and the band layout. The tab lives in the address (`?tab=past`) so it can be opened directly.
 */
export function HubScreen({ initialTab = 'today', planId = null, onTabChange }: { initialTab?: HubTab; planId?: string | null; /** Replaces the default address update (the dev harness stays on its own page). */ onTabChange?: (tab: HubTab) => void }) {
  const router = useRouter()
  const pathname = usePathname()
  const { band: identityBand } = useLearnIdentity()
  const [tab, setTab] = useState<HubTab>(initialTab)
  const [subjectId, setSubjectId] = useState<string | null>(null)
  const filters = { planId: isPracticeId(planId) ? planId : null }
  const hub = usePracticeHub(filters)
  const past = usePracticeHistory(tab === 'past')
  const fallbackBand: LearnBand = identityBand ?? 'teens'
  const changeTab = (next: HubTab) => {
    setTab(next)
    if (onTabChange) onTabChange(next)
    else router.replace(next === 'past' ? `${pathname}?tab=past` : pathname, { scroll: false })
  }
  if (hub.isPending) return <LearnSkeleton band={fallbackBand} label="Getting your practice ready" rows={2} />
  if (hub.error) return <LearnLoadError error={hub.error} retry={() => void hub.refetch()} band={fallbackBand} backHref="/learn/home" backLabel="Back home" />
  const history: HubHistory = {
    rows: past.data?.pages.flatMap(page => page.sessions) ?? [],
    loading: past.isPending && past.fetchStatus !== 'idle', error: past.error,
    hasMore: !!past.hasNextPage, loadingMore: past.isFetchingNextPage,
    onMore: () => void past.fetchNextPage(), onRetry: () => void past.refetch(),
  }
  return <HubView hub={hub.data} tab={tab} onTab={changeTab} subjectId={subjectId} onSubject={setSubjectId} history={history} />
}
