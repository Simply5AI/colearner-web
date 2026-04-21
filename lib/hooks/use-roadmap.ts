'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import { queryKeys } from '@/lib/api/query-keys'
import {
  getRoadmaps,
  getRoadmap,
  getUnifiedRoadmaps,
  createRoadmap,
  deleteRoadmap,
  captureRoadmapItem,
  skipRoadmapItem,
  getRecommendations,
  generateRecommendations,
  acceptRecommendation,
  dismissRecommendation,
} from '@/lib/api/roadmap'
import type { CreateRoadmapInput } from '@/lib/types'

function useAuthHeaders() {
  const { data: session } = useSession()
  const token = (session as any)?.accessToken as string | undefined
  return token ? { Authorization: `Bearer ${token}` } : null
}

export function useRoadmaps() {
  const headers = useAuthHeaders()
  return useQuery({
    queryKey: queryKeys.roadmaps.list(),
    queryFn: () => getRoadmaps(headers!),
    enabled: !!headers,
    select: (data) => data.roadmaps,
  })
}

export function useRoadmap(id: string) {
  const headers = useAuthHeaders()
  return useQuery({
    queryKey: queryKeys.roadmaps.detail(id),
    queryFn: () => getRoadmap(headers!, id),
    enabled: !!headers && !!id,
    select: (data) => data.roadmap,
  })
}

export function useCreateRoadmap() {
  const headers = useAuthHeaders()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: CreateRoadmapInput) => createRoadmap(headers!, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.roadmaps.all })
    },
  })
}

export function useDeleteRoadmap() {
  const headers = useAuthHeaders()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => deleteRoadmap(headers!, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.roadmaps.all })
    },
  })
}

export function useCaptureRoadmapItem(roadmapId: string) {
  const headers = useAuthHeaders()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ itemId, url }: { itemId: string; url?: string }) =>
      captureRoadmapItem(headers!, roadmapId, itemId, url),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.roadmaps.detail(roadmapId) })
    },
  })
}

export function useSkipRoadmapItem(roadmapId: string) {
  const headers = useAuthHeaders()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (itemId: string) => skipRoadmapItem(headers!, roadmapId, itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.roadmaps.detail(roadmapId) })
    },
  })
}

// ─── Unified ────────────────────────────────────────────────────────────────

export function useUnifiedRoadmaps() {
  const headers = useAuthHeaders()
  return useQuery({
    queryKey: queryKeys.roadmaps.unified(),
    queryFn: () => getUnifiedRoadmaps(headers!),
    enabled: !!headers,
  })
}

// ─── Recommendations ────────────────────────────────────────────────────────

export function useRecommendations(roadmapId: string) {
  const headers = useAuthHeaders()
  return useQuery({
    queryKey: queryKeys.roadmaps.recommendations(roadmapId),
    queryFn: () => getRecommendations(headers!, roadmapId),
    enabled: !!headers && !!roadmapId,
    select: (data) => data.recommendations,
  })
}

export function useGenerateRecommendations(roadmapId: string) {
  const headers = useAuthHeaders()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => generateRecommendations(headers!, roadmapId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.roadmaps.recommendations(roadmapId) })
    },
  })
}

export function useAcceptRecommendation(roadmapId: string) {
  const headers = useAuthHeaders()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ recommendationId, phaseId }: { recommendationId: string; phaseId: string }) =>
      acceptRecommendation(headers!, roadmapId, recommendationId, phaseId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.roadmaps.recommendations(roadmapId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.roadmaps.detail(roadmapId) })
    },
  })
}

export function useDismissRecommendation(roadmapId: string) {
  const headers = useAuthHeaders()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (recommendationId: string) =>
      dismissRecommendation(headers!, roadmapId, recommendationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.roadmaps.recommendations(roadmapId) })
    },
  })
}
