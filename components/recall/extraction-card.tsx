'use client'

import Link from 'next/link'
import { Youtube, Globe, FileText, Headphones, Video, BookOpen, HelpCircle } from 'lucide-react'
import type { Extraction } from '@/lib/types'

interface ExtractionCardProps {
  extraction: Extraction
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

    // YouTube: show as "YouTube Video (videoId)"
    if (url.hostname.includes('youtube.com') || url.hostname.includes('youtu.be')) {
      const videoId = url.searchParams.get('v') || url.pathname.split('/').pop()
      if (videoId) return `YouTube Video (${videoId})`
    }

    // Other URLs: use path segment as readable name
    const path = url.pathname.replace(/\/$/, '').split('/').pop()
    if (path && path !== '') {
      return decodeURIComponent(path).replace(/[-_]/g, ' ').replace(/\.\w+$/, '')
    }
    return url.hostname
  } catch {
    return 'Untitled Extraction'
  }
}

export function ExtractionCard({ extraction }: ExtractionCardProps) {
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

  return (
    <Link
      href={`/recall/start/${extraction.id}`}
      className="group block rounded-xl border border-border bg-card p-5 transition-all duration-200 hover:border-brand-orange hover:shadow-md hover:-translate-y-0.5"
    >
      <div className="flex items-start gap-3.5 mb-3">
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

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <BookOpen className="h-3.5 w-3.5" />
          <span><span className="font-semibold text-foreground">{extraction.conceptCount}</span> concepts</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <HelpCircle className="h-3.5 w-3.5" />
          <span><span className="font-semibold text-foreground">{extraction.questionCount}</span> questions</span>
        </div>
      </div>
    </Link>
  )
}
