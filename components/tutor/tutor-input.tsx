'use client'

import { useEffect, useRef, useState, type ClipboardEvent, type KeyboardEvent } from 'react'
import { Send, Loader2, Paperclip, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

interface TutorInputProps {
  onSend: (content: string, image: File | null) => void
  disabled: boolean
  isStreaming: boolean
}

const IMAGE_MAX_SIZE = 10 * 1024 * 1024
const IMAGE_ACCEPTED = ['image/jpeg', 'image/png', 'image/webp']

export function TutorInput({ onSend, disabled, isStreaming }: TutorInputProps) {
  const [value, setValue] = useState('')
  const [image, setImage] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!image) {
      setPreview(null)
      return
    }
    const url = URL.createObjectURL(image)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [image])

  const canSend = (value.trim().length > 0 || image !== null) && !disabled

  const submit = () => {
    if (!canSend) return
    onSend(value.trim(), image)
    setValue('')
    setImage(null)
  }

  const handleKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  const acceptImage = (file: File): boolean => {
    if (!IMAGE_ACCEPTED.includes(file.type)) {
      toast.error('Invalid image', { description: 'Please upload a JPG, PNG, or WEBP image.' })
      return false
    }
    if (file.size > IMAGE_MAX_SIZE) {
      toast.error('Image too large', { description: 'Maximum size is 10MB.' })
      return false
    }
    setImage(file)
    return true
  }

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file) acceptImage(file)
  }

  const handlePaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items
    if (!items) return
    for (const item of items) {
      if (item.kind === 'file' && item.type.startsWith('image/')) {
        const file = item.getAsFile()
        if (file) {
          e.preventDefault()
          acceptImage(file)
          return
        }
      }
    }
  }

  return (
    <div className="rounded-xl border border-border bg-background p-2 focus-within:border-brand-purple/60">
      {preview && (
        <div className="relative mb-2 inline-block">
          <img
            src={preview}
            alt="Attachment preview"
            className="max-h-32 rounded-lg border border-border object-cover"
          />
          <button
            type="button"
            onClick={() => setImage(null)}
            className="absolute -right-2 -top-2 flex size-5 items-center justify-center rounded-full bg-foreground text-background shadow"
            aria-label="Remove attachment"
          >
            <X className="size-3" />
          </button>
        </div>
      )}
      <div className="flex items-end gap-1.5">
        <Button
          size="icon-sm"
          variant="ghost"
          onClick={() => fileRef.current?.click()}
          disabled={disabled}
          aria-label="Attach image"
        >
          <Paperclip className="h-4 w-4" />
        </Button>
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value.slice(0, 2000))}
          onKeyDown={handleKey}
          onPaste={handlePaste}
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
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleFile}
          className="hidden"
          aria-label="Attach image"
        />
      </div>
    </div>
  )
}
