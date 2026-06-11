'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import {
  getUserPods,
  getPod,
  createPod,
  updatePod,
  deletePod,
  inviteMember,
  joinByCode,
  joinByToken,
  removeMember,
  updatePrivacy,
  shareCapture,
  savePodCapture,
  unsavePodCapture,
  getPodCaptureComments,
  getPodCapturePreview,
  createPodCaptureComment,
  getPodCaptures,
  addCaptureToQueue,
  getPodLeaderboard,
  getPodActivity,
  getPodMessages,
  createPodMessage,
  uploadPodAttachment,
} from '@/lib/api/pods'
import { queryKeys } from '@/lib/api/query-keys'
import type {
  Pod,
  CreatePodInput,
  UpdatePodInput,
  UpdatePrivacyInput,
  ShareCaptureInput,
  CreateMessageInput,
  CreateCommentInput,
} from '@/lib/types/pods'

function useAuthHeaders() {
  const { data: session } = useSession()
  const token = session?.accessToken
  if (!token) return null
  return { Authorization: `Bearer ${token}` }
}

// ---- Queries ----

export function useUserPods(initialData?: Pod[]) {
  const { data: session } = useSession()
  return useQuery({
    queryKey: queryKeys.pods.list(),
    queryFn: () => {
      if (!session?.accessToken) throw new Error('Not authenticated')
      return getUserPods({ Authorization: `Bearer ${session.accessToken}` })
    },
    enabled: !!session?.accessToken,
    initialData,
  })
}

export function usePodDetail(id: string | null) {
  const { data: session } = useSession()
  return useQuery({
    queryKey: id ? queryKeys.pods.detail(id) : [...queryKeys.pods.all, 'detail', '__none__'],
    queryFn: () => {
      if (!session?.accessToken || !id) throw new Error('Not authenticated')
      return getPod({ Authorization: `Bearer ${session.accessToken}` }, id)
    },
    enabled: !!session?.accessToken && !!id,
  })
}

export function usePodLeaderboard(podId: string) {
  const { data: session } = useSession()
  return useQuery({
    queryKey: queryKeys.pods.leaderboard(podId),
    queryFn: () => {
      if (!session?.accessToken) throw new Error('Not authenticated')
      return getPodLeaderboard({ Authorization: `Bearer ${session.accessToken}` }, podId)
    },
    enabled: !!session?.accessToken,
  })
}

export function usePodActivity(podId: string) {
  const { data: session } = useSession()
  return useQuery({
    queryKey: queryKeys.pods.activity(podId),
    queryFn: () => {
      if (!session?.accessToken) throw new Error('Not authenticated')
      return getPodActivity({ Authorization: `Bearer ${session.accessToken}` }, podId)
    },
    enabled: !!session?.accessToken,
  })
}

export function usePodCaptures(podId: string, page = 1) {
  const { data: session } = useSession()
  return useQuery({
    queryKey: queryKeys.pods.captures(podId, page),
    queryFn: () => {
      if (!session?.accessToken) throw new Error('Not authenticated')
      return getPodCaptures(
        { Authorization: `Bearer ${session.accessToken}` },
        podId,
        { page, limit: 20 }
      )
    },
    enabled: !!session?.accessToken,
  })
}

export function usePodMessages(podId: string) {
  const { data: session } = useSession()
  return useQuery({
    queryKey: queryKeys.pods.messages(podId),
    queryFn: () => {
      if (!session?.accessToken) throw new Error('Not authenticated')
      return getPodMessages({ Authorization: `Bearer ${session.accessToken}` }, podId)
    },
    enabled: !!session?.accessToken,
  })
}

export function usePodCaptureComments(podId: string, captureId: string | null) {
  const { data: session } = useSession()
  return useQuery({
    queryKey: captureId
      ? queryKeys.pods.comments(podId, captureId)
      : [...queryKeys.pods.all, 'comments', podId, '__none__'],
    queryFn: () => {
      if (!session?.accessToken || !captureId) throw new Error('Not authenticated')
      return getPodCaptureComments(
        { Authorization: `Bearer ${session.accessToken}` },
        podId,
        captureId
      )
    },
    enabled: !!session?.accessToken && !!captureId,
  })
}

export function usePodCapturePreview(podId: string, captureId: string | null) {
  const { data: session } = useSession()
  return useQuery({
    queryKey: captureId
      ? [...queryKeys.pods.captures(podId), 'preview', captureId]
      : [...queryKeys.pods.all, 'captures', podId, 'preview', '__none__'],
    queryFn: () => {
      if (!session?.accessToken || !captureId) throw new Error('Not authenticated')
      return getPodCapturePreview(
        { Authorization: `Bearer ${session.accessToken}` },
        podId,
        captureId
      )
    },
    enabled: !!session?.accessToken && !!captureId,
  })
}

// ---- Mutations ----

export function useCreatePod() {
  const { data: session } = useSession()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreatePodInput) => {
      if (!session?.accessToken) throw new Error('Not authenticated')
      return createPod({ Authorization: `Bearer ${session.accessToken}` }, data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.pods.list() })
    },
  })
}

