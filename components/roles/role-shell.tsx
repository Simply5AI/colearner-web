'use client'

import { useEffect, useId, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Dialog } from '@base-ui/react/dialog'
import { Menu, X } from 'lucide-react'
import { BrandMark, CoCharacter, FoundationErrorBoundary, ThemeToggle } from '@/components/design-system'
import type { AgeBand } from '@/components/design-system'
import styles from './student-shell.module.css'
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
  const sidebar = (navigationStyle ?? (role === 'platform-admin' || role === 'school-admin' ? 'sidebar' : 'header')) === 'sidebar'
  const bottomItems = bottomNavigation ?? navigation[0]?.items.slice(0, 5) ?? []

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
    <div className="flex min-h-dvh">
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
      <div className="min-w-0 flex-1">
        <header className="flex min-h-18 flex-wrap items-center gap-3 border-b border-border bg-card px-4 py-3 sm:px-6">
          <Dialog.Root open={menuOpen} onOpenChange={setMenuOpen}>
            <Dialog.Trigger render={<button type="button" className={cn('flex min-h-[var(--ds-target,44px)] min-w-[var(--ds-target,44px)] items-center justify-center rounded-xl border border-border bg-background', sidebar && 'lg:hidden', focusClasses)} />} aria-label="Open navigation">
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
          <Link href={homeHref} aria-label="CoLearner home" className={cn('inline-flex min-h-[var(--ds-target,44px)] min-w-[var(--ds-target,44px)] items-center justify-center rounded-lg', sidebar && 'lg:hidden', focusClasses)}><BrandMark compact={kids} /></Link>
          <div className={cn("min-w-0 flex-1", role === 'student' && styles.identity)}><p className="break-words text-sm font-semibold">{workspaceLabel}</p>{identity && <p className="break-words text-xs text-muted-foreground">{identity}</p>}</div>
          {!sidebar && <div className="hidden shrink-0 md:block"><CoCharacter band={band} state="idle" size={kids ? 72 : band === 'tweens' ? 48 : 28} decorative /></div>}
          {role === 'student' && <ThemeToggle />}
          {accountActions && <div className="flex shrink-0 items-center gap-2">{accountActions}</div>}
          {!sidebar && <div className="hidden w-full border-t border-border pt-3 lg:block"><RoleNavigation groups={navigation.slice(0, 1)} pathname={pathname} label="Primary navigation" band={band} horizontal /></div>}
        </header>
        <main id={mainId} tabIndex={-1} className={cn('min-w-0 outline-none', bottomItems.length > 0 && 'pb-[var(--role-quick-nav-inset,calc(6rem+env(safe-area-inset-bottom)))] lg:pb-0')}><FoundationErrorBoundary>{children}</FoundationErrorBoundary></main>
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
