'use client'

import { create } from 'zustand'
import type { LearningGoal, UserProfile } from '@/lib/types'

interface CertificationEntry {
  name: string
  issuingOrg: string
  credentialUrl?: string
}

interface OnboardingState {
  displayName: string
  bio: string
  avatarPreviewUrl: string | null
  avatarFile: File | null

  goal: LearningGoal | null
  goalTitle: string

  // Demographic fields
  dateOfBirth: string
  gradeLevel: string
  gender: string
  learnerType: string

  // Education (TASK-06)
  educationLevel: string
  fieldOfStudy: string
  isCurrent: boolean
  institution: string
  graduationYear: number | null

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
    learnerType?: string
  }) => void
  setGoal: (goal: LearningGoal) => void
  setGoalTitle: (title: string) => void
  setEducation: (data: { educationLevel: string; fieldOfStudy: string; isCurrent: boolean; institution?: string; graduationYear?: number | null }) => void
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
  dateOfBirth: '',
  gradeLevel: '',
  gender: '',
  learnerType: '',
  educationLevel: '',
  fieldOfStudy: '',
  isCurrent: false,
  institution: '',
  graduationYear: null as number | null,
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
      ...(data.learnerType !== undefined ? { learnerType: data.learnerType } : {}),
    }),

  setGoal: (goal) => set({ goal }),

  setGoalTitle: (title) => set({ goalTitle: title }),

  setEducation: (data) =>
    set({
      educationLevel: data.educationLevel,
      fieldOfStudy: data.fieldOfStudy,
      isCurrent: data.isCurrent,
      institution: data.institution || '',
      graduationYear: data.graduationYear ?? null,
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
      dateOfBirth: profile.dateOfBirth ? profile.dateOfBirth.split('T')[0] : '',
      gradeLevel: profile.gradeLevel || '',
      gender: profile.gender || '',
      learnerType: profile.learnerType || '',
    }),

  reset: () => set(initialState),
}))
