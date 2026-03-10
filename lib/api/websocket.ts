'use client'

import { useEffect, useRef, useCallback } from 'react'
import { useRecallStore } from '@/lib/stores/recall-store'

/** WebSocket hook for real-time recall session communication (optional/future use) */
export function useRecallWebSocket(sessionId: string, token: string) {
  const ws = useRef<WebSocket | null>(null)
  const { setResult, setSessionComplete } = useRecallStore()

  useEffect(() => {
    const WS_URL = process.env.NEXT_PUBLIC_WS_URL!
    ws.current = new WebSocket(
      `${WS_URL}/recall/live?session=${sessionId}&token=${token}`
    )

    ws.current.onmessage = (event) => {
      const data = JSON.parse(event.data)

      switch (data.type) {
        case 'judged':
          setResult(data.result)
          break
        case 'session_complete':
          setSessionComplete(data.summary)
          break
      }
    }

    return () => ws.current?.close()
  }, [sessionId, token, setResult, setSessionComplete])

  const sendAnswer = useCallback((questionId: string, answer: string) => {
    ws.current?.send(
      JSON.stringify({
        type: 'answer',
        questionId,
        answer,
      })
    )
  }, [])

  return { sendAnswer }
}
