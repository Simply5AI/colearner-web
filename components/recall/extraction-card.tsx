'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Youtube, Globe, FileText, Headphones, Video, BookOpen, HelpCircle, Trash2, Loader2, Clock } from 'lucide-react'
import { resolveIcon } from '@/lib/utils/topic-icons'
import { formatDuration } from '@/lib/utils'
import { toast } from 'sonner'
import { useSession } from 'next-auth/react'
import { deleteExtraction } from '@/lib/api/extraction'
import type { Extraction } from '@/lib/types'

interface ExtractionCardProps {
  extraction: Extraction
  onDeleted?: (id: string) => void
}

const sourceTypeConfig: Record<string, { label: string; icon: React.ReactNode; color: string; bg: string }> = {
  YOUTUBE: { label: 'YouTube', icon: <Youtube className="h-4 w-4" />, color: 'text-red-500', bg: 'bg-red-500/10' },
  WEB: { label: 'Web', icon: <Globe className="h-4 w-4" />, color: 'text-blue-500', bg: 'bg-blue-500/10' },
  DOCUMENT: { label: 'Document', icon: <FileText className="h-4 w-4" />, color: 'text-amber-600', bg: 'bg-amber-600/10' },
  AUDIO: { label: 'Audio', icon: <Headphones className="h-4 w-4" />, color: 'text-purple-500', bg: 'bg-purple-500/10' },
  VIDEO: { label: 'Video', icon: <Video className="h-4 w-4" />, color: 'text-teal-500', bg: 'bg-teal-500/10' },
}

function getDisplayTitle(extraction: Extraction): string {
  if (extraction.title) return extraction.title

  try {
    const url = new URL(extraction.videoUrl)

    if (url.hostname.includes('youtube.com') || url.hostname.includes('youtu.be')) {
      const videoId = url.searchParams.get('v') || url.pathname.split('/').pop()
      if (videoId) return `YouTube Video (${videoId})`
    }

    const path = url.pathname.replace(/\/$/, '').split('/').pop()
    if (path && path !== '') {
      return decodeURIComponent(path).replace(/[-_]/g, ' ').replace(/\.\w+$/, '')
    }
    return url.hostname
  } catch {
    return 'Untitled Extraction'
  }
}

export function ExtractionCard({ extraction, onDeleted }: ExtractionCardProps) {
  const { data: session } = useSession()
  const [showConfirm, setShowConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const config = sourceTypeConfig[extraction.sourceType] || {
    label: extraction.sourceType,
    icon: <FileText className="h-4 w-4" />,
    color: 'text-muted-foreground',
    bg: 'bg-muted',
  }

  const displayTitle = getDisplayTitle(extraction)
  const formattedDate = new Date(extraction.createdAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()

    if (!showConfirm) {
      setShowConfirm(true)
      return
    }

    if (!session?.accessToken) return
    setDeleting(true)

    try {
      await deleteExtraction(
        { Authorization: `Bearer ${session.accessToken}` },
        extraction.id
      )
      toast.success('Extraction removed')
      onDeleted?.(extraction.id)
    } catch {
      toast.error('Failed to remove extraction')
    } finally {
      setDeleting(false)
      setShowConfirm(false)
    }
  }

  function handleCancelDelete(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    setShowConfirm(false)
  }

  return (
    <Link
      href={`/recall/start/${extraction.id}`}
      className="group relative block rounded-xl border border-border bg-card p-5 transition-all duration-200 hover:border-brand-orange hover:shadow-md hover:-translate-y-0.5"
    >
      {/* Delete button — top-right */}
      <div className="absolute top-3 right-3">
        {showConfirm ? (
          <div
            className="flex items-center gap-1.5"
            onClick={(e) => e.preventDefault()}
          >
            <button
              onClick={handleCancelDelete}
              className="rounded-md px-2 py-1 text-[10px] font-semibold text-muted-foreground hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="flex items-center gap-1 rounded-md bg-destructive/10 px-2 py-1 text-[10px] font-semibold text-destructive hover:bg-destructive/20 transition-colors disabled:opacity-50"
            >
              {deleting ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Trash2 className="h-3 w-3" />
              )}
              Remove
            </button>
          </div>
        ) : (
          <button
            onClick={handleDelete}
            className="rounded-md p-1.5 text-muted-foreground/40 opacity-0 transition-all hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
            aria-label="Remove extraction"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <div className="flex items-start gap-3.5 mb-3 pr-8">
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${config.bg} ${config.color} shrink-0`}>
          {config.icon}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold text-foreground truncate group-hover:text-brand-orange transition-colors">
            {displayTitle}
          </h3>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className={`text-[10px] font-semibold uppercase tracking-wider ${config.color}`}>
              {config.label}
            </span>
            <span className="text-muted-foreground/40">·</span>
            <span className="text-[10px] text-muted-foreground">{formattedDate}</span>
          </div>
        </div>
      </div>

      {extraction.description && (
        <p className="mb-3 text-xs text-muted-foreground line-clamp-2">{extraction.description}</p>
      )}

      {/* Topic badges */}
      {extraction.topics && extraction.topics.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1">
          {extraction.topics.map((et) => (
            <span
              key={et.topic.slug}
              className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
            >
              <span className="text-[10px]">{resolveIcon(et.topic.icon)}</span>
              {et.topic.name}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <BookOpen className="h-3.5 w-3.5" />
          <span><span className="font-semibold text-foreground">{extraction.conceptCount}</span> concepts</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <HelpCircle className="h-3.5 w-3.5" />
          <span><span className="font-semibold text-foreground">{extraction.questionCount}</span> questions</span>
        </div>
        {extraction.totalRecallSeconds != null && extraction.totalRecallSeconds > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            <span><span className="font-semibold text-foreground">{formatDuration(extraction.totalRecallSeconds)}</span> studied</span>
          </div>
        )}
      </div>
    </Link>
  )
}
