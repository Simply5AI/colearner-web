'use client'

import { useState } from 'react'
import { Download, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { RichTextEditor } from '@/components/editor/RichTextEditor'
import type { TeacherMaterial } from '@/lib/types/teacher'
import ReactMarkdown from 'react-markdown'

interface MaterialViewerProps {
  material: TeacherMaterial
  canDownload?: boolean
  resolveDownloadUrl?: () => Promise<string>
}

function PdfViewer({ url }: { url: string }) {
  return (
    <iframe
      src={url}
      title="PDF preview"
      className="h-[480px] w-full rounded-lg border bg-white"
    />
  )
}

function VideoViewer({ material }: { material: TeacherMaterial }) {
  const url = material.url ?? material.contentUrl
  if (!url) {
    return <p className="text-sm text-muted-foreground">Video URL unavailable.</p>
  }

  const isEmbed = url.includes('youtube') || url.includes('vimeo') || url.includes('/embed/')

  if (isEmbed) {
    return (
      <iframe
        src={url}
        title={material.title}
        className="aspect-video w-full rounded-lg border"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    )
  }

  return (
    <video controls className="w-full rounded-lg border" src={url}>
      <track kind="captions" />
    </video>
  )
}

function ExternalLinkCard({ material }: { material: TeacherMaterial }) {
  return (
    <a
      href={material.externalUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="block overflow-hidden rounded-lg border transition-colors hover:border-brand-teal"
    >
      {material.externalImageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={material.externalImageUrl}
          alt={material.externalTitle ?? material.title}
          className="h-40 w-full object-cover"
        />
      )}
      <div className="space-y-1 p-4">
        <p className="font-medium">{material.externalTitle ?? material.title}</p>
        {material.externalDescription && (
          <p className="text-sm text-muted-foreground">{material.externalDescription}</p>
        )}
        <span className="inline-flex items-center gap-1 text-xs text-brand-teal">
          Open link <ExternalLink className="h-3 w-3" />
        </span>
      </div>
    </a>
  )
}

export function MaterialViewer({
  material,
  canDownload = true,
  resolveDownloadUrl,
}: MaterialViewerProps) {
  const [page, setPage] = useState(1)
  const [isDownloading, setIsDownloading] = useState(false)
  const showDownload =
    material.downloadable && canDownload && (resolveDownloadUrl || material.url || material.contentUrl)

  async function handleDownload() {
    if (!showDownload) return
    setIsDownloading(true)
    try {
      const url = resolveDownloadUrl
        ? await resolveDownloadUrl()
        : (material.url ?? material.contentUrl)
      if (url) window.open(url, '_blank', 'noopener,noreferrer')
    } finally {
      setIsDownloading(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">{material.title}</h3>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {material.type.replaceAll('_', ' ')} · {material.visibility}
          </p>
        </div>
        {showDownload && (
          <Button
            size="sm"
            variant="outline"
            disabled={isDownloading}
            onClick={() => void handleDownload()}
          >
            <Download className="mr-2 h-4 w-4" />
            {isDownloading ? 'Preparing...' : 'Download'}
          </Button>
        )}
      </div>

      {material.type === 'PDF' && material.url && <PdfViewer url={material.url} />}

      {(material.type === 'VIDEO_UPLOAD' || material.type === 'VIDEO_LINK') && (
        <VideoViewer material={material} />
      )}

      {material.type === 'EXTERNAL_LINK' && <ExternalLinkCard material={material} />}

      {material.type === 'RICH_TEXT' && (
        <RichTextEditor value={material.richTextContent ?? null} readOnly />
      )}

      {material.type === 'EXTENSION_CAPTURE' && (
        <div className="prose prose-sm max-w-none rounded-lg border bg-muted/20 p-4">
          <ReactMarkdown>{material.extensionContent ?? ''}</ReactMarkdown>
        </div>
      )}

      {material.type === 'PDF' && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Button type="button" size="sm" variant="outline" onClick={() => setPage((p) => Math.max(1, p - 1))}>
            Previous page
          </Button>
          <span>Page {page}</span>
          <Button type="button" size="sm" variant="outline" onClick={() => setPage((p) => p + 1)}>
            Next page
          </Button>
        </div>
      )}
    </div>
  )
}