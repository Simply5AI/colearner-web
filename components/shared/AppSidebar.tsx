'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Home,
  Download,
  Clock,
  BarChart3,
  Settings,
  Trophy,
  BookOpen,
  Users,
  History,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useLearnerTerms } from '@/lib/hooks/use-learner-terms'
import type { SourceProgress } from '@/lib/types'

interface NavItem {
  href: string
  label: string
  icon: React.ElementType
}

interface NavSection {
  title: string
  items: NavItem[]
}

function getNavSections(plansLabel: string): NavSection[] {
  return [
    {
      title: 'Learn',
      items: [
        { href: '/dashboard', label: 'Home', icon: Home },
        { href: '/capture', label: 'Library', icon: Download },
        { href: '/roadmaps', label: plansLabel, icon: BookOpen },
      ],
    },
    {
      title: 'Practice',
      items: [
        { href: '/practice', label: 'Practice', icon: Clock },
        { href: '/mastery', label: 'Progress', icon: BarChart3 },
        { href: '/trophies', label: 'Achievements', icon: Trophy },
      ],
    },
    {
      title: 'Together',
      items: [
        { href: '/pods', label: 'Study Groups', icon: Users },
        { href: '/dashboard/history', label: 'History', icon: History },
      ],
    },
  ]
}

const settingsNavItems: NavItem[] = [
  { href: '/settings', label: 'Settings', icon: Settings },
]

interface AppSidebarProps {
  sourceProgress?: SourceProgress | null
  recallDueCount?: number
  failedCount?: number
}

export function AppSidebar({
  sourceProgress,
  recallDueCount = 0,
  failedCount: _failedCount = 0,
}: AppSidebarProps) {
  const pathname = usePathname()
  const terms = useLearnerTerms()

  function isActive(href: string): boolean {
    if (href === '/dashboard') return pathname === '/dashboard'
    if (href === '/practice') return pathname.startsWith('/practice') || pathname.startsWith('/recall')
    return pathname.startsWith(href)
  }

  function getBadge(item: NavItem): number | undefined {
    if (item.href === '/practice' && recallDueCount > 0) return recallDueCount
    return undefined
  }

  function getBadgeVariant(_item: NavItem): 'default' | 'warning' {
    return 'default'
  }

  return (
    <aside className="flex w-60 flex-col border-r border-sidebar-border bg-sidebar">
      {/* Logo */}
      <div className="border-b border-sidebar-border/70 px-5 py-5">
        <Link href="/dashboard" className="text-[17px] font-extrabold tracking-tight text-foreground">
          Co<span className="text-primary">Learner</span>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-4 px-2.5 pt-3">
        {getNavSections(terms.plansLabel).map((section) => (
          <div key={section.title}>
            <p className="px-3 pb-1.5 text-[9px] font-bold uppercase tracking-widest text-muted-foreground/60">
              {section.title}
            </p>
            <div className="space-y-1">
              {section.items.map((item) => {
                const active = isActive(item.href)
                const badge = getBadge(item)
                const variant = getBadgeVariant(item)
                const Icon = item.icon

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'group relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors',
                      active
                        ? 'bg-primary/10 font-bold text-primary shadow-[inset_3px_0_0_var(--primary)]'
                        : 'text-muted-foreground hover:bg-sidebar-accent hover:text-foreground'
                    )}
                  >
                    <Icon
                      className={cn(
                        'h-[18px] w-[18px] shrink-0 transition-colors',
                        active ? 'text-primary' : 'text-muted-foreground/70 group-hover:text-foreground'
                      )}
                    />
                    <span className="flex-1">{item.label}</span>
                    {badge !== undefined && (
                      <span
                        className={cn(
                          'min-w-5 rounded-full px-1.5 py-0.5 text-center text-[10px] font-bold text-white',
                          variant === 'warning' ? 'bg-warning' : 'bg-primary'
                        )}
                      >
                        {badge}
                      </span>
                    )}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}

        {/* Settings Section */}
        <div>
          <p className="px-3 pb-1.5 pt-2 text-[9px] font-bold uppercase tracking-widest text-muted-foreground/60">
            Account
          </p>
          <div className="space-y-1">
            {settingsNavItems.map((item) => {
              const active = isActive(item.href)
              const Icon = item.icon

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'group flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors',
                    active
                      ? 'bg-primary/10 font-bold text-primary shadow-[inset_3px_0_0_var(--primary)]'
                      : 'text-muted-foreground hover:bg-sidebar-accent hover:text-foreground'
                  )}
                >
                  <Icon
                    className={cn(
                      'h-[18px] w-[18px] shrink-0 transition-colors',
                      active ? 'text-primary' : 'text-muted-foreground/70 group-hover:text-foreground'
                    )}
                  />
                  <span>{item.label}</span>
                </Link>
              )
            })}
          </div>
        </div>

        {/* Source Progress Mini Card */}
        {sourceProgress && (
          <div className="mx-0.5 mt-4 rounded-xl border border-border/50 bg-accent/50 p-3.5">
            <div className="mb-2.5 flex items-center gap-2.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-teal to-[#2A9494] text-base font-black text-white">
                {sourceProgress.currentSource}
              </div>
              <div>
                <p className="text-xs font-bold text-foreground">
                  Source {sourceProgress.currentSource} — {sourceProgress.sourceName}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {sourceProgress.totalAttempts} / {sourceProgress.requiredAttempts} practice attempts
                </p>
              </div>
            </div>
            <div className="h-1 overflow-hidden rounded-full bg-border">
              <div
                className="h-full rounded-full bg-brand-teal transition-all duration-500"
                style={{
                  width: `${Math.min(100, (sourceProgress.totalAttempts / sourceProgress.requiredAttempts) * 100)}%`,
                }}
              />
            </div>
            <div className="mt-1 flex justify-between text-[9px] text-muted-foreground">
              <span>
                {Math.round((sourceProgress.totalAttempts / sourceProgress.requiredAttempts) * 100)}% complete
              </span>
              <span>
                {sourceProgress.requiredAttempts - sourceProgress.totalAttempts} to go
              </span>
            </div>
          </div>
        )}
      </nav>

      <div className="border-t border-sidebar-border/70 p-2.5" />
    </aside>
  )
}
