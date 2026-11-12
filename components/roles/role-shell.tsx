'use client'

import { useEffect, useId, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Dialog } from '@base-ui/react/dialog'
import { Popover } from '@base-ui/react/popover'
import { ChevronDown, Menu, X } from 'lucide-react'
import { BrandMark, CoCharacter, FoundationErrorBoundary, ThemeToggle } from '@/components/design-system'
import type { AgeBand } from '@/components/design-system'
import styles from './student-shell.module.css'
import { CoWorkspaceAssistant } from '@/components/co/co-workspace-assistant'
import { cn } from '@/lib/utils'
import { matchesNavItem, workspaceLabels } from './role-config'
import type { RoleNavGroup, RoleNavItem, WorkspaceRole } from './role-config'

export interface RoleShellProps {
  role: WorkspaceRole
  children: ReactNode
  navigation: RoleNavGroup[]
  homeHref: string
  band?: AgeBand
  identity?: string | null
  accountActions?: ReactNode
  sidebarFooter?: ReactNode
  bottomNavigation?: RoleNavItem[]
  /** Actual workspace name from membership data, when available. */
  workspaceName?: string
  navigationStyle?: 'header' | 'sidebar'
}

const focusClasses = 'focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring'

export function RoleNavigation({ groups, pathname, label, onNavigate, band = 'adults', horizontal = false }: {
  groups: RoleNavGroup[]; pathname: string; label: string; onNavigate?: () => void; band?: AgeBand; horizontal?: boolean
}) {
  const kids = band === 'kids'
  return <nav aria-label={label} className="space-y-6">
    {groups.map((group) => <div key={group.title}>
      {!horizontal && <p className="mb-2 px-3 text-xs font-bold tracking-wide text-muted-foreground">{group.title}</p>}
      <ul className={cn('space-y-1', kids && 'grid grid-cols-2 gap-2 space-y-0', horizontal && 'flex flex-wrap items-stretch justify-center gap-2 space-y-0')}>
        {group.items.map((item) => {
          const active = matchesNavItem(pathname, item)
          const Icon = item.icon
          return <li key={item.href} className="min-w-0">
            <Link href={item.href} onClick={onNavigate} aria-current={active ? 'page' : undefined}
              className={cn('flex min-h-[var(--ds-target,44px)] items-center gap-3 rounded-[var(--radius,14px)] px-3 py-2.5 text-[length:var(--ds-small,14px)] font-semibold motion-safe:transition-colors', focusClasses,
                kids && 'min-h-24 flex-col justify-center text-center text-[length:var(--ds-body,22px)]',
                active ? 'bg-secondary text-primary' : 'text-muted-foreground hover:bg-sidebar-accent hover:text-foreground')}
            >
              <Icon strokeWidth={1.8} aria-hidden="true" className={cn('size-5 shrink-0', kids && 'size-8')} />
              <span className="min-w-0 break-words">{item.label}</span>
              {item.badge !== undefined && <span className="ms-auto rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground"><span className="sr-only">Due: </span>{item.badge}</span>}
            </Link>
          </li>
        })}
      </ul>
    </div>)}
  </nav>
}

/**
 * Sticky top navigation (design: `<nav aria-label="Main">`). The first group is always visible and scrolls horizontally on narrow
 * screens; any further groups live behind a "More" disclosure so the full item set stays reachable without crowding the bar.
 */
