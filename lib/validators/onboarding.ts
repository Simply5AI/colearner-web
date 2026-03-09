import { z } from 'zod/v4'

export const profileStepSchema = z.object({
  displayName: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(50, 'Name must be 50 characters or less'),
  bio: z.string().max(160, 'Bio must be 160 characters or less').optional(),
})

export const goalStepSchema = z.object({
  goal: z.enum(['build_knowledge', 'retain_more', 'exam_prep', 'career_growth'], {
    error: 'Please select a learning goal',
  }),
  dailyGoalMinutes: z.number().int().min(5).max(60),
})

export const skillsStepSchema = z.object({
  skills: z.array(z.string()).min(3, 'Please select at least 3 topics'),
})

export type ProfileStepInput = z.infer<typeof profileStepSchema>
export type GoalStepInput = z.infer<typeof goalStepSchema>
export type SkillsStepInput = z.infer<typeof skillsStepSchema>
