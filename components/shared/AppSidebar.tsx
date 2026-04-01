'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import {
  Home,
  Download,
  Clock,
  BarChart3,
  CalendarDays,
  Settings,
  Bell,
  MoreHorizontal,
  LogOut,
  User,
  Trophy,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { SourceProgress } from '@/lib/types'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface NavItem {
  href: string
  label: string
  icon: React.ElementType
}

const mainNavItems: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: Home },
  { href: '/capture', label: 'Capture', icon: Download },
  { href: '/recall', label: 'Recall', icon: Clock },
  { href: '/mastery', label: 'Mastery', icon: BarChart3 },
  { href: '/queue', label: 'Review Queue', icon: CalendarDays },
  { href: '/trophies', label: 'Trophies', icon: Trophy },
]

const settingsNavItems: NavItem[] = [
  { href: '/settings', label: 'Settings', icon: Settings },
  { href: '/settings/notifications', label: 'Notifications', icon: Bell },
]

interface AppSidebarProps {
  userName?: string
  userEmail?: string
  userInitials?: string
  sourceProgress?: SourceProgress | null
  recallDueCount?: number
  failedCount?: number
}

export function AppSidebar({
  userName = 'User',
  userEmail = '',
  userInitials = 'U',
  sourceProgress,
  recallDueCount = 0,
  failedCount = 0,
}: AppSidebarProps) {
  const pathname = usePathname()

  function isActive(href: string): boolean {
    if (href === '/dashboard') return pathname === '/dashboard'
    return pathname.startsWith(href)
  }

  function getBadge(item: NavItem): number | undefined {
    if (item.href === '/recall' && recallDueCount > 0) return recallDueCount
    if (item.href === '/queue' && failedCount > 0) return failedCount
    return undefined
  }

  function getBadgeVariant(item: NavItem): 'default' | 'warning' {
    if (item.href === '/queue') return 'warning'
    return 'default'
  }

  return (
    <aside className="flex w-60 flex-col border-r border-border bg-card">
      {/* Logo */}
      <div className="border-b border-border/50 px-5 py-5">
        <Link href="/dashboard" className="text-[17px] font-extrabold tracking-tight text-foreground">
          Co<span className="text-primary">Learner</span>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1 px-2.5 pt-3">
        {mainNavItems.map((item) => {
          const active = isActive(item.href)
          const badge = getBadge(item)
          const variant = getBadgeVariant(item)
          const Icon = item.icon

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors',
                active
                  ? 'bg-primary/10 font-bold text-primary'
                  : 'text-muted-foreground hover:bg-accent'
              )}
            >
              <Icon
                className={cn(
                  'h-[18px] w-[18px] shrink-0',
                  active ? 'text-primary' : 'text-muted-foreground/70'
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

        {/* Settings Section */}
        <div className="pt-3">
          <p className="px-3 pb-1.5 pt-3 text-[9px] font-bold uppercase tracking-widest text-muted-foreground/60">
            Settings
          </p>
          {settingsNavItems.map((item) => {
            const active = isActive(item.href)
            const Icon = item.icon

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors',
                  active
                    ? 'bg-primary/10 font-bold text-primary'
                    : 'text-muted-foreground hover:bg-accent'
                )}
              >
                <Icon
                  className={cn(
                    'h-[18px] w-[18px] shrink-0',
                    active ? 'text-primary' : 'text-muted-foreground/70'
                  )}
                />
                <span>{item.label}</span>
              </Link>
            )
          })}
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
                  {sourceProgress.totalAttempts} / {sourceProgress.requiredAttempts} recall attempts
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

      {/* User Footer */}
      <div className="border-t border-border/50 p-2.5">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<button className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 transition-colors hover:bg-accent" />}
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-extrabold text-primary">
              {userInitials}
            </div>
            <div className="flex-1 text-left">
              <p className="text-xs font-semibold text-foreground">{userName}</p>
              <p className="text-[10px] text-muted-foreground">{userEmail}</p>
            </div>
            <MoreHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem
              render={<Link href="/settings/profile" />}
              className="flex items-center gap-2"
            >
              <User className="h-4 w-4" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem
              render={<Link href="/settings" />}
              className="flex items-center gap-2"
            >
              <Settings className="h-4 w-4" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="flex items-center gap-2 text-destructive"
              onClick={() => signOut({ redirectTo: '/login' })}
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  )
}
