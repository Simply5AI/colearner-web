'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { ArrowLeft, Copy, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'

import type { AdminUserDetail } from '@/lib/api/admin'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { AdminUserActionMenu } from '@/components/admin/admin-user-detail/action-menu'
import { ProfileTab } from '@/components/admin/admin-user-detail/profile-tab'
import { RolesTab } from '@/components/admin/admin-user-detail/roles-tab'
import { SessionsTab } from '@/components/admin/admin-user-detail/sessions-tab'
import { ActivityTab } from '@/components/admin/admin-user-detail/activity-tab'

interface AdminUserDetailViewProps {
  detail: AdminUserDetail
  currentAdminId: string
}

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

function statusBadge(status: AdminUserDetail['status']) {
  switch (status) {
    case 'SUSPENDED':
      return <Badge variant="destructive">Suspended</Badge>
    case 'DELETED':
      return <Badge variant="outline">Deleted</Badge>
    default:
      return <Badge variant="secondary">Active</Badge>
  }
}

export function AdminUserDetailView({ detail, currentAdminId }: AdminUserDetailViewProps) {
  const { data: session } = useSession()

  const authHeaders = useMemo<Record<string, string>>(() => {
    const token = session?.accessToken
    const headers: Record<string, string> = {}
    if (token) headers.Authorization = `Bearer ${token}`
    return headers
  }, [session?.accessToken])

  return (
    <div className="px-4 py-5 md:px-6 lg:px-8">
      <div className="mb-4">
        <Link
          href="/admin/users"
          className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}
        >
          <ArrowLeft className="h-4 w-4" />
          Back to users
        </Link>
      </div>

      <div className="mb-6 flex flex-wrap items-start gap-4">
        <Avatar className="h-16 w-16">
          <AvatarImage src={detail.avatarUrl ?? undefined} alt={detail.name} />
          <AvatarFallback>{initials(detail.name)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold">{detail.name}</h1>
            {statusBadge(detail.status)}
            <Badge variant="outline">{detail.systemRole}</Badge>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
            <span>{detail.email}</span>
            <span>·</span>
            <span className="text-foreground/80">
              {detail.org.name} <span className="opacity-60">({detail.org.slug})</span>
            </span>
            <span>·</span>
            <button
              type="button"
              className="inline-flex items-center gap-1 font-mono text-xs text-muted-foreground hover:text-foreground"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(detail.id)
                  toast.success('User ID copied')
                } catch {
                  toast.error('Could not copy user ID')
                }
              }}
            >
              {detail.id.slice(0, 8)}…
              <Copy className="h-3 w-3" />
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/admin/users/${detail.id}/learning`}
            className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
          >
            View learning
            <ExternalLink className="h-3 w-3" />
          </Link>
          <AdminUserActionMenu
            detail={detail}
            currentAdminId={currentAdminId}
            authHeaders={authHeaders}
          />
        </div>
      </div>

      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="roles">
            Roles
            <span className="ml-1 opacity-60">{detail.roles.length}</span>
          </TabsTrigger>
          <TabsTrigger value="sessions">Sessions</TabsTrigger>
          <TabsTrigger value="activity">
            Activity
            <span className="ml-1 opacity-60">{detail.activityCount}</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="mt-4">
          <ProfileTab detail={detail} authHeaders={authHeaders} />
        </TabsContent>
        <TabsContent value="roles" className="mt-4">
          <RolesTab
            detail={detail}
            currentAdminId={currentAdminId}
            authHeaders={authHeaders}
          />
        </TabsContent>
        <TabsContent value="sessions" className="mt-4">
          <SessionsTab userId={detail.id} authHeaders={authHeaders} />
        </TabsContent>
        <TabsContent value="activity" className="mt-4">
          <ActivityTab userId={detail.id} authHeaders={authHeaders} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
