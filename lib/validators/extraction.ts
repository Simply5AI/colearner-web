import { z } from 'zod/v4'

export const extractionSchema = z.object({
  videoUrl: z.url('Please enter a valid URL'),
})

export type ExtractionInput = z.infer<typeof extractionSchema>
