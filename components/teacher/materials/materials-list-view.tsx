'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { FileText, GripVertical, Link2, Plus, Trash2, Video } from 'lucide-react'
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
import { Checkbox } from '@/components/ui/checkbox'
import { listExtractions } from '@/lib/api/extraction'
import {
  createMaterialUploadUrlClient,
  createTeacherMaterialClient,
  deleteTeacherMaterialClient,
  getMaterialDownloadUrlClient,
  linkMaterialExtractionClient,
  reorderMaterialsClient,
  setMaterialVisibilityClient,
  updateTeacherMaterialClient,
} from '@/lib/api/teacher-materials-client'
import type { Extraction } from '@/lib/types'
import type { MaterialType, MaterialVisibility, TeacherMaterial } from '@/lib/types/teacher'

const typeIcon = {
  PDF: FileText,
  VIDEO_UPLOAD: Video,
  VIDEO_LINK: Video,
  EXTERNAL_LINK: Link2,
  RICH_TEXT: FileText,
  EXTENSION_CAPTURE: FileText,
} as const

const UPLOAD_TYPES = new Set(['PDF', 'VIDEO_UPLOAD'])

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

function SortableMaterialCard({
  material,
  onVisibilityChange,
  onDownloadableChange,
  onDelete,
}: {
  material: TeacherMaterial
  onVisibilityChange: (materialId: string, visibility: MaterialVisibility) => void
  onDownloadableChange: (materialId: string, downloadable: boolean) => void
  onDelete: (materialId: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: material.id,
  })
  const Icon = typeIcon[material.type] ?? FileText
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  }

  return (
    <Card ref={setNodeRef} style={style}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <button
            type="button"
            className="cursor-grab text-muted-foreground hover:text-foreground"
            aria-label="Drag to reorder"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-4 w-4" />
          </button>
          <Icon className="h-4 w-4 text-primary" />
          {material.title}
        </CardTitle>
        <div className="flex items-center gap-2">
          {UPLOAD_TYPES.has(material.type) && (
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <Checkbox
                checked={material.downloadable}
                onCheckedChange={(checked) =>
                  onDownloadableChange(material.id, checked === true)
                }
              />
              Download
            </label>
          )}
          <Select
            value={material.visibility}
            onValueChange={(value) => onVisibilityChange(material.id, value as MaterialVisibility)}
          >
            <SelectTrigger className="h-8 w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="PREVIEW">Preview</SelectItem>
              <SelectItem value="SUBSCRIBER">Subscriber</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" variant="ghost" onClick={() => onDelete(material.id)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <MaterialViewer
          material={material}
          resolveDownloadUrl={
            material.downloadable
              ? async () => {
                  const result = await getMaterialDownloadUrlClient(material.id)
                  return result.downloadUrl
                }
              : undefined
          }
        />
      </CardContent>
    </Card>
  )
}

interface MaterialsListViewProps {
  planId: string
  topicId: string
  initialMaterials: TeacherMaterial[]
}

