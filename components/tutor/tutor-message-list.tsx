'use client'

import { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { Info, Sparkles } from 'lucide-react'
import type { TutorMessage } from '@/lib/api/tutor'
import { useSession } from 'next-auth/react'
import { getMemorySource, type MemorySourceDetail } from '@/lib/api/memory'
import { cn } from '@/lib/utils'

interface PendingUserMessage {
  content: string
  imagePreviewUrl: string | null
}

interface TutorMessageListProps {
  messages: TutorMessage[]
  streamingText: string
  isStreaming: boolean
  pendingUserMessage: PendingUserMessage | null
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
        <div key={m.id} className="flex flex-col gap-1">
          <Bubble role={m.role === 'USER' ? 'user' : 'assistant'} imageUrl={m.imageUrl ?? null}>
            {m.content}
          </Bubble>
          {m.role === 'ASSISTANT' && m.usedMemoryIds && m.usedMemoryIds.length > 0 ? (
            <MemoryProvenance memoryIds={m.usedMemoryIds} />
          ) : null}
        </div>
      ))}
      {pendingUserMessage && (
        <Bubble role="user" imageUrl={pendingUserMessage.imagePreviewUrl}>
          {pendingUserMessage.content}
        </Bubble>
      )}
      {(isStreaming || streamingText) && (
        <Bubble role="assistant" streaming={isStreaming}>
          {streamingText}
        </Bubble>
      )}
      <div ref={bottomRef} />
    </div>
  )
}

function MemoryProvenance({ memoryIds }: { memoryIds: string[] }) {
  const { data: session } = useSession()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [details, setDetails] = useState<MemorySourceDetail[]>([])

  async function toggle() {
    if (open) {
      setOpen(false)
      return
    }
    setOpen(true)
    if (details.length > 0 || !session?.accessToken) return
    setLoading(true)
    try {
      const results = await Promise.all(
        memoryIds.map((id) => getMemorySource(session.accessToken as string, id).catch(() => null)),
      )
      setDetails(results.filter((d): d is MemorySourceDetail => d !== null))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="ml-1 flex flex-col gap-1">
      <button
        type="button"
        onClick={toggle}
        className="flex items-center gap-1 self-start text-[11px] text-muted-foreground hover:text-foreground"
      >
        <Info className="h-3 w-3" />
        Memory used ({memoryIds.length}) {open ? '▴' : '▾'}
      </button>
      {open ? (
        <div className="rounded-md border border-border bg-muted/30 p-2 text-xs">
          {loading ? (
            <span className="text-muted-foreground">Loading…</span>
          ) : details.length === 0 ? (
            <span className="text-muted-foreground">No source available</span>
          ) : (
            <ul className="space-y-1.5">
              {details.map((d) => (
                <li key={d.memoryId}>
                  <span className="font-medium">{d.type.replaceAll('_', ' ')}:</span>{' '}
                  <span className="text-muted-foreground">{d.content}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  )
}

function Bubble({
  role,
  streaming = false,
  imageUrl = null,
  children,
}: {
  role: 'user' | 'assistant'
  streaming?: boolean
  imageUrl?: string | null
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
        {imageUrl && (
          <a href={imageUrl} target="_blank" rel="noreferrer">
            <img
              src={imageUrl}
              alt="Attachment"
              className="mb-2 max-h-64 rounded-lg object-cover"
            />
          </a>
        )}
        {isUser ? (
          children ? <p className="whitespace-pre-wrap">{children}</p> : null
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
