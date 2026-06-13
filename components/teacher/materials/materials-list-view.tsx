'use client'

import { useState } from 'react'
import { FileText, Link2, Plus, Trash2, Video } from 'lucide-react'
import { toast } from 'sonner'
import { MaterialViewer } from '@/components/materials/MaterialViewer'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  createTeacherMaterialClient,
  deleteTeacherMaterialClient,
  setMaterialVisibilityClient,
} from '@/lib/api/teacher-materials-client'
import type { MaterialVisibility, TeacherMaterial } from '@/lib/types/teacher'

const typeIcon = {
  PDF: FileText,
  VIDEO_UPLOAD: Video,
  VIDEO_LINK: Video,
  EXTERNAL_LINK: Link2,
  RICH_TEXT: FileText,
  EXTENSION_CAPTURE: FileText,
} as const

interface MaterialsListViewProps {
  planId: string
  topicId: string
  initialMaterials: TeacherMaterial[]
}

export function MaterialsListView({ planId, topicId, initialMaterials }: MaterialsListViewProps) {
  const [materials, setMaterials] = useState(initialMaterials)

  async function handleAdd(type: TeacherMaterial['type']) {
    try {
      const material = await createTeacherMaterialClient({
        planId,
        topicId,
        title: `New ${type.replace('_', ' ').toLowerCase()}`,
        type,
        visibility: 'SUBSCRIBER',
        downloadable: type === 'PDF',
      })
      setMaterials((current) => [material, ...current])
      toast.success('Material added')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to add material')
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
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => void handleAdd('PDF')}>
          <Plus className="h-4 w-4" />
          Upload PDF
        </Button>
        <Button size="sm" variant="outline" onClick={() => void handleAdd('VIDEO_LINK')}>
          Video link
        </Button>
        <Button size="sm" variant="outline" onClick={() => void handleAdd('EXTERNAL_LINK')}>
          External link
        </Button>
        <Button size="sm" variant="outline" onClick={() => void handleAdd('RICH_TEXT')}>
          Rich text
        </Button>
      </div>

      {materials.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No materials yet. Add uploads, links, or notes for this topic.
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
    </div>
  )
}