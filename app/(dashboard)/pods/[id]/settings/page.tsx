'use client'

import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { useSession } from 'next-auth/react'
import { usePodDetail, useUpdatePod, useDeletePod } from '@/lib/hooks/use-pods'
import { PrivacySettings } from '@/components/pod/privacy-settings'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function PodSettingsPage() {
  const params = useParams<{ id: string }>()
  const podId = params.id
  const router = useRouter()
  const { data: session } = useSession()
  const { data: pod, isLoading } = usePodDetail(podId)
  const updatePod = useUpdatePod()
  const deletePod = useDeletePod()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [initialized, setInitialized] = useState(false)

  if (isLoading || !pod) {
    return <div className="p-7 text-sm text-muted-foreground">Loading settings...</div>
  }

  // Initialize form with pod data once
  if (!initialized) {
    setName(pod.name)
    setDescription(pod.description ?? '')
    setInitialized(true)
  }

  const currentUserId = session?.user?.id ?? ''
  const currentMember = pod.members.find((m) => m.userId === currentUserId)
  const isOwner = currentMember?.role === 'OWNER'

  const handleSave = () => {
    updatePod.mutate({
      id: podId,
      data: { name, description: description || undefined },
    })
  }

  const handleDelete = () => {
    if (!confirm('Are you sure you want to delete this group? This cannot be undone.')) return
    deletePod.mutate(podId, {
      onSuccess: () => router.push('/pods'),
    })
  }

  return (
    <div className="p-7 space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/pods/${podId}`} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-xl font-bold">Group Settings</h1>
      </div>

      {/* Owner settings */}
      {isOwner && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Group Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label className="text-sm font-medium">Name</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">Description</label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="mt-1"
              />
            </div>
            <Button onClick={handleSave} disabled={updatePod.isPending} size="sm">
              {updatePod.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Privacy settings for all members */}
      {currentMember && <PrivacySettings podId={podId} member={currentMember} />}

      {/* Danger zone */}
      {isOwner && (
        <Card className="border-destructive/50">
          <CardHeader>
            <CardTitle className="text-base text-destructive">Danger Zone</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">
              Deleting a group is permanent and removes all members.
            </p>
            <Button variant="destructive" size="sm" onClick={handleDelete} disabled={deletePod.isPending}>
              {deletePod.isPending ? 'Deleting...' : 'Delete Group'}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