export function MaterialsListView({ planId, topicId, initialMaterials }: MaterialsListViewProps) {
  const { data: session } = useSession()
  const [materials, setMaterials] = useState(
    [...initialMaterials].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
  )
  const [linkDialog, setLinkDialog] = useState<
    'VIDEO_LINK' | 'EXTERNAL_LINK' | 'RICH_TEXT' | 'EXTENSION_CAPTURE' | null
  >(null)
  const [linkTitle, setLinkTitle] = useState('')
  const [linkUrl, setLinkUrl] = useState('')
  const [richText, setRichText] = useState<Record<string, unknown>>({ type: 'doc', content: [] })
  const [isSaving, setIsSaving] = useState(false)
  const [extractions, setExtractions] = useState<Extraction[]>([])
  const [selectedExtractionId, setSelectedExtractionId] = useState('')
  const [isLoadingExtractions, setIsLoadingExtractions] = useState(false)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))
  const materialIds = useMemo(() => materials.map((material) => material.id), [materials])

  useEffect(() => {
    if (linkDialog !== 'EXTENSION_CAPTURE' || !session?.accessToken) return
    setIsLoadingExtractions(true)
    listExtractions({ Authorization: `Bearer ${session.accessToken}` }, { status: 'COMPLETED', limit: 50 })
      .then((result) => setExtractions(result.data))
      .catch((error) => {
        toast.error(error instanceof Error ? error.message : 'Failed to load captures')
      })
      .finally(() => setIsLoadingExtractions(false))
  }, [linkDialog, session?.accessToken])

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
      setMaterials((current) => [...current, material])
      toast.success('Material uploaded')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save material')
    }
  }

  async function handleCreateLinkMaterial() {
    if (!linkDialog) return
    setIsSaving(true)
    try {
      const material =
        linkDialog === 'EXTENSION_CAPTURE'
          ? await linkMaterialExtractionClient({
              planId,
              topicId,
              extractionId: selectedExtractionId,
              title: linkTitle.trim() || 'Captured content',
              visibility: 'SUBSCRIBER',
            })
          : await createTeacherMaterialClient({
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
      setMaterials((current) => [...current, material])
      toast.success('Material added')
      setLinkDialog(null)
      setLinkTitle('')
      setLinkUrl('')
      setRichText({ type: 'doc', content: [] })
      setSelectedExtractionId('')
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

  async function handleDownloadableChange(materialId: string, downloadable: boolean) {
    try {
      const updated = await updateTeacherMaterialClient(materialId, { downloadable })
      setMaterials((current) => current.map((m) => (m.id === materialId ? updated : m)))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update download setting')
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

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = materials.findIndex((material) => material.id === active.id)
    const newIndex = materials.findIndex((material) => material.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return

    const reordered = arrayMove(materials, oldIndex, newIndex)
    setMaterials(reordered)

    try {
      const updated = await reorderMaterialsClient({
        planId,
        items: reordered.map((material, index) => ({ id: material.id, orderIndex: index })),
      })
      setMaterials(updated)
    } catch (error) {
      setMaterials(materials)
      toast.error(error instanceof Error ? error.message : 'Failed to reorder materials')
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
        <Button size="sm" variant="outline" onClick={() => setLinkDialog('EXTENSION_CAPTURE')}>
          <FileText className="h-4 w-4" />
          Extension capture
        </Button>
      </div>

      {materials.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No materials yet. Upload files or add links and notes for this topic.
          </CardContent>
        </Card>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={materialIds} strategy={verticalListSortingStrategy}>
            <div className="space-y-4">
              {materials.map((material) => (
                <SortableMaterialCard
                  key={material.id}
                  material={material}
                  onVisibilityChange={(id, visibility) => void handleVisibilityChange(id, visibility)}
                  onDownloadableChange={(id, downloadable) =>
                    void handleDownloadableChange(id, downloadable)
                  }
                  onDelete={(id) => void handleDelete(id)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <Dialog open={linkDialog !== null} onOpenChange={(open) => !open && setLinkDialog(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {linkDialog === 'RICH_TEXT'
                ? 'Add rich text note'
                : linkDialog === 'VIDEO_LINK'
                  ? 'Add video link'
                  : linkDialog === 'EXTENSION_CAPTURE'
                    ? 'Link extension capture'
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
            {linkDialog === 'EXTENSION_CAPTURE' && (
              <div className="space-y-2">
                <Label htmlFor="material-extraction">Completed capture</Label>
                <Select
                  value={selectedExtractionId}
                  onValueChange={(value) => setSelectedExtractionId(value ?? '')}
                >
                  <SelectTrigger id="material-extraction">
                    <SelectValue
                      placeholder={
                        isLoadingExtractions ? 'Loading captures...' : 'Select a capture'
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {extractions.map((extraction) => (
                      <SelectItem key={extraction.id} value={extraction.id}>
                        {extraction.title || extraction.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {linkDialog !== 'RICH_TEXT' && linkDialog !== 'EXTENSION_CAPTURE' && (
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
              disabled={
                isSaving ||
                (linkDialog === 'EXTENSION_CAPTURE' && !selectedExtractionId) ||
                (linkDialog !== 'RICH_TEXT' &&
                  linkDialog !== 'EXTENSION_CAPTURE' &&
                  !linkUrl.trim())
              }
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