'use client'

import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { io, type Socket } from 'socket.io-client'
import { queryKeys } from '@/lib/api/query-keys'

/**
 * WebSocket hook for real-time pod events.
 * Connects to the /pods namespace, joins `pod:{podId}` room,
 * and invalidates React Query caches on incoming events.
 */
export function usePodWebSocket(podId: string, token: string | undefined) {
  const socketRef = useRef<Socket | null>(null)
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!token || !podId) return

    const WS_URL = process.env.NEXT_PUBLIC_WS_URL
    if (!WS_URL) return

    const socket = io(`${WS_URL}/pods`, {
      auth: { token },
      transports: ['websocket', 'polling'],
    })
    socketRef.current = socket

    socket.on('connect', () => {
      socket.emit('pod:join', { podId })
    })

    const refreshCaptures = () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.pods.captures(podId) })
    }
    const refreshMessages = () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.pods.messages(podId) })
    }
    const refreshMembers = () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.pods.detail(podId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.pods.leaderboard(podId) })
    }

    socket.on('pod:capture:shared', refreshCaptures)
    socket.on('pod:capture:saved', refreshCaptures)
    socket.on('pod:capture:unsaved', refreshCaptures)
    socket.on('pod:capture:comment:created', (data: { captureId?: string }) => {
      refreshCaptures()
      if (data.captureId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.pods.comments(podId, data.captureId),
        })
      }
    })
    socket.on('pod:message:created', refreshMessages)
    socket.on('pod:member:joined', refreshMembers)
    socket.on('pod:member:left', refreshMembers)
    socket.on('pod:leaderboard:update', () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.pods.leaderboard(podId) })
    })

    return () => {
      socket.emit('pod:leave', { podId })
      socket.disconnect()
      socketRef.current = null
    }
  }, [podId, token, queryClient])
}
