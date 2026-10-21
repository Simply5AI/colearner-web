'use client'

import Link from 'next/link'
import { ErrorState } from '@/components/design-system'
import { LearnFrame, LearnLoadError, LearnSkeleton, useLearnIdentity } from '@/components/learn/learn-common'
import { bandFromApi, type LearnBand } from '@/lib/api/learn'
import { LearnApiError } from '@/lib/api/learn-request'
import { isPracticeId, practiceRoutes } from '@/lib/api/practice'
import { usePracticeSummary } from './hub-hooks'
import { SummaryView } from './summary'

/** L11: loading, denied, unavailable-with-retry, "not finished yet", then the Great or Tough summary for the band. */
export function SummaryScreen({ sessionId }: { sessionId: string }) {
  const { band: identityBand } = useLearnIdentity()
  const query = usePracticeSummary(sessionId)
  const fallbackBand: LearnBand = identityBand ?? 'teens'
  if (query.isPending) return <LearnSkeleton band={fallbackBand} label={fallbackBand === 'kids' ? 'Co is counting your stars' : 'Adding up your answers'} rows={2} />
  if (query.error) {
    // A summary exists only once the session is completed; a 409 means it is still running.
    if (query.error instanceof LearnApiError && query.error.status === 409 && isPracticeId(sessionId)) {
      return <LearnFrame band={fallbackBand} label="Practice not finished">
        <div data-state="not-finished"><ErrorState band={fallbackBand} title="This practice is not finished yet" description="Finish the questions first, then your summary will be ready." action={<div className="flex flex-wrap justify-center gap-3">
          <Link href={practiceRoutes.session(sessionId)} className="ds-button ds-button-primary">Keep going</Link>
          <Link href={practiceRoutes.hub} className="ds-button ds-button-secondary">{fallbackBand === 'kids' ? 'Back to Play' : 'Back to practice'}</Link>
        </div>} /></div>
      </LearnFrame>
    }
    return <LearnLoadError error={query.error} retry={() => void query.refetch()} band={fallbackBand} backHref={practiceRoutes.hub} backLabel={fallbackBand === 'kids' ? 'Back to Play' : 'Back to practice'} />
  }
  const band = query.data.band ? bandFromApi(query.data.band) : fallbackBand
  return <SummaryView summary={query.data} band={band} />
}
