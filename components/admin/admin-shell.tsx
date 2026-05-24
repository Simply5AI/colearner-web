'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Activity,
  BarChart3,
  BookOpen,
  Building2,
  CreditCard,
  Gauge,
  Library,
  Search,
  Shield,
  Sparkles,
  Users,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const navGroups = [
  {
    title: 'Overview',
    items: [{ href: '/admin', label: 'Dashboard', icon: Gauge }],
  },
  {
    title: 'Users & Orgs',
    items: [
      { href: '/admin/users', label: 'Users', icon: Users },
      { href: '/admin/orgs', label: 'Organizations', icon: Building2 },
      { href: '/admin/roles', label: 'Roles', icon: Shield },
    ],
  },
  {
    title: 'Learning',
    items: [{ href: '/admin/users', label: 'Learning views', icon: BookOpen }],
  },
  {
    title: 'Content',
    items: [
      { href: '/admin/content/extractions', label: 'Extractions', icon: Library },
      { href: '/admin/content/pods', label: 'Pods', icon: Activity },
    ],
  },
  {
    title: 'Billing',
    items: [{ href: '/admin/billing', label: 'Billing', icon: CreditCard }],
  },
  {
    title: 'AI & Costs',
    items: [
      { href: '/admin/ai-consumption', label: 'Consumption', icon: Sparkles },
    ],
  },
]

interface AdminShellProps {
  children: React.ReactNode
  adminEmail?: string | null
}

export function AdminShell({ children, adminEmail }: AdminShellProps) {
  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <AdminSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <AdminTopbar adminEmail={adminEmail} />
        <main className="min-w-0 flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  )
}

function AdminSidebar() {
  const pathname = usePathname()

  return (
    <aside className="hidden w-64 shrink-0 border-r border-sidebar-border bg-sidebar lg:flex lg:flex-col">
      <div className="border-b border-sidebar-border/70 px-5 py-5">
        <Link href="/admin" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-foreground text-xs font-black text-background">
            CL
          </span>
          <span className="text-[17px] font-extrabold tracking-tight">
            Co<span className="text-primary">Learner</span>
          </span>
        </Link>
        <div className="mt-3 inline-flex items-center rounded-md border border-primary/20 bg-primary/10 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-primary">
          Admin
        </div>
      </div>

      <nav className="flex-1 space-y-4 px-2.5 pt-3">
        {navGroups.map((group) => (
          <div key={group.title}>
            <p className="px-3 pb-1.5 text-[9px] font-bold uppercase tracking-widest text-muted-foreground/60">
              {group.title}
            </p>
            <div className="space-y-1">
              {group.items.map((item) => {
                const Icon = item.icon
                const active =
                  item.href === '/admin'
                    ? pathname === '/admin'
                    : pathname.startsWith(item.href)

                return (
                  <Link
                    key={`${group.title}-${item.href}-${item.label}`}
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
                    <span className="min-w-0 truncate">{item.label}</span>
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  )
}

function AdminTopbar({ adminEmail }: { adminEmail?: string | null }) {
  return (
    <header className="sticky top-0 z-20 border-b border-border/70 bg-background/95 px-4 py-3 backdrop-blur md:px-6">
      <div className="flex items-center gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="hidden h-8 min-w-72 items-center gap-2 rounded-lg border border-border bg-card px-3 text-sm text-muted-foreground shadow-sm md:flex">
            <Search className="h-4 w-4" />
            <span className="truncate">Search users, orgs, content</span>
            <kbd className="ml-auto rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-semibold">
              cmd+k
            </kbd>
          </div>
        </div>
        <div className="hidden rounded-md border border-border bg-card px-2.5 py-1.5 text-xs font-semibold text-muted-foreground sm:block">
          Development
        </div>
        <div className="min-w-0 text-right">
          <p className="truncate text-sm font-semibold">{adminEmail ?? 'Super Admin'}</p>
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Super admin</p>
        </div>
      </div>
    </header>
  )
}
