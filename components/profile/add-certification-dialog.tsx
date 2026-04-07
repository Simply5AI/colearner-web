'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAddCertification, useUpdateCertification } from '@/lib/hooks/use-profile'
import type { UserCertification } from '@/lib/types'

interface AddCertificationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  editData?: UserCertification | null
}

export function AddCertificationDialog({ open, onOpenChange, editData }: AddCertificationDialogProps) {
  const addMutation = useAddCertification()
  const updateMutation = useUpdateCertification()

  const [name, setName] = useState('')
  const [issuingOrg, setIssuingOrg] = useState('')
  const [credentialUrl, setCredentialUrl] = useState('')

  useEffect(() => {
    if (editData) {
      setName(editData.name)
      setIssuingOrg(editData.issuingOrg || '')
      setCredentialUrl(editData.credentialUrl || '')
    } else {
      setName('')
      setIssuingOrg('')
      setCredentialUrl('')
    }
  }, [editData, open])

  const isPending = addMutation.isPending || updateMutation.isPending

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error('Certification name is required')
      return
    }

    const data = {
      name: name.trim(),
      issuingOrg: issuingOrg.trim() || undefined,
      credentialUrl: credentialUrl.trim() || undefined,
    }

    try {
      if (editData) {
        await updateMutation.mutateAsync({ id: editData.id, data })
        toast.success('Certification updated')
      } else {
        await addMutation.mutateAsync(data)
        toast.success('Certification added')
      }
      onOpenChange(false)
    } catch {
      toast.error(editData ? 'Failed to update certification' : 'Failed to add certification')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editData ? 'Edit Certification' : 'Add Certification'}</DialogTitle>
          <DialogDescription>
            {editData ? 'Update your certification details.' : 'Add a professional certification.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="cert-name">Certification Name</Label>
            <Input
              id="cert-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. AWS Solutions Architect"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="issuing-org">Issuing Organization (optional)</Label>
            <Input
              id="issuing-org"
              value={issuingOrg}
              onChange={(e) => setIssuingOrg(e.target.value)}
              placeholder="e.g. Amazon Web Services"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="credential-url">Credential URL (optional)</Label>
            <Input
              id="credential-url"
              value={credentialUrl}
              onChange={(e) => setCredentialUrl(e.target.value)}
              placeholder="https://..."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isPending}
            className="bg-brand-orange hover:bg-brand-orange-dark text-white"
          >
            {isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
            {editData ? 'Save' : 'Add'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
