'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Flag, Search } from 'lucide-react'
import { BrandMark, ThemeToggle } from '@/components/design-system'
import { cn } from '@/lib/utils'
import { buildTutorHref } from '@/lib/tutor-loop/open-tutor'
import { TutorAccessibilityApplier } from '@/components/tutor-loop/me/accessibility-applier'
import { SearchOverlay } from '@/components/tutor-loop/search/search-overlay'
import { tutorIconSrc, useTutorShell } from './tutor-shell-context'
import { tutorNavItems } from './tutor-nav'

const focus = 'focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring'

/** Header for the Today / Learn / Practice shell: nav, Search, countdown pill, Ask Co with the learner's tutor, Me. */
export function TutorHeader({ homeHref, initial, accountActions }: { homeHref: string; initial: string; accountActions?: React.ReactNode }) {
  const pathname = usePathname()
  const shell = useTutorShell()
  const [searchOpen, setSearchOpen] = useState(false)
  const onCo = pathname.startsWith('/learn/co')
  const onMe = pathname.startsWith('/learn/me')
  return <>
    <TutorAccessibilityApplier />
    <header data-testid="top-header" data-tutor-shell="true" className="sticky top-0 z-40 shrink-0 border-b border-border bg-background">
      <div className="tutor-frame flex items-center gap-2 py-2 sm:gap-3">
        <Link href={homeHref} aria-label="CoLearner home" className={cn('inline-flex min-h-[var(--ds-target,44px)] shrink-0 items-center rounded-lg', focus)}><BrandMark className="max-[430px]:[&>span:last-child>span]:hidden" /></Link>
        <nav aria-label="Main" data-testid="top-navigation" className="hidden min-w-0 flex-1 justify-center lg:flex">
          <ul className="flex items-stretch gap-1">
            {tutorNavItems.map((item) => {
              const active = item.match(pathname)
              const Icon = item.icon
              return <li key={item.href}><Link href={item.href} aria-current={active ? 'page' : undefined}
                className={cn('relative flex min-h-[var(--ds-target,44px)] items-center gap-2 rounded-lg px-4 text-[length:var(--ds-small,15px)] font-bold', focus, active ? 'bg-secondary text-primary' : 'text-muted-foreground hover:text-foreground')}>
                <Icon aria-hidden="true" strokeWidth={2} className="size-[18px]" />{item.label}</Link></li>
            })}
          </ul>
        </nav>
        <div className="ms-auto flex shrink-0 items-center gap-1.5 sm:gap-2 lg:ms-0">
          <button type="button" onClick={() => setSearchOpen(true)} aria-label="Search everything" aria-haspopup="dialog"
            className={cn('flex min-h-[var(--ds-target,44px)] items-center gap-2 rounded-full border border-border bg-card px-3 text-sm font-semibold', focus)}>
            <Search aria-hidden="true" className="size-4" /><span className="hidden sm:inline">Search</span>
          </button>
          {shell.nextExam && <Link href={`/learn/practice?tab=exam&goalId=${encodeURIComponent(shell.nextExam.goal.id)}`} data-testid="countdown-pill"
            className={cn('hidden min-h-[var(--ds-target,44px)] items-center gap-1.5 rounded-full bg-secondary px-3 text-sm font-bold text-primary md:flex', focus)}>
            <Flag aria-hidden="true" className="size-4" /><span className="max-w-32 truncate">{shell.nextExam.goal.title}</span> · {shell.nextExam.label}</Link>}
          <Link href={buildTutorHref({ kind: 'GLOBAL' })} aria-current={onCo ? 'page' : undefined} data-testid="ask-tutor"
            className={cn('flex min-h-[var(--ds-target,44px)] items-center gap-2 rounded-full border px-2.5 text-sm font-bold', focus, onCo ? 'border-primary bg-primary text-primary-foreground' : 'border-primary/30 bg-primary/10 text-primary')}>
            <img src={tutorIconSrc(shell.tutorIcon, shell.canUseTutor ? 'idle' : 'resting')} alt="" className="size-8 rounded-full" />
            <span className="hidden sm:inline">{shell.canUseTutor ? `Ask ${shell.tutorName}` : `${shell.tutorName} is resting`}</span>
          </Link>
          <ThemeToggle />
          <Link href="/learn/me" aria-label="Me" aria-current={onMe ? 'page' : undefined} data-testid="me-link"
            className={cn('grid size-11 place-items-center rounded-full text-base font-extrabold', focus, onMe ? 'bg-primary text-primary-foreground' : 'bg-secondary text-primary')}>{initial}</Link>
          {accountActions}
        </div>
      </div>
    </header>
    {searchOpen && <SearchOverlay onClose={() => setSearchOpen(false)} />}
  </>
}

/** Phone bottom navigation (below 1024px). */
export function TutorBottomNav({ inFlow = false }: { inFlow?: boolean }) {
  const pathname = usePathname()
  return <nav aria-label="Quick navigation" data-testid="phone-nav" className={cn('z-30 flex shrink-0 border-t border-border bg-card px-1 pb-[env(safe-area-inset-bottom)] lg:hidden', !inFlow && 'fixed inset-x-0 bottom-0')}>
    {tutorNavItems.map((item) => {
      const active = item.match(pathname)
      const Icon = item.icon
      return <Link key={item.href} href={item.href} aria-current={active ? 'page' : undefined}
        className={cn('flex min-h-[var(--ds-target,44px)] min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-1 py-3 text-center text-xs font-semibold', focus, active ? 'bg-primary/10 text-primary' : 'text-foreground')}>
        <Icon aria-hidden="true" strokeWidth={1.8} className="size-5" /><span>{item.label}</span></Link>
    })}
  </nav>
}
