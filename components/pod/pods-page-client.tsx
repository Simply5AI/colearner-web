'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Plus, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useUserPods, useJoinByCode } from '@/lib/hooks/use-pods'
import { PodCard } from './pod-card'
import type { Pod } from '@/lib/types/pods'

interface PodsPageClientProps {
  initialData?: Pod[]
}

export function PodsPageClient({ initialData }: PodsPageClientProps) {
  const { data: pods, isLoading } = useUserPods(initialData)
  const [joinCode, setJoinCode] = useState('')
  const joinByCode = useJoinByCode()
  const router = useRouter()

  const handleJoin = () => {
    if (!joinCode.trim()) return
    joinByCode.mutate(joinCode.trim(), {
      onSuccess: (result) => {
        setJoinCode('')
        router.push(`/pods/${result.podId}`)
      },
    })
  }

  return (
    <div className="space-y-6">
      {/* Actions bar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Enter group code to join..."
            className="pl-9"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleJoin}
          disabled={!joinCode.trim() || joinByCode.isPending}
        >
          Join
        </Button>
        <div className="flex-1" />
        <Button size="sm" render={<Link href="/pods/create" />}>
          <Plus className="h-4 w-4 mr-1" /> Create Group
        </Button>
      </div>

      {joinByCode.isError && (
        <p className="text-sm text-destructive">{joinByCode.error.message}</p>
      )}

      {/* Pod grid */}
      {isLoading && (
        <p className="text-sm text-muted-foreground">Loading your groups...</p>
      )}

      {!isLoading && (!pods || pods.length === 0) && (
        <div className="rounded-xl border-2 border-dashed border-border p-12 text-center">
          <p className="text-lg font-semibold">No groups yet</p>
          <p className="text-sm text-muted-foreground mt-1 mb-4">
            Create a study group or join one with a code to start learning together.
          </p>
          <Button render={<Link href="/pods/create" />}>
            <Plus className="h-4 w-4 mr-1" /> Create Your First Group
          </Button>
        </div>
      )}

      {pods && pods.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {pods.map((pod) => (
            <PodCard key={pod.id} pod={pod} />
          ))}
        </div>
      )}
    </div>
  )
}
