'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { GraduationCap, LayoutDashboard } from 'lucide-react'
import { cn } from '@/lib/utils'

interface RoleSwitcherProps {
  className?: string
  compact?: boolean
}

export function RoleSwitcher({ className, compact = false }: RoleSwitcherProps) {
  const pathname = usePathname()
  const { data: session } = useSession()
  const isTeacher = session?.user?.roles?.includes('TEACHER') ?? false
  const onTeacherRoute = pathname.startsWith('/teacher')

  if (!isTeacher) {
    return (
      <Link
        href="/become-teacher"
        className={cn(
          'inline-flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs font-semibold text-primary transition-colors hover:bg-primary/10',
          className,
        )}
      >
        <GraduationCap className="h-3.5 w-3.5" />
        {compact ? 'Teach' : 'Become a teacher'}
      </Link>
    )
  }

  return (
    <Link
      href={onTeacherRoute ? '/dashboard' : '/teacher/dashboard'}
      className={cn(
        'inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground',
        className,
      )}
    >
      {onTeacherRoute ? (
        <>
          <LayoutDashboard className="h-3.5 w-3.5" />
          {compact ? 'Learn' : 'Switch to learning'}
        </>
      ) : (
        <>
          <GraduationCap className="h-3.5 w-3.5" />
          {compact ? 'Teach' : 'Teacher dashboard'}
        </>
      )}
    </Link>
  )
}