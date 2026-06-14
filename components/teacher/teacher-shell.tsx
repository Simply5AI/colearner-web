'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  BarChart3,
  BookOpen,
  GraduationCap,
  LayoutDashboard,
  Users,
} from 'lucide-react'
import { cn } from '@/lib/utils'


type TeacherNavItem = {
  href: string
  label: string
  icon: typeof LayoutDashboard
}

const teachNavItems: TeacherNavItem[] = [
  { href: '/teacher/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/teacher/plans', label: 'Study Plans', icon: BookOpen },
  { href: '/teacher/students', label: 'Students', icon: Users },
  { href: '/teacher/analytics', label: 'Analytics', icon: BarChart3 },
]

interface TeacherShellProps {
  children: React.ReactNode
  teacherName?: string
}

export function TeacherShell({ children, teacherName }: TeacherShellProps) {
  const pathname = usePathname()

  function isActive(href: string): boolean {
    return pathname === href || pathname.startsWith(`${href}/`)
  }

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-60 flex-col border-r border-sidebar-border bg-sidebar">
        <div className="border-b border-sidebar-border/70 px-5 py-5">
          <Link href="/teacher/dashboard" className="text-[17px] font-extrabold tracking-tight text-foreground">
            Co<span className="text-primary">Learner</span>
          </Link>
          <p className="mt-1 flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
            <GraduationCap className="h-3.5 w-3.5 text-primary" />
            Teacher workspace
          </p>
          {teacherName && (
            <p className="mt-0.5 truncate text-[11px] text-muted-foreground/80">{teacherName}</p>
          )}
        </div>

        <nav className="flex-1 space-y-4 px-2.5 pt-3">
          <div>
            <p className="px-3 pb-1.5 text-[9px] font-bold uppercase tracking-widest text-muted-foreground/60">
              Teach
            </p>
            <div className="space-y-1">
              {teachNavItems.map((item) => {
                const active = isActive(item.href)
                const Icon = item.icon

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'group relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors',
                      active
                        ? 'bg-primary/10 font-bold text-primary shadow-[inset_3px_0_0_var(--primary)]'
                        : 'text-muted-foreground hover:bg-sidebar-accent hover:text-foreground',
                    )}
                  >
                    <Icon
                      className={cn(
                        'h-[18px] w-[18px] shrink-0 transition-colors',
                        active ? 'text-primary' : 'text-muted-foreground/70 group-hover:text-foreground',
                      )}
                    />
                    <span>{item.label}</span>
                  </Link>
                )
              })}
            </div>
          </div>

        </nav>

        <div className="border-t border-sidebar-border/70 p-2.5" />
      </aside>

      <main className="flex-1 overflow-y-auto bg-background">{children}</main>
    </div>
  )
}