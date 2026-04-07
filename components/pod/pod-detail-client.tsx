'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { Settings, UserPlus, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { usePodDetail, usePodCaptures } from '@/lib/hooks/use-pods'
import { usePodWebSocket } from '@/lib/hooks/use-pod-websocket'
import { PodLeaderboard } from './pod-leaderboard'
import { PodActivityFeed } from './pod-activity-feed'
import { PodMemberList } from './pod-member-list'
import { InviteMemberModal } from './invite-member-modal'

interface PodDetailClientProps {
  podId: string
}

export function PodDetailClient({ podId }: PodDetailClientProps) {
  const { data: session } = useSession()
  const { data: pod, isLoading } = usePodDetail(podId)
  const { data: capturesData } = usePodCaptures(podId)
  const [activeTab, setActiveTab] = useState<'overview' | 'captures' | 'members'>('overview')
  const [inviteOpen, setInviteOpen] = useState(false)

  // Connect WebSocket for real-time updates
  usePodWebSocket(podId, session?.accessToken)

  if (isLoading || !pod) {
    return <p className="text-sm text-muted-foreground">Loading group...</p>
  }

  const currentUserId = session?.user?.id ?? ''
  const currentMember = pod.members.find((m) => m.userId === currentUserId)
  const isOwner = currentMember?.role === 'OWNER'

  const tabs = [
    { key: 'overview' as const, label: 'Overview' },
    { key: 'captures' as const, label: `Captures (${capturesData?.total ?? 0})` },
    { key: 'members' as const, label: `Members (${pod.members.length})` },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Link href="/pods" className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex items-center gap-2">
            <span className="text-2xl">{pod.icon || '👥'}</span>
            <div>
              <h1 className="text-xl font-bold">{pod.name}</h1>
              {pod.description && (
                <p className="text-sm text-muted-foreground">{pod.description}</p>
              )}
            </div>
          </div>
          <Badge variant={pod.visibility === 'PUBLIC' ? 'default' : 'secondary'} className="ml-2">
            {pod.visibility === 'PUBLIC' ? 'Public' : 'Invite Only'}
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setInviteOpen(true)}>
            <UserPlus className="h-4 w-4 mr-1" /> Invite
          </Button>
          <InviteMemberModal
            open={inviteOpen}
            onOpenChange={setInviteOpen}
            podId={podId}
            podCode={pod.code}
          />
          {isOwner && (
            <Button variant="outline" size="sm" render={<Link href={`/pods/${podId}/settings`} />}>
              <Settings className="h-4 w-4 mr-1" /> Settings
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'overview' && (
        <div className="grid gap-6 lg:grid-cols-2">
          <PodLeaderboard podId={podId} />
          <PodActivityFeed podId={podId} />
        </div>
      )}

      {activeTab === 'captures' && (
        <div className="space-y-4">
          {capturesData?.captures && capturesData.captures.length > 0 ? (
            capturesData.captures.map((capture) => (
              <div key={capture.id} className="rounded-lg border p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium">{capture.extraction.title}</p>
                    <p className="text-xs text-muted-foreground">
                      Shared by {capture.sharer.name} &middot;{' '}
                      {new Date(capture.createdAt).toLocaleDateString()}
                    </p>
                    {capture.note && (
                      <p className="mt-1 text-sm text-muted-foreground italic">
                        &ldquo;{capture.note}&rdquo;
                      </p>
                    )}
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {capture.extraction.conceptCount} concepts
                  </Badge>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">
              No shared captures yet. Share a source with your group to get started.
            </p>
          )}
        </div>
      )}

      {activeTab === 'members' && (
        <PodMemberList
          podId={podId}
          members={pod.members}
          currentUserId={currentUserId}
          isOwner={isOwner}
        />
      )}
    </div>
  )
}
