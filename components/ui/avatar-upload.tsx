'use client'

import { useRef, useState, useCallback, useEffect } from 'react'
import { User, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

const MAX_SIZE_MB = 5
const ACCEPTED_TYPES = ['image/jpeg', 'image/png']

interface AvatarUploadProps {
  previewUrl?: string | null
  onFileSelect: (file: File, previewUrl: string) => void
  onRemove?: () => void
  className?: string
}

export function AvatarUpload({ previewUrl, onFileSelect, onRemove, className }: AvatarUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [localPreview, setLocalPreview] = useState<string | null>(previewUrl ?? null)

  useEffect(() => {
    if (previewUrl !== undefined) {
      setLocalPreview(previewUrl ?? null)
    }
  }, [previewUrl])

  const handleClick = useCallback(() => {
    inputRef.current?.click()
  }, [])

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return

      if (!ACCEPTED_TYPES.includes(file.type)) {
        toast.error('Invalid file type', { description: 'Please upload a JPG or PNG image.' })
        return
      }

      if (file.size > MAX_SIZE_MB * 1024 * 1024) {
        toast.error('File too large', { description: `Maximum size is ${MAX_SIZE_MB}MB.` })
        return
      }

      const url = URL.createObjectURL(file)
      setLocalPreview(url)
      onFileSelect(file, url)

      // Reset input so the same file can be re-selected
      e.target.value = ''
    },
    [onFileSelect]
  )

  // Cleanup object URL on unmount
  useEffect(() => {
    return () => {
      if (localPreview?.startsWith('blob:')) {
        URL.revokeObjectURL(localPreview)
      }
    }
  }, [localPreview])

  return (
    <div className={cn('flex items-center gap-5', className)}>
      <button
        type="button"
        onClick={handleClick}
        className="group relative flex size-20 shrink-0 items-center justify-center rounded-full border-2 border-dashed border-border bg-muted/50 transition-colors hover:border-brand-orange"
      >
        {localPreview ? (
          <img
            src={localPreview}
            alt="Avatar preview"
            className="size-full rounded-full object-cover"
          />
        ) : (
          <User className="size-8 text-muted-foreground" />
        )}
        <div className="absolute -bottom-0.5 -right-0.5 flex size-6 items-center justify-center rounded-full border-2 border-background bg-brand-orange">
          <Plus className="size-3 text-white" />
        </div>
      </button>

      <div>
        <h4 className="text-sm font-bold">Upload a photo</h4>
        <p className="text-[11px] text-muted-foreground">JPG or PNG, max 5MB. This is optional.</p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png"
        onChange={handleChange}
        className="hidden"
        aria-label="Upload avatar"
      />
    </div>
  )
}
