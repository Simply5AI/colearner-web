'use client'

import { useState } from 'react'
import { Pencil, Trash2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useDeleteCertification } from '@/lib/hooks/use-profile'
import type { UserCertification } from '@/lib/types'

interface CertificationCardProps {
  certification: UserCertification
  onEdit: (certification: UserCertification) => void
}

export function CertificationCard({ certification, onEdit }: CertificationCardProps) {
  const [isDeleting, setIsDeleting] = useState(false)
  const deleteMutation = useDeleteCertification()

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      await deleteMutation.mutateAsync(certification.id)
      toast.success('Certification removed')
    } catch {
      toast.error('Failed to remove certification')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="flex items-start justify-between rounded-lg border p-4">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{certification.name}</p>
        {certification.issuingOrg && (
          <p className="text-xs text-muted-foreground mt-0.5">{certification.issuingOrg}</p>
        )}
        {certification.credentialUrl && (
          <a
            href={certification.credentialUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-brand-orange hover:underline mt-0.5 inline-block"
          >
            View credential
          </a>
        )}
      </div>
      <div className="flex gap-1 ml-2">
        <Button
          size="icon-sm"
          variant="ghost"
          onClick={() => onEdit(certification)}
          className="h-7 w-7"
        >
          <Pencil className="size-3.5" />
        </Button>
        <Button
          size="icon-sm"
          variant="ghost"
          onClick={handleDelete}
          disabled={isDeleting}
          className="h-7 w-7 text-muted-foreground hover:text-destructive"
        >
          {isDeleting ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
        </Button>
      </div>
    </div>
  )
}
