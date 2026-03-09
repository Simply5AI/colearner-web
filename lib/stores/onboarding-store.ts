'use client'

import { create } from 'zustand'
import type { LearningGoal } from '@/lib/types'

interface OnboardingState {
  displayName: string
  bio: string
  avatarPreviewUrl: string | null

  goal: LearningGoal | null
  dailyGoalMinutes: number

  selectedSkills: string[]

  setProfile: (data: { displayName: string; bio: string; avatarPreviewUrl?: string | null }) => void
  setGoal: (goal: LearningGoal) => void
  setDailyGoalMinutes: (minutes: number) => void
  toggleSkill: (skill: string) => void
  removeSkill: (skill: string) => void
  reset: () => void
}

const initialState = {
  displayName: '',
  bio: '',
  avatarPreviewUrl: null,
  goal: null as LearningGoal | null,
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
    }),

  setGoal: (goal) => set({ goal }),

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

  reset: () => set(initialState),
}))
