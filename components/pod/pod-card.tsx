'use client'

import Link from 'next/link'
import { Users } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { Pod } from '@/lib/types/pods'

interface PodCardProps {
  pod: Pod
}

export function PodCard({ pod }: PodCardProps) {
  return (
    <Link href={`/pods/${pod.id}`}>
      <Card className="hover:shadow-md transition-shadow cursor-pointer">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-lg"
                style={{ backgroundColor: pod.color ? `${pod.color}20` : 'hsl(var(--primary) / 0.1)' }}
              >
                {pod.icon || '👥'}
              </div>
              <CardTitle className="text-lg">{pod.name}</CardTitle>
            </div>
            <Badge variant={pod.visibility === 'PUBLIC' ? 'default' : 'secondary'}>
              {pod.visibility === 'PUBLIC' ? 'Public' : 'Invite Only'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {pod.description && (
            <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{pod.description}</p>
          )}
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              {pod.members.length} / {pod.maxMembers} members
            </span>
            <span>Code: {pod.code}</span>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
