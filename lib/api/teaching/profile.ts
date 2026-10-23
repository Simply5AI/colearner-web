import { z } from 'zod/v4'

/** B12 section 6.8: profile fields, shared by onboarding and `/profile`. */
export const teacherProfileSchema = z.object({
  displayName: z.string(),
  bio: z.string().nullable(),
  subjects: z.array(z.string()),
  grades: z.array(z.number()),
  photoStorageKey: z.string().nullable(),
})
export type TeacherProfile = z.infer<typeof teacherProfileSchema>

export const PROFILE_LIMITS = { name: 80, bio: 500, subjects: 12, subject: 60 } as const

export interface ProfileDraft {
  displayName: string
  bio: string
  subjects: string[]
  grades: number[]
}

export type ProfileErrors = Partial<Record<'displayName' | 'bio' | 'subjects' | 'grades', string>>

export function validateProfile(draft: ProfileDraft): ProfileErrors {
  const errors: ProfileErrors = {}
  const name = draft.displayName.trim()
  if (name.length < 1) errors.displayName = 'Enter the name students will see.'
  else if (name.length > PROFILE_LIMITS.name) errors.displayName = `Use ${PROFILE_LIMITS.name} characters or fewer.`
  if (draft.bio.trim().length > PROFILE_LIMITS.bio) errors.bio = `Use ${PROFILE_LIMITS.bio} characters or fewer.`
  if (draft.subjects.length < 1) errors.subjects = 'Add at least one subject you teach.'
  else if (draft.subjects.length > PROFILE_LIMITS.subjects) errors.subjects = `Add at most ${PROFILE_LIMITS.subjects} subjects.`
  else if (draft.subjects.some((subject) => subject.length < 1 || subject.length > PROFILE_LIMITS.subject))
    errors.subjects = `Each subject needs 1 to ${PROFILE_LIMITS.subject} characters.`
  if (draft.grades.length < 1) errors.grades = 'Choose at least one grade.'
  else if (draft.grades.some((grade) => !Number.isInteger(grade) || grade < 1 || grade > 10))
    errors.grades = 'Grades run from 1 to 10.'
  return errors
}

export function profileToDraft(profile: TeacherProfile): ProfileDraft {
  return {
    displayName: profile.displayName,
    bio: profile.bio ?? '',
    subjects: profile.subjects,
    grades: [...profile.grades].sort((a, b) => a - b),
  }
}

export function draftToPayload(draft: ProfileDraft) {
  const bio = draft.bio.trim()
  return {
    displayName: draft.displayName.trim(),
    bio: bio.length ? bio : null,
    subjects: [...new Set(draft.subjects.map((subject) => subject.trim()).filter(Boolean))],
    grades: [...new Set(draft.grades)].sort((a, b) => a - b),
  }
}

export const teacherProfileResponseSchema = teacherProfileSchema.extend({ revision: z.number().optional() })
