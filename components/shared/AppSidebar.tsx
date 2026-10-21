'use client'

import { signOut } from 'next-auth/react'
import { LogOut } from 'lucide-react'
import { useProfile } from '@/lib/hooks/use-profile'
import { RoleShell, RoleNavigation } from '@/components/roles/role-shell'
import { ageBandFromDateOfBirth, studentNavigation } from '@/components/roles/role-config'
import type { SourceProgress } from '@/lib/types'
import { usePathname } from 'next/navigation'
import { BrandMark } from '@/components/design-system'
import Link from 'next/link'

interface AppSidebarProps {
  sourceProgress?: SourceProgress | null
  recallDueCount?: number
  failedCount?: number
}

function SourceProgressSummary({ progress }: { progress: SourceProgress }) {
  const total = Math.max(0, progress.totalAttempts)
  const required = Math.max(0, progress.requiredAttempts)
  const percent = required > 0 ? Math.min(100, Math.round(total / required * 100)) : 0
  return <div className="rounded-xl border border-border bg-card p-3">
    <p className="text-sm font-semibold">Source {progress.currentSource}: {progress.sourceName}</p>
    <p className="mt-1 text-xs text-muted-foreground">{total} / {required} practice attempts</p>
    <progress max={100} value={percent} aria-label="Practice attempts complete" className="mt-3 h-2 w-full accent-primary" />
    <p className="text-xs text-muted-foreground">{Math.max(0, required - total)} to go</p>
  </div>
}

/** Existing standalone adapter, using the same route configuration as the shell. */
export function AppSidebar({ sourceProgress, recallDueCount = 0 }: AppSidebarProps) {
  const pathname = usePathname()
  const { data: profile } = useProfile()
  const knownBand = ageBandFromDateOfBirth(profile?.dateOfBirth)
  const band = knownBand ?? 'teens'
  return <aside data-age-band={band} className="hidden w-64 shrink-0 flex-col border-e border-sidebar-border bg-sidebar lg:flex">
    <Link href="/dashboard" className="inline-flex min-h-[var(--ds-target,44px)] min-w-[var(--ds-target,44px)] items-center p-5" aria-label="CoLearner home"><BrandMark /></Link>
    <div className="p-3"><RoleNavigation groups={studentNavigation(band, !!knownBand, recallDueCount)} pathname={pathname} label="Primary navigation" band={band} /></div>
    {sourceProgress && band !== 'kids' && <div className="p-3"><SourceProgressSummary progress={sourceProgress} /></div>}
  </aside>
}

export function StudentShell({ children, sourceProgress, recallDueCount = 0 }: AppSidebarProps & { children: React.ReactNode }) {
  const { data: profile } = useProfile()
  const knownBand = ageBandFromDateOfBirth(profile?.dateOfBirth)
  const band = knownBand ?? 'teens'
  const navigation = studentNavigation(band, !!knownBand, recallDueCount)
  return <RoleShell
    role="student" band={band} homeHref="/learn/home" navigation={navigation}
    bottomNavigation={navigation[0]?.items} identity={profile?.name}
    sidebarFooter={sourceProgress && band !== 'kids' ? <SourceProgressSummary progress={sourceProgress} /> : undefined}
    accountActions={<button type="button" onClick={() => void signOut({ redirectTo: '/login' })} aria-label="Sign out" className="flex min-h-[var(--ds-tap,44px)] min-w-[var(--ds-tap,44px)] items-center justify-center rounded-xl border border-border bg-card focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"><LogOut aria-hidden="true" className="size-5" /></button>}
  >{children}</RoleShell>
}
