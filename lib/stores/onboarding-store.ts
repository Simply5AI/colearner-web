'use client'

import { create } from 'zustand'
import type { LearningGoal, UserProfile } from '@/lib/types'

interface CertificationEntry {
  name: string
  issuingOrg: string
}

interface OnboardingState {
  displayName: string
  bio: string
  avatarPreviewUrl: string | null
  avatarFile: File | null

  goal: LearningGoal | null
  goalTitle: string
  dailyGoalMinutes: number

  selectedSkills: string[]

  // Demographic fields
  dateOfBirth: string
  gradeLevel: string
  gender: string

  // Education (TASK-06)
  educationLevel: string
  fieldOfStudy: string
  isCurrent: boolean
  institution: string

  // Certifications (TASK-06)
  certifications: CertificationEntry[]

  setProfile: (data: {
    displayName: string
    bio: string
    avatarPreviewUrl?: string | null
    avatarFile?: File | null
    dateOfBirth?: string
    gradeLevel?: string
    gender?: string
  }) => void
  setGoal: (goal: LearningGoal) => void
  setGoalTitle: (title: string) => void
  setDailyGoalMinutes: (minutes: number) => void
  toggleSkill: (skill: string) => void
  removeSkill: (skill: string) => void
  setEducation: (data: { educationLevel: string; fieldOfStudy: string; isCurrent: boolean; institution?: string }) => void
  addCertification: (cert: CertificationEntry) => void
  removeCertification: (index: number) => void
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
  dateOfBirth: '',
  gradeLevel: '',
  gender: '',
  educationLevel: '',
  fieldOfStudy: '',
  isCurrent: false,
  institution: '',
  certifications: [] as CertificationEntry[],
}

export const useOnboardingStore = create<OnboardingState>((set) => ({
  ...initialState,

  setProfile: (data) =>
    set({
      displayName: data.displayName,
      bio: data.bio,
      avatarPreviewUrl: data.avatarPreviewUrl ?? null,
      ...(data.avatarFile !== undefined ? { avatarFile: data.avatarFile } : {}),
      ...(data.dateOfBirth !== undefined ? { dateOfBirth: data.dateOfBirth } : {}),
      ...(data.gradeLevel !== undefined ? { gradeLevel: data.gradeLevel } : {}),
      ...(data.gender !== undefined ? { gender: data.gender } : {}),
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

  setEducation: (data) =>
    set({
      educationLevel: data.educationLevel,
      fieldOfStudy: data.fieldOfStudy,
      isCurrent: data.isCurrent,
      institution: data.institution || '',
    }),

  addCertification: (cert) =>
    set((state) => ({
      certifications: [...state.certifications, cert],
    })),

  removeCertification: (index) =>
    set((state) => ({
      certifications: state.certifications.filter((_, i) => i !== index),
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
      dateOfBirth: profile.dateOfBirth ? profile.dateOfBirth.split('T')[0] : '',
      gradeLevel: profile.gradeLevel || '',
      gender: profile.gender || '',
    }),

  reset: () => set(initialState),
}))
