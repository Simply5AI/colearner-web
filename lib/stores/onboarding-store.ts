'use client'

import { create } from 'zustand'
import type { LearningGoal, UserProfile } from '@/lib/types'

interface OnboardingState {
  displayName: string
  bio: string
  avatarPreviewUrl: string | null
  avatarFile: File | null

  goal: LearningGoal | null
  goalTitle: string
  dailyGoalMinutes: number

  selectedSkills: string[]

  setProfile: (data: {
    displayName: string
    bio: string
    avatarPreviewUrl?: string | null
    avatarFile?: File | null
  }) => void
  setGoal: (goal: LearningGoal) => void
  setGoalTitle: (title: string) => void
  setDailyGoalMinutes: (minutes: number) => void
  toggleSkill: (skill: string) => void
  removeSkill: (skill: string) => void
  hydrate: (profile: UserProfile) => void
  reset: () => void
}

const initialState = {
  displayName: '',
  bio: '',
  avatarPreviewUrl: null as string | null,
  avatarFile: null as File | null,
  goal: null as LearningGoal | null,
  goalTitle: '',
  dailyGoalMinutes: 15,
  selectedSkills: [] as string[],
}

export const useOnboardingStore = create<OnboardingState>((set) => ({
  ...initialState,

  setProfile: (data) =>
    set({
      displayName: data.displayName,
      bio: data.bio,
      avatarPreviewUrl: data.avatarPreviewUrl ?? null,
      ...(data.avatarFile !== undefined ? { avatarFile: data.avatarFile } : {}),
    }),

  setGoal: (goal) => set({ goal }),

  setGoalTitle: (title) => set({ goalTitle: title }),

  setDailyGoalMinutes: (minutes) => set({ dailyGoalMinutes: minutes }),

  toggleSkill: (skill) =>
    set((state) => ({
      selectedSkills: state.selectedSkills.includes(skill)
        ? state.selectedSkills.filter((s) => s !== skill)
        : [...state.selectedSkills, skill],
    })),

  removeSkill: (skill) =>
    set((state) => ({
      selectedSkills: state.selectedSkills.filter((s) => s !== skill),
    })),

  hydrate: (profile) =>
    set({
      displayName: profile.name || '',
      bio: profile.bio || '',
      avatarPreviewUrl: profile.avatarUrl || null,
      avatarFile: null,
      goal: (profile.learningGoal?.toLowerCase() as LearningGoal) || null,
      dailyGoalMinutes: profile.dailyTimeMinutes || 15,
      selectedSkills: profile.topics?.map((t) => t.slug) || [],
    }),

  reset: () => set(initialState),
}))
