'use client'

import { useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import { Sparkles } from 'lucide-react'
import type { TutorMessage } from '@/lib/api/tutor'
import { cn } from '@/lib/utils'

interface TutorMessageListProps {
  messages: TutorMessage[]
  streamingText: string
  isStreaming: boolean
  pendingUserMessage: string | null
}

export function TutorMessageList({
  messages,
  streamingText,
  isStreaming,
  pendingUserMessage,
}: TutorMessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages.length, streamingText, pendingUserMessage, isStreaming])

  if (messages.length === 0 && !pendingUserMessage && !isStreaming) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center text-sm text-muted-foreground">
        <Sparkles className="h-6 w-6 text-brand-purple" />
        <p className="font-medium text-foreground">Ask the tutor anything</p>
        <p className="text-xs leading-relaxed">
          Drill deeper into a concept, ask for examples, or clarify something confusing. The tutor
          knows the concepts from this unit.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 px-5 py-4">
      {messages.map((m) => (
        <Bubble key={m.id} role={m.role === 'USER' ? 'user' : 'assistant'}>
          {m.content}
        </Bubble>
      ))}
      {pendingUserMessage && <Bubble role="user">{pendingUserMessage}</Bubble>}
      {(isStreaming || streamingText) && (
        <Bubble role="assistant" streaming={isStreaming}>
          {streamingText}
        </Bubble>
      )}
      <div ref={bottomRef} />
    </div>
  )
}

function Bubble({
  role,
  streaming = false,
  children,
}: {
  role: 'user' | 'assistant'
  streaming?: boolean
  children: string
}) {
  const isUser = role === 'user'
  return (
    <div className={cn('flex', isUser ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
          isUser
            ? 'bg-brand-purple text-white'
            : 'bg-muted text-foreground',
        )}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{children}</p>
        ) : (
          <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-2 prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5 prose-headings:mt-3 prose-headings:mb-1.5">
            <ReactMarkdown>{children || ' '}</ReactMarkdown>
            {streaming && <span className="animate-pulse">▊</span>}
          </div>
        )}
      </div>
    </div>
  )
}
