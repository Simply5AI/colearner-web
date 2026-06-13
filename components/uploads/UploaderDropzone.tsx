'use client'

import { useCallback, useState } from 'react'
import { AlertCircle, CheckCircle2, RefreshCw, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ProgressBar } from '@/components/shared/ProgressBar'
import { cn } from '@/lib/utils'
import type { CompletedUpload, TeacherMaterial, UploadProgress } from '@/lib/types/teacher'

interface UploaderDropzoneProps {
  onUploadComplete?: (upload: CompletedUpload) => void
  getUploadUrl?: (file: File) => Promise<{ uploadUrl: string; material: Pick<TeacherMaterial, 'id' | 'title' | 'type' | 'url' | 'contentUrl'> }>
  accept?: string
  maxFiles?: number
  className?: string
}

function inferMaterialType(file: File): TeacherMaterial['type'] {
  if (file.type === 'application/pdf') return 'PDF'
  if (file.type.startsWith('video/')) return 'VIDEO_UPLOAD'
  return 'EXTERNAL_LINK'
}

async function defaultGetUploadUrl(file: File) {
  // Mock signed URL flow for W8 dev usage until B3 ships.
  await new Promise((resolve) => setTimeout(resolve, 400))
  return {
    uploadUrl: URL.createObjectURL(file),
    material: {
      id: crypto.randomUUID(),
      title: file.name,
      type: inferMaterialType(file),
      url: URL.createObjectURL(file),
    },
  }
}

export function UploaderDropzone({
  onUploadComplete,
  getUploadUrl = defaultGetUploadUrl,
  accept = '.pdf,.doc,.docx,.ppt,.pptx,video/*',
  maxFiles = 5,
  className,
}: UploaderDropzoneProps) {
  const [items, setItems] = useState<UploadProgress[]>([])
  const [isDragging, setIsDragging] = useState(false)

  const uploadFile = useCallback(
    async (file: File) => {
      setItems((current) => [
        ...current,
        { fileName: file.name, progress: 0, status: 'uploading' },
      ])

      try {
        const { uploadUrl, material } = await getUploadUrl(file)

        // Simulate progress for direct PUT uploads.
        for (const progress of [25, 50, 75, 100]) {
          await new Promise((resolve) => setTimeout(resolve, 120))
          setItems((current) =>
            current.map((item) =>
              item.fileName === file.name ? { ...item, progress, status: 'uploading' } : item,
            ),
          )
        }

        // In production this is a PUT to the signed URL.
        void uploadUrl

        setItems((current) =>
          current.map((item) =>
            item.fileName === file.name
              ? { ...item, progress: 100, status: 'completed' }
              : item,
          ),
        )
        onUploadComplete?.({ fileName: file.name, material })
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
    if (!fileList) return
    const files = Array.from(fileList).slice(0, maxFiles)
    await Promise.all(files.map((file) => uploadFile(file)))
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
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-destructive">{item.error}</p>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const file = new File(['retry'], item.fileName)
                      void uploadFile(file)
                    }}
                  >
                    <RefreshCw className="mr-1 h-3 w-3" />
                    Retry
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}