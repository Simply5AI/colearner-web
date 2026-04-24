import { z } from 'zod/v4'

export const profileStepSchema = z.object({
  displayName: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(50, 'Name must be 50 characters or less'),
  bio: z.string().max(160, 'Bio must be 160 characters or less').optional(),
  dateOfBirth: z.string().optional(),
  gradeLevel: z.enum([
    'CLASS_1', 'CLASS_2', 'CLASS_3', 'CLASS_4', 'CLASS_5', 'CLASS_6',
    'CLASS_7', 'CLASS_8', 'CLASS_9', 'CLASS_10', 'CLASS_11', 'CLASS_12',
    'UNDERGRADUATE', 'POSTGRADUATE', 'NOT_APPLICABLE',
  ]).optional(),
  gender: z.enum(['MALE', 'FEMALE', 'NON_BINARY', 'PREFER_NOT_TO_SAY', 'OTHER']).optional(),
  learnerType: z.enum(['STUDENT', 'PROFESSIONAL']).optional(),
})

export const goalStepSchema = z.object({
  goal: z.enum(['build_knowledge', 'retain_more', 'exam_prep', 'career_growth'], {
    error: 'Please select a learning goal',
  }),
})

export const educationStepSchema = z.object({
  educationLevel: z.enum(
    ['HIGH_SCHOOL', 'DIPLOMA', 'BACHELORS', 'MASTERS', 'PHD', 'SELF_TAUGHT', 'OTHER'],
    { error: 'Please select your education level' },
  ),
  fieldOfStudy: z.string().min(2, 'Field of study is required').max(100),
  isCurrent: z.boolean().optional().default(false),
  institution: z.string().max(200).optional(),
  graduationYear: z.number().int().min(1950).max(2040).nullable().optional(),
})

export const certificationsStepSchema = z.object({
  certifications: z.array(
    z.object({
      name: z.string().min(1, 'Certification name is required').max(200),
      issuingOrg: z.string().max(200).optional().default(''),
      credentialUrl: z.string().max(500).optional().default(''),
    }),
  ),
})

export type ProfileStepInput = z.infer<typeof profileStepSchema>
export type GoalStepInput = z.infer<typeof goalStepSchema>
export type EducationStepInput = z.infer<typeof educationStepSchema>
export type CertificationsStepInput = z.infer<typeof certificationsStepSchema>
