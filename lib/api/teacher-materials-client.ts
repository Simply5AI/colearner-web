'use client'

import { ApiError } from '@/lib/api/client'
import type { MaterialVisibility, TeacherMaterial } from '@/lib/types/teacher'

async function materialsFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  })
  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: res.statusText }))
    throw new ApiError(res.status, error.message ?? res.statusText)
  }
  return res.json() as Promise<T>
}

export function listTeacherMaterialsClient(query: {
  planId: string
  topicId?: string
}): Promise<TeacherMaterial[]> {
  const params = new URLSearchParams({ planId: query.planId })
  if (query.topicId) params.set('topicId', query.topicId)
  return materialsFetch(`/api/teacher/materials?${params}`)
}

export function createTeacherMaterialClient(
  body: Omit<TeacherMaterial, 'id'> & {
    storageKey?: string
    mimeType?: string
    sizeBytes?: number
    richTextJson?: Record<string, unknown>
  },
): Promise<TeacherMaterial> {
  return materialsFetch('/api/teacher/materials', { method: 'POST', body: JSON.stringify(body) })
}

export function updateTeacherMaterialClient(
  materialId: string,
  body: Partial<Pick<TeacherMaterial, 'title' | 'visibility' | 'downloadable'>>,
): Promise<TeacherMaterial> {
  return materialsFetch(`/api/teacher/materials/${materialId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}

export function deleteTeacherMaterialClient(materialId: string): Promise<void> {
  return materialsFetch(`/api/teacher/materials/${materialId}`, { method: 'DELETE' })
}

export function createMaterialUploadUrlClient(body: {
  planId: string
  topicId: string
  type: string
  filename: string
  mimeType: string
  sizeBytes: number
}): Promise<{ uploadUrl: string; storageKey: string; expiresIn: number }> {
  return materialsFetch('/api/teacher/materials/upload-url', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function setMaterialVisibilityClient(
  materialId: string,
  visibility: MaterialVisibility,
): Promise<TeacherMaterial> {
  return updateTeacherMaterialClient(materialId, { visibility })
}