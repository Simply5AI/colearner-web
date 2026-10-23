'use client'

import { signOut } from 'next-auth/react'
import { LogOut } from 'lucide-react'
import { RoleShell } from '@/components/roles/role-shell'
import { teacherNavigation } from '@/components/roles/role-config'

interface TeacherShellProps {
  children: React.ReactNode
  teacherName?: string
  /** Verified school name from the workspace membership, when one is selected. */
  schoolName?: string
  /** Legacy org-wide TEACHER role. School-only teachers cannot use the legacy pages yet. */
  legacyRole?: boolean
}

/** Legacy pages (B13/B14 migrate them) that need the legacy role, with the reason shown to school-only teachers. */
const LEGACY_ONLY_HREFS = new Set(['/teacher/students', '/teacher/analytics'])

export function TeacherShell({ children, teacherName, schoolName, legacyRole = true }: TeacherShellProps) {
  const navigation = legacyRole
    ? teacherNavigation
    : teacherNavigation.map((group) => ({
        ...group,
        items: group.items.filter((item) => !LEGACY_ONLY_HREFS.has(item.href)),
      }))
  const later = legacyRole ? [] : teacherNavigation.flatMap((group) => group.items.filter((item) => LEGACY_ONLY_HREFS.has(item.href)))
  return <RoleShell role="teacher" homeHref="/teacher/dashboard" navigation={navigation} identity={teacherName} workspaceName={schoolName ? `${schoolName} · Teaching` : undefined}
    accountActions={<button type="button" onClick={() => void signOut({ redirectTo: '/login' })} aria-label="Sign out" className="flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-border bg-card focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"><LogOut aria-hidden="true" className="size-5" /></button>}
  >
    {later.length > 0 && <ul aria-label="Not available yet" data-testid="teacher-nav-later" className="flex flex-wrap gap-x-5 gap-y-1 border-b border-border bg-muted/40 px-5 py-2 text-xs text-muted-foreground md:px-7">
      {later.map((item) => <li key={item.href}><span aria-disabled="true" className="font-semibold">{item.label}</span>{' '}<span>Arrives with a later release</span></li>)}
    </ul>}
    {children}
  </RoleShell>
}