export function useUpdatePod() {
  const { data: session } = useSession()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdatePodInput }) => {
      if (!session?.accessToken) throw new Error('Not authenticated')
      return updatePod({ Authorization: `Bearer ${session.accessToken}` }, id, data)
    },
    onSuccess: (_result, { id }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.pods.list() })
      queryClient.invalidateQueries({ queryKey: queryKeys.pods.detail(id) })
    },
  })
}

export function useDeletePod() {
  const { data: session } = useSession()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => {
      if (!session?.accessToken) throw new Error('Not authenticated')
      return deletePod({ Authorization: `Bearer ${session.accessToken}` }, id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.pods.list() })
    },
  })
}

export function useInviteMember() {
  const { data: session } = useSession()
  return useMutation({
    mutationFn: ({ podId, email }: { podId: string; email: string }) => {
      if (!session?.accessToken) throw new Error('Not authenticated')
      return inviteMember({ Authorization: `Bearer ${session.accessToken}` }, podId, email)
    },
  })
}

export function useJoinByCode() {
  const { data: session } = useSession()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (code: string) => {
      if (!session?.accessToken) throw new Error('Not authenticated')
      return joinByCode({ Authorization: `Bearer ${session.accessToken}` }, code)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.pods.list() })
    },
  })
}

export function useJoinByToken() {
  const { data: session } = useSession()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (token: string) => {
      if (!session?.accessToken) throw new Error('Not authenticated')
      return joinByToken({ Authorization: `Bearer ${session.accessToken}` }, token)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.pods.list() })
    },
  })
}

export function useRemoveMember() {
  const { data: session } = useSession()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ podId, userId }: { podId: string; userId: string }) => {
      if (!session?.accessToken) throw new Error('Not authenticated')
      return removeMember({ Authorization: `Bearer ${session.accessToken}` }, podId, userId)
    },
    onSuccess: (_result, { podId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.pods.detail(podId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.pods.list() })
    },
  })
}

export function useUpdatePrivacy() {
  const { data: session } = useSession()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ podId, data }: { podId: string; data: UpdatePrivacyInput }) => {
      if (!session?.accessToken) throw new Error('Not authenticated')
      return updatePrivacy({ Authorization: `Bearer ${session.accessToken}` }, podId, data)
    },
    onSuccess: (_result, { podId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.pods.detail(podId) })
    },
  })
}

export function useShareCapture() {
  const { data: session } = useSession()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ podId, data }: { podId: string; data: ShareCaptureInput }) => {
      if (!session?.accessToken) throw new Error('Not authenticated')
      return shareCapture({ Authorization: `Bearer ${session.accessToken}` }, podId, data)
    },
    onSuccess: (_result, { podId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.pods.captures(podId) })
    },
  })
}

export function useSavePodCapture() {
  const { data: session } = useSession()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ podId, captureId }: { podId: string; captureId: string }) => {
      if (!session?.accessToken) throw new Error('Not authenticated')
      return savePodCapture({ Authorization: `Bearer ${session.accessToken}` }, podId, captureId)
    },
    onSuccess: (_result, { podId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.pods.captures(podId) })
    },
  })
}

export function useUnsavePodCapture() {
  const { data: session } = useSession()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ podId, captureId }: { podId: string; captureId: string }) => {
      if (!session?.accessToken) throw new Error('Not authenticated')
      return unsavePodCapture({ Authorization: `Bearer ${session.accessToken}` }, podId, captureId)
    },
    onSuccess: (_result, { podId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.pods.captures(podId) })
    },
  })
}

export function useCreatePodMessage() {
  const { data: session } = useSession()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ podId, data }: { podId: string; data: CreateMessageInput }) => {
      if (!session?.accessToken) throw new Error('Not authenticated')
      return createPodMessage({ Authorization: `Bearer ${session.accessToken}` }, podId, data)
    },
    onSuccess: (_result, { podId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.pods.messages(podId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.pods.activity(podId) })
    },
  })
}

export function useUploadPodAttachment() {
  const { data: session } = useSession()
  return useMutation({
    mutationFn: ({ podId, file }: { podId: string; file: File }) => {
      if (!session?.accessToken) throw new Error('Not authenticated')
      return uploadPodAttachment({ Authorization: `Bearer ${session.accessToken}` }, podId, file)
    },
  })
}

export function useCreatePodCaptureComment() {
  const { data: session } = useSession()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      podId,
      captureId,
      data,
    }: {
      podId: string
      captureId: string
      data: CreateCommentInput
    }) => {
      if (!session?.accessToken) throw new Error('Not authenticated')
      return createPodCaptureComment(
        { Authorization: `Bearer ${session.accessToken}` },
        podId,
        captureId,
        data
      )
    },
    onSuccess: (_result, { podId, captureId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.pods.comments(podId, captureId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.pods.captures(podId) })
    },
  })
}

export function useAddCaptureToQueue() {
  const { data: session } = useSession()
  return useMutation({
    mutationFn: ({ podId, captureId }: { podId: string; captureId: string }) => {
      if (!session?.accessToken) throw new Error('Not authenticated')
      return addCaptureToQueue(
        { Authorization: `Bearer ${session.accessToken}` },
        podId,
        captureId
      )
    },
  })
}
