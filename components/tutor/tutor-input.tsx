'use client'

import { useState, type KeyboardEvent } from 'react'
import { Send, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface TutorInputProps {
  onSend: (content: string) => void
  disabled: boolean
  isStreaming: boolean
}

export function TutorInput({ onSend, disabled, isStreaming }: TutorInputProps) {
  const [value, setValue] = useState('')

  const canSend = value.trim().length > 0 && !disabled

  const submit = () => {
    if (!canSend) return
    onSend(value.trim())
    setValue('')
  }

  const handleKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  return (
    <div className="flex items-end gap-2 rounded-xl border border-border bg-background p-2 focus-within:border-brand-purple/60">
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value.slice(0, 2000))}
        onKeyDown={handleKey}
        placeholder="Ask a question about this unit…"
        rows={2}
        className="min-h-[44px] max-h-40 flex-1 resize-none bg-transparent px-2 py-1 text-sm outline-none placeholder:text-muted-foreground"
        disabled={disabled}
      />
      <Button
        size="icon-sm"
        variant={canSend ? 'default' : 'ghost'}
        onClick={submit}
        disabled={!canSend}
        aria-label="Send message"
      >
        {isStreaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
      </Button>
    </div>
  )
}
