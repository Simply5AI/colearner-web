'use client'

import { useEffect, useRef, useCallback } from 'react'
import { useRecallStore } from '@/lib/stores/recall-store'

/** WebSocket hook for real-time recall session communication */
export function useRecallWebSocket(sessionId: string, token: string) {
  const ws = useRef<WebSocket | null>(null)
  const { setQuestion, setFeedback, setSessionComplete } = useRecallStore()

  useEffect(() => {
    const WS_URL = process.env.NEXT_PUBLIC_WS_URL!
    ws.current = new WebSocket(
      `${WS_URL}/recall/live?session=${sessionId}&token=${token}`
    )

    ws.current.onmessage = (event) => {
      const data = JSON.parse(event.data)

      switch (data.type) {
        case 'question':
          setQuestion(data.question)
          break
        case 'judged':
          setFeedback({ score: data.score, feedback: data.feedback })
          break
        case 'session_complete':
          setSessionComplete(data.summary)
          break
      }
    }

    return () => ws.current?.close()
  }, [sessionId, token, setQuestion, setFeedback, setSessionComplete])

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
