'use client'

import { useState } from 'react'
import { Search, Share2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { useShareCapture } from '@/lib/hooks/use-pods'
import type { Extraction } from '@/lib/types'

interface ShareCaptureModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  podId: string
  extractions: Extraction[]
}

export function ShareCaptureModal({ open, onOpenChange, podId, extractions }: ShareCaptureModalProps) {
  const [search, setSearch] = useState('')
  const [note, setNote] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const shareMutation = useShareCapture()

  const filtered = extractions.filter((e) =>
    (e.title ?? '').toLowerCase().includes(search.toLowerCase())
  )

  const handleShare = () => {
    if (!selectedId) return
    shareMutation.mutate(
      { podId, data: { extractionId: selectedId, note: note || undefined } },
      {
        onSuccess: () => {
          onOpenChange(false)
          setSelectedId(null)
          setNote('')
          setSearch('')
        },
      }
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Share a Capture</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search your extractions..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="max-h-48 overflow-y-auto space-y-1 rounded-md border p-1">
            {filtered.length === 0 && (
              <p className="p-3 text-sm text-muted-foreground text-center">No extractions found.</p>
            )}
            {filtered.map((extraction) => (
              <button
                key={extraction.id}
                onClick={() => setSelectedId(extraction.id)}
                className={`w-full rounded-md px-3 py-2 text-left text-sm transition-colors ${
                  selectedId === extraction.id
                    ? 'bg-primary/10 text-primary'
                    : 'hover:bg-accent'
                }`}
              >
                <p className="font-medium truncate">{extraction.title}</p>
                <p className="text-xs text-muted-foreground">
                  {extraction.conceptCount} concepts &middot; {extraction.sourceType}
                </p>
              </button>
            ))}
          </div>

          <Input
            placeholder="Add a note (optional, max 200 chars)"
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, 200))}
            maxLength={200}
          />

          <Button
            className="w-full"
            onClick={handleShare}
            disabled={!selectedId || shareMutation.isPending}
          >
            <Share2 className="h-4 w-4 mr-2" />
            Share with Pod
          </Button>

          {shareMutation.isError && (
            <p className="text-xs text-destructive">{shareMutation.error.message}</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
