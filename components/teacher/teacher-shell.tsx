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

const navItems: TeacherNavItem[] = [
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

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-60 flex-col border-r border-sidebar-border bg-sidebar">
        <div className="border-b border-sidebar-border/70 px-5 py-5">
          <Link href="/teacher/dashboard" className="flex items-center gap-2 text-[17px] font-extrabold tracking-tight text-foreground">
            <GraduationCap className="h-5 w-5 text-brand-teal" />
            Teacher
          </Link>
          {teacherName && (
            <p className="mt-1 truncate text-xs text-muted-foreground">{teacherName}</p>
          )}
        </div>

        <nav className="flex-1 space-y-1 p-3">
          {navItems.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`)
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  active
                    ? 'bg-brand-teal/10 text-brand-teal'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="border-t border-sidebar-border/70 p-3">
          <Link
            href="/dashboard"
            className="block rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            ← Back to student view
          </Link>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto bg-background">{children}</main>
    </div>
  )
}