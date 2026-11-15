'use client'

import Link from 'next/link'
import { createContext, useContext, useId, type ReactNode } from 'react'
import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import { Clock, Lock, Sparkles } from 'lucide-react'
import { AgeBandScope, Button, ErrorState, Skeleton, CoCharacter } from '@/components/design-system'
import { cn } from '@/lib/utils'
import { learnApi, linkHref, type Actionable, type LearnBand, type OverviewFilters, type Progress } from '@/lib/api/learn'
import { LearnApiError, LearnSessionError } from '@/lib/api/learn-request'
import { needsLinkHelp } from '@/lib/api/learn-link'
import { SeeWhatsNeededLink } from './see-whats-needed'
import { useTutorShell } from '@/components/tutor-loop/shell/tutor-shell-context'

/* ---------- cache identity and data hooks ---------- */

interface LearnIdentityValue { scope: string; band: LearnBand | null }
const LearnIdentity = createContext<LearnIdentityValue | null>(null)
/** Only a nonsecret cache scope (and, for a selected child, the server-checked band) is exposed. HttpOnly credentials stay at the server boundary. */
export function LearnIdentityProvider({ scope, band = null, children }: { scope: string; band?: LearnBand | null; children: ReactNode }) {
  return <LearnIdentity.Provider value={{ scope, band }}>{children}</LearnIdentity.Provider>
}
export function useLearnIdentity() {
  const identity = useContext(LearnIdentity)
  const { data: session } = useSession()
  return { actor: identity?.scope ?? session?.user?.id ?? '', band: identity?.band ?? null }
}

export const learnKeys = {
  root: ['learn'] as const,
  home: (actor: string) => ['learn', actor, 'home'] as const,
  overview: (actor: string, filters: OverviewFilters) => ['learn', actor, 'overview', filters] as const,
  plan: (actor: string, planId: string) => ['learn', actor, 'plan', planId] as const,
}
const fresh = { retry: false, staleTime: 0, gcTime: 0, refetchOnMount: 'always' } as const

export function useLearnHome() {
  const { actor } = useLearnIdentity()
  return useQuery({ queryKey: learnKeys.home(actor), queryFn: learnApi.home, enabled: !!actor, ...fresh })
}
export function useLearnOverview(filters: OverviewFilters) {
  const { actor } = useLearnIdentity()
  return useInfiniteQuery({
    queryKey: learnKeys.overview(actor, filters), enabled: !!actor, ...fresh,
    queryFn: ({ pageParam }) => learnApi.overview(filters, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: last => last.nextCursor,
    placeholderData: keepPreviousData,
  })
}
export function useLearnPlan(planId: string) {
  const { actor } = useLearnIdentity()
  return useQuery({ queryKey: learnKeys.plan(actor, planId), queryFn: () => learnApi.plan(planId), enabled: !!actor && !!planId, ...fresh })
}

/* ---------- layout ---------- */

export function LearnFrame({ band, label, children, className }: { band: LearnBand; label?: string; children: ReactNode; className?: string }) {
  const tutor = useTutorShell()
  return <AgeBandScope band={band} aria-label={label} className={cn('space-y-6 [&_h1]:font-extrabold [&_h1]:tracking-tight [&_h2]:font-bold [&_h3]:font-bold', tutor.state === 'enabled' ? 'tutor-frame py-6' : 'mx-auto w-full max-w-6xl p-4 sm:p-7', className)}>{children}</AgeBandScope>
}

/** Loading, empty and error states keep the page layout; Co thinks while the server answers. */
export function LearnSkeleton({ band, label, rows = 3 }: { band: LearnBand; label: string; rows?: number }) {
  return <LearnFrame band={band}>
    <div role="status" aria-live="polite" aria-label={label} data-state="loading" className="space-y-5">
      <span className="sr-only">{label}</span>
      <div className="flex items-center gap-4"><CoCharacter band={band} state="thinking" decorative /><Skeleton className="h-10 w-56 max-w-full" /></div>
      <Skeleton className="h-44 w-full" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: rows }, (_, index) => <Skeleton key={index} className="h-32 w-full" />)}</div>
    </div>
  </LearnFrame>
}

