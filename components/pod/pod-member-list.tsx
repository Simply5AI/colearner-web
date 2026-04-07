'use client'

import { useState } from 'react'
import { Crown, LogOut, UserMinus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useRemoveMember } from '@/lib/hooks/use-pods'
import type { PodMember } from '@/lib/types/pods'

interface PodMemberListProps {
  podId: string
  members: PodMember[]
  currentUserId: string
  isOwner: boolean
}

export function PodMemberList({ podId, members, currentUserId, isOwner }: PodMemberListProps) {
  const removeMember = useRemoveMember()
  const [confirmId, setConfirmId] = useState<string | null>(null)

  const handleRemove = (userId: string) => {
    if (confirmId !== userId) {
      setConfirmId(userId)
      return
    }
    removeMember.mutate({ podId, userId }, {
      onSettled: () => setConfirmId(null),
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Members ({members.length})</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {members.map((member) => {
          const isSelf = member.userId === currentUserId
          const isMemberOwner = member.role === 'OWNER'

          return (
            <div key={member.userId} className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-accent/50">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                {member.user.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {member.user.name}
                  {isSelf && <span className="ml-1 text-xs text-muted-foreground">(you)</span>}
                </p>
                <p className="text-xs text-muted-foreground truncate">{member.user.email}</p>
              </div>
              {isMemberOwner && (
                <Badge variant="outline" className="gap-1">
                  <Crown className="h-3 w-3" /> Owner
                </Badge>
              )}
              {/* Owner can remove non-owners; members can leave */}
              {!isMemberOwner && (isOwner || isSelf) && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-muted-foreground hover:text-destructive"
                  onClick={() => handleRemove(member.userId)}
                  disabled={removeMember.isPending}
                >
                  {confirmId === member.userId ? (
                    'Confirm?'
                  ) : isSelf ? (
                    <><LogOut className="h-3 w-3 mr-1" /> Leave</>
                  ) : (
                    <><UserMinus className="h-3 w-3 mr-1" /> Remove</>
                  )}
                </Button>
              )}
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
