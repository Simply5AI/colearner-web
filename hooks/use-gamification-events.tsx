'use client'

import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { Trophy } from 'lucide-react'
import { getRecentBadges, acknowledgeBadge, Badge } from '@/lib/api/gamification'
import { useSession } from 'next-auth/react'

export function useGamificationEvents() {
  const { data: session } = useSession()
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const isPollingRef = useRef(false)

  useEffect(() => {
    // Only poll if user is logged in
    if (!session?.user) return
    const accessToken = (session as any)?.accessToken
    if (!accessToken) return

    const pollBadges = async () => {
      // Prevent overlapping polls
      if (isPollingRef.current) return
      isPollingRef.current = true

      try {
        const headers = { Authorization: `Bearer ${accessToken}` }
        const recentBadges = await getRecentBadges(headers)

        if (recentBadges && recentBadges.length > 0) {
          for (const badge of recentBadges) {
            // Show celebration toast
            toast.custom((t) => (
              <div className="bg-background border-2 border-primary/20 p-4 rounded-xl shadow-lg flex items-start gap-4 w-[350px] relative overflow-hidden group animate-in slide-in-from-bottom-5">
                <div className="absolute -right-10 -top-10 bg-primary/10 w-32 h-32 rounded-full blur-2xl group-hover:bg-primary/20 transition-all duration-500" />
                <div className="bg-primary/10 p-3 rounded-full border border-primary/20 z-10">
                  <Trophy className="h-6 w-6 text-primary" />
                </div>
                <div className="z-10 flex-1">
                  <h4 className="text-sm font-bold text-primary uppercase tracking-wider mb-1">
                    Badge Earned!
                  </h4>
                  <p className="font-semibold text-foreground">{badge.name}</p>
                  <p className="text-xs text-muted-foreground mt-1">{badge.description}</p>
                </div>
              </div>
            ), {
              duration: 6000,
            })

            // Acknowledge the badge so it doesn't show up again
            await acknowledgeBadge(badge.id, headers)
          }
        }
      } catch (error) {
        console.error('Failed to poll gamification events:', error)
      } finally {
        isPollingRef.current = false
      }
    }

    // Poll every 30 seconds
    pollBadges()
    intervalRef.current = setInterval(pollBadges, 30000)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [session])
}