/** Denied (403/404, no existence leak), expired session, and unavailable-with-retry. */
export function LearnLoadError({ error, retry, band = 'teens', backHref, backLabel, linkHelp }: { error: Error; retry: () => void; band?: LearnBand; backHref?: string; backLabel?: string; linkHelp?: boolean }) {
  const status = (error as { status?: number }).status
  const denied = status === 403 || status === 404
  const ended = error instanceof LearnSessionError
  const title = denied ? 'You cannot open this' : ended ? 'Your learning session ended' : 'This could not load'
  return <LearnFrame band={band}>
    <div data-state={denied ? 'denied' : ended ? 'session-ended' : 'unavailable'}>
      <ErrorState band={band} title={title} description={error.message} action={<div className="flex flex-wrap justify-center gap-3">
        {(linkHelp ?? needsLinkHelp(error)) && <SeeWhatsNeededLink />}
        {!denied && !ended && <Button onClick={retry}>Try again</Button>}
        {ended && <Link href="/learner" className="ds-button ds-button-primary">Check learner access</Link>}
        {backHref && <Link href={backHref} className="ds-button ds-button-secondary">{backLabel ?? 'Go back'}</Link>}
      </div>} />
    </div>
  </LearnFrame>
}
export const isDenied = (error: unknown) => error instanceof LearnApiError && (error.status === 403 || error.status === 404)

/* ---------- small shared pieces ---------- */

const noRoute = 'This part of CoLearner is still being built.'
/**
 * Renders a server action. A control is a working link only when the server says enabled AND the web
 * has a real route for it. Otherwise the server's reason is shown as visible text next to a disabled control.
 */
export function ActionControl({ action, label, variant = 'primary', className, block, href: hrefOverride }: { action: Actionable; label: string; variant?: 'primary' | 'secondary' | 'ghost'; className?: string; block?: boolean; /** B09: a screen that owns a more specific route than `linkHref` (the practice hub's own start button) passes it; still used only when the server says enabled. */ href?: string | null }) {
  const reasonId = useId()
  const href = action.enabled ? (hrefOverride !== undefined ? hrefOverride : linkHref(action.link)) : null
  if (href) return <Link href={href} className={cn('ds-button', `ds-button-${variant}`, block && 'w-full', className)}>{label}</Link>
  const reason = action.disabledReason ?? (action.enabled ? noRoute : 'This is not available right now.')
  return <div className={cn('grid min-w-0 gap-1', block && 'w-full')} data-action-state="unavailable">
    <Button variant={variant} disabled aria-disabled="true" aria-describedby={reasonId} className={cn(block && 'w-full', className)}>{label}</Button>
    <p id={reasonId} className="text-sm text-muted-foreground">{reason}</p>
  </div>
}

/** Stepping stones for kids: dots only, never a percentage. */
export function StepDots({ progress, label = 'steps' }: { progress: Progress; label?: string }) {
  const { done, total } = progress
  const text = `${done} of ${total} ${label} done`
  if (total <= 0) return null
  if (total > 12) return <p className="font-bold">{text}</p>
  return <div role="img" aria-label={text} className="flex flex-wrap items-center gap-2">
    {Array.from({ length: total }, (_, index) => <span key={index} aria-hidden="true" data-done={index < done} className={cn('block size-5 rounded-full border-2 border-primary', index < done && 'bg-primary')} />)}
    <span className="ms-2 text-[length:var(--ds-small)] font-bold">{text}</span>
  </div>
}

export function TimePill({ minutes }: { minutes: number }) {
  return <p role="status" className="ds-pill" data-testid="time-left"><Clock size={16} aria-hidden="true" />{minutes <= 0 ? 'No time left today' : `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} left today`}</p>
}

/** Visually and textually separates Co's suggestions from measured progress. */
export function CoSuggestionTag() {
  return <span className="ds-pill text-[var(--brand-orange,#cf5d0b)]" data-kind="co-suggestion"><Sparkles size={16} aria-hidden="true" />Co&rsquo;s suggestion</span>
}
export function MeasuredTag({ children = 'Your progress' }: { children?: ReactNode }) {
  return <span className="ds-pill" data-kind="measured">{children}</span>
}
export function LockedTag({ children }: { children: ReactNode }) {
  return <span className="ds-pill" data-kind="locked"><Lock size={16} aria-hidden="true" />{children}</span>
}
