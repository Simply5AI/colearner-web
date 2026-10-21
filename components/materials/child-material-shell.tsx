'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { BookOpen, Camera, Upload } from 'lucide-react'
import { Button } from '@/components/design-system'
import type { AgeBand } from '@/components/design-system'
import { RoleShell } from '@/components/roles/role-shell'
import { familyDeviceRequest } from '@/lib/api/family-browser'
import type { ReactNode } from 'react'

export function ChildMaterialShell({ children, band, nickname }: { children: ReactNode; band: AgeBand; nickname: string }) {
  const cache = useQueryClient()
  const leave = useMutation({ mutationFn: () => familyDeviceRequest('child', 'DELETE'), retry: false, onSuccess: () => { cache.clear(); window.location.assign('/profiles') } })
  return <RoleShell role="student" band={band} identity={nickname} homeHref="/learn/library" navigation={[{ title: 'Your material', items: [{ href: '/learn/library', label: band === 'kids' ? 'My pages' : 'Library', icon: BookOpen }, { href: '/learn/import', label: 'Import', icon: Upload }, { href: '/learn/snap', label: 'Snap a page', icon: Camera }] }]} accountActions={<Button variant="secondary" onClick={() => leave.mutate()} loading={leave.isPending}>Switch learner</Button>}><>{leave.error && <p role="alert" className="p-4">{leave.error.message}</p>}{children}</></RoleShell>
}
