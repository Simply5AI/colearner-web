'use client'

import { useCallback, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'

interface StreamEvent {
  type: 'token' | 'done' | 'error'
  data: string
}

interface SendArgs {
  extractionId: string
  content: string
  conceptId?: string | null
  image?: File | null
}

export function useTutorStream() {
  const queryClient = useQueryClient()
  const [streamingText, setStreamingText] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const cancel = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    setIsStreaming(false)
  }, [])

  const sendMessage = useCallback(
    async ({ extractionId, content, conceptId, image }: SendArgs) => {
      cancel()
      const controller = new AbortController()
      abortRef.current = controller

      setStreamingText('')
      setError(null)
      setIsStreaming(true)

      try {
        let body: BodyInit
        const headers: Record<string, string> = { Accept: 'text/event-stream' }
        if (image) {
          const form = new FormData()
          form.append('content', content)
          if (conceptId) form.append('conceptId', conceptId)
          form.append('image', image)
          body = form
        } else {
          headers['Content-Type'] = 'application/json'
          body = JSON.stringify({ content, conceptId: conceptId ?? undefined })
        }

        const res = await fetch(`/api/tutor/${extractionId}/message`, {
          method: 'POST',
          headers,
          body,
          signal: controller.signal,
        })

        if (!res.ok || !res.body) {
          const msg = await res.text().catch(() => '')
          throw new Error(msg || `Request failed (${res.status})`)
        }

        const reader = res.body.getReader()
        const decoder = new TextDecoder('utf-8')
        let buffer = ''

        while (true) {
          const { value, done } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })

          // Split on SSE frame delimiter (double newline)
          const frames = buffer.split('\n\n')
          buffer = frames.pop() ?? ''

          for (const frame of frames) {
            const line = frame.split('\n').find((l) => l.startsWith('data: '))
            if (!line) continue
            const payload = line.slice(6).trim()
            if (!payload) continue
            try {
              const evt = JSON.parse(payload) as StreamEvent
              if (evt.type === 'token') {
                setStreamingText((prev) => prev + evt.data)
              } else if (evt.type === 'error') {
                setError(evt.data || 'Tutor error')
              } else if (evt.type === 'done') {
                // final — loop will end on next read
              }
            } catch {
              // ignore malformed frames
            }
          }
        }

        await queryClient.invalidateQueries({ queryKey: ['tutor', extractionId] })
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          setError((err as Error).message)
        }
      } finally {
        setIsStreaming(false)
        abortRef.current = null
      }
    },
    [cancel, queryClient],
  )

  return { sendMessage, streamingText, isStreaming, error, cancel }
}
