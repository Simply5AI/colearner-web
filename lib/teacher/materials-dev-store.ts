import { mockMaterials } from '@/lib/fixtures/teacher-ui'
import type { MaterialVisibility, TeacherMaterial } from '@/lib/types/teacher'

type MaterialsGlobal = typeof globalThis & {
  __teacherMaterialsStore?: TeacherMaterial[]
}

const storeKey = '__teacherMaterialsStore'

function getStore(): TeacherMaterial[] {
  const globalStore = globalThis as MaterialsGlobal
  if (!globalStore[storeKey]) {
    globalStore[storeKey] = structuredClone(mockMaterials)
  }
  return globalStore[storeKey]!
}

export function listTeacherMaterials(filters?: {
  planId?: string
  topicId?: string
}): TeacherMaterial[] {
  return getStore()
    .filter((material) => (filters?.planId ? material.planId === filters.planId : true))
    .filter((material) => (filters?.topicId ? material.topicId === filters.topicId : true))
}

export function getTeacherMaterial(materialId: string): TeacherMaterial | null {
  const material = getStore().find((entry) => entry.id === materialId)
  return material ? structuredClone(material) : null
}

export function createTeacherMaterial(
  input: Omit<TeacherMaterial, 'id'>,
): TeacherMaterial {
  const material: TeacherMaterial = {
    ...input,
    id: `mat-${crypto.randomUUID().slice(0, 8)}`,
  }
  getStore().unshift(material)
  return structuredClone(material)
}

export function updateTeacherMaterial(
  materialId: string,
  patch: Partial<Pick<TeacherMaterial, 'title' | 'visibility' | 'downloadable' | 'externalUrl' | 'externalTitle'>>,
): TeacherMaterial | null {
  const index = getStore().findIndex((entry) => entry.id === materialId)
  if (index < 0) return null
  getStore()[index] = { ...getStore()[index], ...patch }
  return structuredClone(getStore()[index]!)
}

export function deleteTeacherMaterial(materialId: string): boolean {
  const index = getStore().findIndex((entry) => entry.id === materialId)
  if (index < 0) return false
  getStore().splice(index, 1)
  return true
}

export function reorderTeacherMaterials(topicId: string, orderedIds: string[]): TeacherMaterial[] {
  const topicMaterials = getStore().filter((material) => material.topicId === topicId)
  const others = getStore().filter((material) => material.topicId !== topicId)
  const byId = new Map(topicMaterials.map((material) => [material.id, material]))
  const reordered = orderedIds
    .map((id) => byId.get(id))
    .filter((material): material is TeacherMaterial => Boolean(material))
  const globalStore = globalThis as MaterialsGlobal
  globalStore[storeKey] = [...others, ...reordered]
  return reordered.map((material) => structuredClone(material))
}

export function setMaterialVisibility(
  materialId: string,
  visibility: MaterialVisibility,
): TeacherMaterial | null {
  return updateTeacherMaterial(materialId, { visibility })
}