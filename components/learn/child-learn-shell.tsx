'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { BookOpen, Clock, Home, Library } from 'lucide-react'
import { Button } from '@/components/design-system'
import type { AgeBand } from '@/components/design-system'
import { RoleShell } from '@/components/roles/role-shell'
import { familyDeviceRequest } from '@/lib/api/family-browser'
import type { ReactNode } from 'react'

/** A selected child sees only the learning destinations that exist for them, and a way to switch learner. */
export function ChildLearnShell({ children, band, nickname }: { children: ReactNode; band: AgeBand; nickname: string }) {
  const cache = useQueryClient()
  const kids = band === 'kids'
  const leave = useMutation({ mutationFn: () => familyDeviceRequest('child', 'DELETE'), retry: false, onSuccess: () => { cache.clear(); window.location.assign('/profiles') } })
  const items = [
    { href: '/learn/home', label: 'Home', icon: Home, match: (path: string) => path === '/learn/home' },
    { href: '/learn', label: kids ? 'Adventures' : 'Learn', icon: BookOpen, match: (path: string) => path === '/learn' || path.startsWith('/learn/plans/') },
    { href: '/learn/library', label: kids ? 'My pages' : 'Library', icon: Library, match: (path: string) => path.startsWith('/learn/library') || path === '/learn/import' || path === '/learn/snap' },
    { href: '/learn/practice', label: kids ? 'Play' : 'Practice', icon: Clock, match: (path: string) => path === '/learn/practice' || path.startsWith('/learn/practice/') },
  ]
  return <RoleShell role="student" band={band} identity={nickname} homeHref="/learn/home" navigation={[{ title: kids ? 'Your adventures' : 'Learn', items }]} bottomNavigation={items}
    accountActions={<Button variant="secondary" onClick={() => leave.mutate()} loading={leave.isPending}>Switch learner</Button>}>
    <>{leave.error && <p role="alert" className="p-4">{leave.error.message}</p>}{children}</>
  </RoleShell>
}
