'use client'

import { useMemo, useState } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Sparkles, Trash2 } from 'lucide-react'
import { useTutorStore } from '@/lib/stores/tutor-store'
import { useTutorHistory } from '@/lib/hooks/use-tutor-history'
import { useTutorStream } from '@/lib/hooks/use-tutor-stream'
import { deleteTutorChat } from '@/lib/api/tutor'
import { useQueryClient } from '@tanstack/react-query'
import { TutorMessageList } from './tutor-message-list'
import { TutorInput } from './tutor-input'
import { TutorDisclaimer } from './tutor-disclaimer'
import { ConceptPinChip } from './concept-pin-chip'

interface ConceptRef {
  id: string
  title: string
}

interface TutorDrawerProps {
  extractionId: string
  extractionTitle: string
  concepts: ConceptRef[]
}

export function TutorDrawer({ extractionId, extractionTitle, concepts }: TutorDrawerProps) {
  const queryClient = useQueryClient()
  const isOpen = useTutorStore((s) => s.isOpen)
  const close = useTutorStore((s) => s.close)
  const pinnedConceptId = useTutorStore((s) => s.pinnedConceptId)
  const setPinned = useTutorStore((s) => s.setPinned)

  const { data, isLoading } = useTutorHistory(extractionId, isOpen)
  const { sendMessage, streamingText, isStreaming, error } = useTutorStream()
  const [pendingUser, setPendingUser] = useState<string | null>(null)

  const pinnedConcept = useMemo(
    () => (pinnedConceptId ? concepts.find((c) => c.id === pinnedConceptId) : null),
    [pinnedConceptId, concepts],
  )

  const handleSend = async (content: string) => {
    setPendingUser(content)
    try {
      await sendMessage({
        extractionId,
        content,
        conceptId: pinnedConceptId ?? null,
      })
    } finally {
      setPendingUser(null)
    }
  }

  const handleClear = async () => {
    if (!confirm('Clear this tutor conversation?')) return
    await deleteTutorChat(extractionId)
    await queryClient.invalidateQueries({ queryKey: ['tutor', extractionId] })
  }

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && close()}>
      <SheetContent
        side="right"
        className="w-full !max-w-[min(100vw,720px)] lg:!max-w-[760px] flex flex-col gap-0 p-0"
      >
        <SheetHeader className="border-b border-border px-5 py-3">
          <div className="flex items-center gap-2">
            <SheetTitle className="flex min-w-0 flex-1 items-center gap-2">
              <Sparkles className="h-4 w-4 shrink-0 text-brand-purple" />
              <span className="truncate">Tutor · {extractionTitle}</span>
            </SheetTitle>
            {(data?.messages.length ?? 0) > 0 && (
              <Button
                variant="ghost"
                size="xs"
                onClick={handleClear}
                className="shrink-0 text-muted-foreground"
                aria-label="Clear conversation"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Clear
              </Button>
            )}
            <span className="w-6 shrink-0" aria-hidden />
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">Loading…</div>
          ) : (
            <TutorMessageList
              messages={data?.messages ?? []}
              streamingText={streamingText}
              isStreaming={isStreaming}
              pendingUserMessage={pendingUser}
            />
          )}
        </div>

        <div className="border-t border-border bg-background px-5 pt-3 pb-4">
          {pinnedConcept && (
            <div className="mb-2">
              <ConceptPinChip
                conceptTitle={pinnedConcept.title}
                onClear={() => setPinned(null)}
              />
            </div>
          )}
          {error && (
            <p className="mb-2 rounded-md bg-destructive/10 px-2 py-1 text-xs text-destructive">
              {error}
            </p>
          )}
          <TutorInput
            onSend={handleSend}
            disabled={isStreaming}
            isStreaming={isStreaming}
          />
          <TutorDisclaimer />
        </div>
      </SheetContent>
    </Sheet>
  )
}
