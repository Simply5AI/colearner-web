'use client'

import { Activity } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { usePodActivity } from '@/lib/hooks/use-pods'

interface PodActivityFeedProps {
  podId: string
}

export function PodActivityFeed({ podId }: PodActivityFeedProps) {
  const { data: activities, isLoading } = usePodActivity(podId)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Activity className="h-4 w-4" /> Recent Activity
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading && (
          <p className="text-sm text-muted-foreground">Loading...</p>
        )}
        {!isLoading && (!activities || activities.length === 0) && (
          <p className="text-sm text-muted-foreground">No recent activity.</p>
        )}
        {activities && activities.length > 0 && (
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {activities.map((item) => (
              <div key={item.id} className="flex items-start gap-2 text-sm">
                <div className="mt-0.5 h-6 w-6 shrink-0 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">
                  {item.user.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p>
                    <span className="font-medium">{item.user.name}</span>{' '}
                    <span className="text-muted-foreground">{item.action}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(item.createdAt).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
