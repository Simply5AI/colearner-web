'use client'

import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/api/query-keys'

/**
 * WebSocket hook for real-time pod events.
 * Connects to the /pods namespace, joins `pod:{podId}` room,
 * and invalidates React Query caches on incoming events.
 */
export function usePodWebSocket(podId: string, token: string | undefined) {
  const ws = useRef<WebSocket | null>(null)
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!token || !podId) return

    const WS_URL = process.env.NEXT_PUBLIC_WS_URL
    if (!WS_URL) return

    ws.current = new WebSocket(
      `${WS_URL}/pods?pod=${podId}&token=${token}`
    )

    ws.current.onopen = () => {
      ws.current?.send(JSON.stringify({ type: 'pod:join', podId }))
    }

    ws.current.onmessage = (event) => {
      const data = JSON.parse(event.data)

      switch (data.type) {
        case 'pod:capture:shared':
          queryClient.invalidateQueries({ queryKey: queryKeys.pods.captures(podId) })
          break
        case 'pod:member:joined':
        case 'pod:member:left':
          queryClient.invalidateQueries({ queryKey: queryKeys.pods.detail(podId) })
          queryClient.invalidateQueries({ queryKey: queryKeys.pods.leaderboard(podId) })
          break
        case 'pod:leaderboard:update':
          queryClient.invalidateQueries({ queryKey: queryKeys.pods.leaderboard(podId) })
          break
      }
    }

    return () => {
      ws.current?.send(JSON.stringify({ type: 'pod:leave', podId }))
      ws.current?.close()
      ws.current = null
    }
  }, [podId, token, queryClient])
}
