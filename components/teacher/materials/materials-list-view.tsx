'use client'

import { useState } from 'react'
import { FileText, Link2, Plus, Trash2, Video } from 'lucide-react'
import { toast } from 'sonner'
import { MaterialViewer } from '@/components/materials/MaterialViewer'
import { RichTextEditor } from '@/components/editor/RichTextEditor'
import { UploaderDropzone } from '@/components/uploads/UploaderDropzone'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  createMaterialUploadUrlClient,
  createTeacherMaterialClient,
  deleteTeacherMaterialClient,
  setMaterialVisibilityClient,
} from '@/lib/api/teacher-materials-client'
import type { MaterialType, MaterialVisibility, TeacherMaterial } from '@/lib/types/teacher'

const typeIcon = {
  PDF: FileText,
  VIDEO_UPLOAD: Video,
  VIDEO_LINK: Video,
  EXTERNAL_LINK: Link2,
  RICH_TEXT: FileText,
  EXTENSION_CAPTURE: FileText,
} as const

function fileToMaterialType(file: File): string {
  const name = file.name.toLowerCase()
  if (file.type === 'application/pdf' || name.endsWith('.pdf')) return 'PDF'
  if (
    file.type.includes('presentation') ||
    name.endsWith('.ppt') ||
    name.endsWith('.pptx')
  ) {
    return 'SLIDES'
  }
  if (
    file.type.includes('word') ||
    name.endsWith('.doc') ||
    name.endsWith('.docx')
  ) {
    return 'DOCX'
  }
  if (file.type.startsWith('video/')) return 'VIDEO_UPLOAD'
  return 'PDF'
}

interface MaterialsListViewProps {
  planId: string
  topicId: string
  initialMaterials: TeacherMaterial[]
}

export function MaterialsListView({ planId, topicId, initialMaterials }: MaterialsListViewProps) {
  const [materials, setMaterials] = useState(initialMaterials)
  const [linkDialog, setLinkDialog] = useState<'VIDEO_LINK' | 'EXTERNAL_LINK' | 'RICH_TEXT' | null>(
    null,
  )
  const [linkTitle, setLinkTitle] = useState('')
  const [linkUrl, setLinkUrl] = useState('')
  const [richText, setRichText] = useState<Record<string, unknown>>({ type: 'doc', content: [] })
  const [isSaving, setIsSaving] = useState(false)

  async function handleUploadComplete(upload: {
    fileName: string
    storageKey?: string
    mimeType?: string
    type?: MaterialType
    sizeBytes?: number
  }) {
    if (!upload.storageKey || !upload.type) return
    try {
      const material = await createTeacherMaterialClient({
        planId,
        topicId,
        title: upload.fileName,
        type: upload.type,
        visibility: 'SUBSCRIBER',
        downloadable: upload.type === 'PDF',
        storageKey: upload.storageKey,
        mimeType: upload.mimeType,
        sizeBytes: upload.sizeBytes,
      })
      setMaterials((current) => [material, ...current])
      toast.success('Material uploaded')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save material')
    }
  }

  async function handleCreateLinkMaterial() {
    if (!linkDialog) return
    setIsSaving(true)
    try {
      const material = await createTeacherMaterialClient({
        planId,
        topicId,
        title: linkTitle.trim() || (linkDialog === 'RICH_TEXT' ? 'Rich text note' : 'Link'),
        type: linkDialog,
        visibility: 'SUBSCRIBER',
        downloadable: false,
        ...(linkDialog === 'RICH_TEXT'
          ? { richTextJson: richText }
          : { externalUrl: linkUrl.trim() }),
      })
      setMaterials((current) => [material, ...current])
      toast.success('Material added')
      setLinkDialog(null)
      setLinkTitle('')
      setLinkUrl('')
      setRichText({ type: 'doc', content: [] })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to add material')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleVisibilityChange(materialId: string, visibility: MaterialVisibility) {
    try {
      const updated = await setMaterialVisibilityClient(materialId, visibility)
      setMaterials((current) => current.map((m) => (m.id === materialId ? updated : m)))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update visibility')
    }
  }

  async function handleDelete(materialId: string) {
    try {
      await deleteTeacherMaterialClient(materialId)
      setMaterials((current) => current.filter((m) => m.id !== materialId))
      toast.success('Material deleted')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete material')
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Upload files</CardTitle>
        </CardHeader>
        <CardContent>
          <UploaderDropzone
            getUploadUrl={async (file) => {
              const type = fileToMaterialType(file)
              const result = await createMaterialUploadUrlClient({
                planId,
                topicId,
                type,
                filename: file.name,
                mimeType: file.type || 'application/octet-stream',
                sizeBytes: file.size,
              })
              return {
                uploadUrl: result.uploadUrl,
                storageKey: result.storageKey,
                mimeType: file.type || 'application/octet-stream',
                type: type as MaterialType,
              }
            }}
            onUploadComplete={(upload) => void handleUploadComplete(upload)}
          />
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => setLinkDialog('VIDEO_LINK')}>
          <Video className="h-4 w-4" />
          Video link
        </Button>
        <Button size="sm" variant="outline" onClick={() => setLinkDialog('EXTERNAL_LINK')}>
          <Link2 className="h-4 w-4" />
          External link
        </Button>
        <Button size="sm" variant="outline" onClick={() => setLinkDialog('RICH_TEXT')}>
          <Plus className="h-4 w-4" />
          Rich text
        </Button>
      </div>

      {materials.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No materials yet. Upload files or add links and notes for this topic.
          </CardContent>
        </Card>
      ) : (
        materials.map((material) => {
          const Icon = typeIcon[material.type] ?? FileText
          return (
            <Card key={material.id}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Icon className="h-4 w-4 text-primary" />
                  {material.title}
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Select
                    value={material.visibility}
                    onValueChange={(value) =>
                      void handleVisibilityChange(material.id, value as MaterialVisibility)
                    }
                  >
                    <SelectTrigger className="h-8 w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PREVIEW">Preview</SelectItem>
                      <SelectItem value="SUBSCRIBER">Subscriber</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => void handleDelete(material.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <MaterialViewer material={material} />
              </CardContent>
            </Card>
          )
        })
      )}

      <Dialog open={linkDialog !== null} onOpenChange={(open) => !open && setLinkDialog(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {linkDialog === 'RICH_TEXT'
                ? 'Add rich text note'
                : linkDialog === 'VIDEO_LINK'
                  ? 'Add video link'
                  : 'Add external link'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="material-title">Title</Label>
              <Input
                id="material-title"
                value={linkTitle}
                onChange={(event) => setLinkTitle(event.target.value)}
                placeholder="Resource title"
              />
            </div>
            {linkDialog !== 'RICH_TEXT' && (
              <div className="space-y-2">
                <Label htmlFor="material-url">URL</Label>
                <Input
                  id="material-url"
                  value={linkUrl}
                  onChange={(event) => setLinkUrl(event.target.value)}
                  placeholder="https://"
                  required
                />
              </div>
            )}
            {linkDialog === 'RICH_TEXT' && (
              <RichTextEditor value={richText} onChange={setRichText} />
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkDialog(null)}>
              Cancel
            </Button>
            <Button
              disabled={isSaving || (linkDialog !== 'RICH_TEXT' && !linkUrl.trim())}
              onClick={() => void handleCreateLinkMaterial()}
            >
              {isSaving ? 'Saving...' : 'Add material'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}