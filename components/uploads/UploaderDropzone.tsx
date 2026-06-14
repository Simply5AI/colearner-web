'use client'

import { useCallback, useState } from 'react'
import { AlertCircle, CheckCircle2, RefreshCw, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ProgressBar } from '@/components/shared/ProgressBar'
import { cn } from '@/lib/utils'
import type { CompletedUpload, MaterialType, UploadProgress } from '@/lib/types/teacher'

export interface UploadUrlResult {
  uploadUrl: string
  storageKey: string
  mimeType: string
  type: MaterialType
}

interface UploaderDropzoneProps {
  onUploadComplete?: (upload: CompletedUpload) => void
  getUploadUrl?: (file: File) => Promise<UploadUrlResult>
  accept?: string
  maxFiles?: number
  className?: string
}

function uploadWithProgress(file: File, uploadUrl: string, onProgress: (progress: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100))
      }
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve()
      else reject(new Error(`Upload failed (${xhr.status})`))
    }
    xhr.onerror = () => reject(new Error('Upload failed'))
    xhr.open('PUT', uploadUrl)
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream')
    xhr.send(file)
  })
}

export function UploaderDropzone({
  onUploadComplete,
  getUploadUrl,
  accept = '.pdf,.doc,.docx,.ppt,.pptx,video/*',
  maxFiles = 5,
  className,
}: UploaderDropzoneProps) {
  const [items, setItems] = useState<UploadProgress[]>([])
  const [isDragging, setIsDragging] = useState(false)

  const uploadFile = useCallback(
    async (file: File) => {
      if (!getUploadUrl) return

      setItems((current) => [
        ...current,
        { fileName: file.name, progress: 0, status: 'uploading' },
      ])

      try {
        const { uploadUrl, storageKey, mimeType, type } = await getUploadUrl(file)

        await uploadWithProgress(file, uploadUrl, (progress) => {
          setItems((current) =>
            current.map((item) =>
              item.fileName === file.name ? { ...item, progress, status: 'uploading' } : item,
            ),
          )
        })

        setItems((current) =>
          current.map((item) =>
            item.fileName === file.name
              ? { ...item, progress: 100, status: 'completed' }
              : item,
          ),
        )

        onUploadComplete?.({
          fileName: file.name,
          storageKey,
          mimeType,
          type,
          sizeBytes: file.size,
        })
      } catch (error) {
        setItems((current) =>
          current.map((item) =>
            item.fileName === file.name
              ? {
                  ...item,
                  status: 'failed',
                  error: error instanceof Error ? error.message : 'Upload failed',
                }
              : item,
          ),
        )
      }
    },
    [getUploadUrl, onUploadComplete],
  )

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || !getUploadUrl) return
    const files = Array.from(fileList).slice(0, maxFiles)
    for (const file of files) {
      await uploadFile(file)
    }
  }

  return (
    <div className={cn('space-y-3', className)}>
      <label
        onDragOver={(event) => {
          event.preventDefault()
          setIsDragging(true)
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(event) => {
          event.preventDefault()
          setIsDragging(false)
          void handleFiles(event.dataTransfer.files)
        }}
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 text-center transition-colors',
          isDragging ? 'border-brand-teal bg-brand-teal/5' : 'border-muted-foreground/30 hover:border-brand-teal/60',
          !getUploadUrl && 'pointer-events-none opacity-60',
        )}
      >
        <Upload className="mb-2 h-8 w-8 text-muted-foreground" />
        <p className="text-sm font-medium">Drag files here or click to browse</p>
        <p className="mt-1 text-xs text-muted-foreground">PDF, slides, docs, and video files</p>
        <input
          type="file"
          className="sr-only"
          accept={accept}
          multiple
          disabled={!getUploadUrl}
          onChange={(event) => void handleFiles(event.target.files)}
        />
      </label>

      {items.length > 0 && (
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.fileName} className="rounded-lg border p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="truncate text-sm font-medium">{item.fileName}</p>
                {item.status === 'completed' && (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                )}
                {item.status === 'failed' && (
                  <AlertCircle className="h-4 w-4 text-destructive" />
                )}
              </div>
              {item.status === 'uploading' && (
                <ProgressBar value={item.progress} showValue label="Uploading" />
              )}
              {item.status === 'failed' && (
                <p className="text-xs text-destructive">{item.error}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}