export function TopNavigation({ groups, pathname, band = 'adults', moreFooter, className }: {
  groups: RoleNavGroup[]; pathname: string; band?: AgeBand; moreFooter?: ReactNode; className?: string
}) {
  const kids = band === 'kids'
  const [primary, ...rest] = groups
  const moreItems = rest.flatMap((group) => group.items)
  const [moreOpen, setMoreOpen] = useState(false)
  const moreActive = moreItems.some((item) => matchesNavItem(pathname, item))
  const hasMore = moreItems.length > 0 || !!moreFooter
  const itemClass = (active: boolean) => cn('relative flex items-center gap-2 whitespace-nowrap rounded-lg px-3 text-[length:var(--ds-small,15px)] font-semibold motion-safe:transition-colors',
    kids ? 'min-h-[84px] min-w-28 flex-col justify-center gap-1 rounded-[30px] px-3 py-2 text-center text-[length:var(--ds-body,19px)] font-extrabold' : 'min-h-[var(--ds-target,44px)]',
    focusClasses, active ? 'text-primary' : 'text-muted-foreground hover:text-foreground', kids && active && 'bg-secondary')
  const bar = (active: boolean) => !kids && active ? <span aria-hidden="true" className="absolute inset-x-3 bottom-0 h-[3px] rounded-full bg-primary" /> : null
  const icon = (Icon: RoleNavItem['icon'], big?: boolean) => <Icon strokeWidth={2} aria-hidden="true" className={cn('size-[18px] shrink-0', big && 'size-8')} />
  return <nav aria-label="Main" data-testid="top-navigation" className={cn('min-w-0 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden', className)}>
    <ul className="flex w-max min-w-full items-stretch gap-0.5 lg:w-auto lg:min-w-0 lg:justify-center">
      {(primary?.items ?? []).map((item) => {
        const active = matchesNavItem(pathname, item)
        return <li key={item.href} className="flex shrink-0">
          <Link href={item.href} aria-current={active ? 'page' : undefined} className={itemClass(active)}>
            {kids ? <span className={cn('grid size-14 place-items-center rounded-full', active ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground')}>{icon(item.icon, true)}</span> : icon(item.icon)}
            <span>{item.label}</span>
            {item.badge !== undefined && <span className="rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground"><span className="sr-only">Due: </span>{item.badge}</span>}
            {bar(active)}
          </Link>
        </li>
      })}
      {hasMore && <li className="flex shrink-0">
        <Popover.Root open={moreOpen} onOpenChange={setMoreOpen}>
          <Popover.Trigger className={cn(itemClass(moreActive), 'cursor-pointer')}>
            {kids ? <span className="grid size-14 place-items-center rounded-full bg-muted text-foreground"><ChevronDown strokeWidth={2} aria-hidden="true" className="size-8" /></span> : null}
            <span className="flex items-center gap-1.5">More{!kids && <ChevronDown strokeWidth={2} aria-hidden="true" className="size-4" />}</span>
            {bar(moreActive)}
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Positioner sideOffset={8} align="end" className="z-50">
              <Popover.Popup data-age-band={band} aria-label="More destinations" className="w-[min(18rem,calc(100vw-2rem))] rounded-2xl border border-border bg-card p-2 text-foreground shadow-xl outline-none">
                <ul className="space-y-0.5">
                  {moreItems.map((item) => {
                    const active = matchesNavItem(pathname, item)
                    const Icon = item.icon
                    return <li key={item.href}>
                      <Link href={item.href} onClick={() => setMoreOpen(false)} aria-current={active ? 'page' : undefined}
                        className={cn('flex min-h-[var(--ds-target,44px)] items-center gap-3 rounded-xl px-3 text-[length:var(--ds-small,15px)] font-semibold', focusClasses, active ? 'bg-secondary text-primary' : 'text-foreground hover:bg-muted')}>
                        <Icon strokeWidth={2} aria-hidden="true" className="size-[18px] shrink-0" /><span className="min-w-0 break-words">{item.label}</span>
                      </Link>
                    </li>
                  })}
                </ul>
                {moreFooter && <div className="mt-2 border-t border-border p-2">{moreFooter}</div>}
              </Popover.Popup>
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>
      </li>}
    </ul>
  </nav>
}

/** A presentation boundary, never a substitute for server role/resource guards. */
export function RoleShell({ role, children, navigation, homeHref, band = 'adults', identity, accountActions, sidebarFooter, bottomNavigation, workspaceName, navigationStyle }: RoleShellProps) {
  const pathname = usePathname()
  const id = useId().replace(/:/g, '')
  const mainId = `workspace-main-${id}`
  const [menuOpen, setMenuOpen] = useState(false)
  const quickNavigationRef = useRef<HTMLElement>(null)
  const [quickNavigationHeight, setQuickNavigationHeight] = useState<number>()
  const workspaceLabel = workspaceName || workspaceLabels[role]
  const kids = band === 'kids'
  const coAssistant = role === 'student' ? <CoWorkspaceAssistant band={band === 'adults' ? 'teens' : band} pathname={pathname} /> : null
  const sidebar = (navigationStyle ?? (role === 'platform-admin' || role === 'school-admin' ? 'sidebar' : 'header')) === 'sidebar'
  // Design: parent keeps a bottom tab bar on phones; learner/teacher scroll the top bar; sidebar roles keep their quick bar.
  const bottomItems = sidebar || role === 'parent' ? (bottomNavigation ?? navigation[0]?.items.slice(0, 5) ?? []) : []

  useEffect(() => {
    const quickNavigation = quickNavigationRef.current
    if (!quickNavigation) return
    // Translated labels, text zoom, loaded fonts and safe-area padding can all
    // change the fixed bar's height. Reserve its actual border-box, not a guess.
    const measure = () => setQuickNavigationHeight(Math.ceil(quickNavigation.getBoundingClientRect().height))
    measure()
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : undefined
    observer?.observe(quickNavigation)
    window.addEventListener('resize', measure)
    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [bottomItems.length])

  useEffect(() => {
    const query = window.matchMedia?.('(min-width: 1024px)')
    if (!query) return
    const closeOnDesktop = () => { if (query.matches) setMenuOpen(false) }
    query.addEventListener('change', closeOnDesktop)
    return () => query.removeEventListener('change', closeOnDesktop)
  }, [])

  const closeMenu = () => setMenuOpen(false)
  const skipToContent = () => document.getElementById(mainId)?.focus()

  return <div data-role={role} data-age-band={band} className={cn("min-h-dvh bg-background text-foreground", role === 'student' && styles.student)} style={quickNavigationHeight === undefined ? undefined : { '--role-quick-nav-inset': `${quickNavigationHeight}px` } as CSSProperties}>
    <a href={`#${mainId}`} onClick={skipToContent} className={cn('fixed start-4 top-3 z-[100] inline-flex min-h-[var(--ds-target,44px)] min-w-[var(--ds-target,44px)] -translate-y-24 items-center justify-center rounded-xl bg-foreground px-5 py-3 font-semibold text-background focus:translate-y-0', focusClasses)}>Skip to content</a>
    <div className={cn(sidebar && 'flex min-h-dvh')}>
      {sidebar && <aside aria-label={`${workspaceLabel} sidebar`} className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col overflow-y-auto border-e border-sidebar-border bg-sidebar lg:flex">
        <div className="border-b border-sidebar-border p-5">
          <Link href={homeHref} aria-label="CoLearner home" className={cn('inline-flex min-h-[var(--ds-target,44px)] min-w-[var(--ds-target,44px)] items-center justify-center rounded-lg', focusClasses)}><BrandMark /></Link>
          <p className="mt-4 text-sm font-semibold text-muted-foreground">{workspaceLabel}</p>
          {identity && <p className="mt-1 break-words text-xs text-muted-foreground">{identity}</p>}
        </div>
        <div className="flex-1 p-3"><RoleNavigation groups={navigation} pathname={pathname} label="Primary navigation" band={band} /></div>
        {sidebarFooter && <div className="border-t border-sidebar-border p-4">{sidebarFooter}</div>}
        <div className="flex items-center gap-3 border-t border-sidebar-border p-4"><CoCharacter band={band} state="idle" size={kids ? 72 : 36} decorative /><span className="text-sm font-semibold">Your learning companion</span></div>
      </aside>}
      <div className={cn('min-w-0', sidebar && 'flex-1')}>
        {sidebar ? <header className="flex min-h-18 flex-wrap items-center gap-3 border-b border-border bg-card px-4 py-3 sm:px-6">
          <Dialog.Root open={menuOpen} onOpenChange={setMenuOpen}>
            <Dialog.Trigger render={<button type="button" className={cn('flex min-h-[var(--ds-target,44px)] min-w-[var(--ds-target,44px)] items-center justify-center rounded-xl border border-border bg-background lg:hidden', focusClasses)} />} aria-label="Open navigation">
              <Menu aria-hidden="true" className="size-6" />
            </Dialog.Trigger>
            <Dialog.Portal>
              <Dialog.Backdrop className="fixed inset-0 z-50 bg-foreground/40" />
              <Dialog.Popup data-age-band={band} className="fixed inset-y-0 start-0 z-50 flex w-[min(22rem,90vw)] flex-col overflow-y-auto border-e border-border bg-sidebar p-4 shadow-xl outline-none" initialFocus={true}>
                <div className="mb-5 flex items-center justify-between gap-3">
                  <Dialog.Title className="font-bold">Navigation</Dialog.Title>
                  <Dialog.Close render={<button type="button" className={cn('flex min-h-[var(--ds-target,44px)] min-w-[var(--ds-target,44px)] items-center justify-center rounded-xl hover:bg-sidebar-accent', focusClasses)} />} aria-label="Close navigation"><X aria-hidden="true" className="size-6" /></Dialog.Close>
                </div>
                <Dialog.Description className="mb-5 text-sm text-muted-foreground">{workspaceLabel}</Dialog.Description>
                <RoleNavigation groups={navigation} pathname={pathname} label="Drawer navigation" onNavigate={closeMenu} band={band} />
                {sidebarFooter && <div className="mt-5 border-t border-sidebar-border pt-4">{sidebarFooter}</div>}
              </Dialog.Popup>
            </Dialog.Portal>
          </Dialog.Root>
          <Link href={homeHref} aria-label="CoLearner home" className={cn('inline-flex min-h-[var(--ds-target,44px)] min-w-[var(--ds-target,44px)] items-center justify-center rounded-lg lg:hidden', focusClasses)}><BrandMark compact={kids} /></Link>
          <div className="min-w-0 flex-1"><p className="break-words text-sm font-semibold">{workspaceLabel}</p>{identity && <p className="break-words text-xs text-muted-foreground">{identity}</p>}</div>
          {coAssistant}{role === 'student' && <ThemeToggle />}
          {accountActions && <div className="flex shrink-0 items-center gap-2">{accountActions}</div>}
        </header> : <header data-testid="top-header" className="sticky top-0 z-40 border-b border-border bg-background">
          <div className={cn('mx-auto flex w-full max-w-[1320px] flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2 sm:px-6 lg:flex-nowrap lg:gap-x-5', styles.headerRow)}>
            <Link href={homeHref} aria-label="CoLearner home" className={cn('inline-flex min-h-[var(--ds-target,44px)] shrink-0 items-center gap-2.5 rounded-lg', focusClasses)}>
              <BrandMark compact={kids} />
              <span className="hidden rounded-full bg-secondary px-2.5 py-0.5 text-xs font-extrabold text-primary sm:inline-flex">{workspaceLabel}</span>
            </Link>
            <span className="ms-auto flex shrink-0 items-center gap-2 lg:order-last lg:ms-0">
              {identity && <span className="hidden max-w-48 truncate text-xs font-semibold text-muted-foreground xl:inline" title={identity}>{identity}</span>}
              {coAssistant ?? <span className="hidden shrink-0 md:block" title="Your learning companion"><CoCharacter band={band} state="idle" size={kids ? 56 : 32} decorative /><span className="sr-only">Your learning companion</span></span>}
              {role === 'student' && <ThemeToggle />}
              {accountActions && <div className="flex shrink-0 items-center gap-2">{accountActions}</div>}
            </span>
            <TopNavigation groups={navigation} pathname={pathname} band={band} moreFooter={sidebarFooter} className="order-last w-full basis-full lg:order-none lg:w-auto lg:basis-0 lg:flex-1" />
          </div>
        </header>}
        <main id={mainId} tabIndex={-1} className={cn('mx-auto min-w-0 outline-none', !sidebar && 'w-full max-w-[1320px]', bottomItems.length > 0 && 'pb-[var(--role-quick-nav-inset,calc(6rem+env(safe-area-inset-bottom)))] lg:pb-0')}><FoundationErrorBoundary>{children}</FoundationErrorBoundary></main>
      </div>
    </div>
    {bottomItems.length > 0 && <nav ref={quickNavigationRef} aria-label="Quick navigation" className="fixed inset-x-0 bottom-0 z-30 flex border-t border-border bg-card px-1 pb-[env(safe-area-inset-bottom)] lg:hidden">
      {bottomItems.map((item) => {
        const active = matchesNavItem(pathname, item)
        const Icon = item.icon
        return <Link key={item.href} href={item.href} aria-current={active ? 'page' : undefined} className={cn('flex min-h-[var(--ds-target,44px)] min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-1 py-3 text-center text-xs font-semibold', focusClasses, kids && 'min-h-20 text-[length:var(--ds-caption,15px)]', active ? 'bg-primary/10 text-primary' : 'text-foreground')}><Icon strokeWidth={1.8} aria-hidden="true" className={cn('size-5', kids && 'size-7')} /><span className="break-words">{item.label}</span></Link>
      })}
    </nav>}
  </div>
}
