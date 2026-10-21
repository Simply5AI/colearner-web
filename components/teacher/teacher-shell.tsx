'use client'

import { signOut } from 'next-auth/react'
import { LogOut } from 'lucide-react'
import { RoleShell } from '@/components/roles/role-shell'
import { teacherNavigation } from '@/components/roles/role-config'

interface TeacherShellProps {
  children: React.ReactNode
  teacherName?: string
}

export function TeacherShell({ children, teacherName }: TeacherShellProps) {
  return <RoleShell role="teacher" homeHref="/teacher/dashboard" navigation={teacherNavigation} identity={teacherName}
    accountActions={<button type="button" onClick={() => void signOut({ redirectTo: '/login' })} aria-label="Sign out" className="flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-border bg-card focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"><LogOut aria-hidden="true" className="size-5" /></button>}
  >{children}</RoleShell>
}
