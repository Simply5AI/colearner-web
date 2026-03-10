export const CONCEPT_EXTRACTION_SYSTEM = `You are an educational content analyzer. Extract key learning concepts from the given transcript text. Return a JSON array of objects with "title" and "description" fields. Extract 3-7 concepts. Only return the JSON array, no other text.`

export const CONCEPT_EXTRACTION_USER = (text: string) =>
  `Extract key learning concepts from this transcript:\n\n"${text}"`

export const QUESTION_GENERATION_SYSTEM = `You are an educational question generator. Generate quiz questions for the given concept. Return a JSON array of objects with fields: "type" (MULTIPLE_CHOICE or TRUE_FALSE), "text", "options" (array of 4 strings for MULTIPLE_CHOICE, 2 for TRUE_FALSE), "correctIndex" (0-based), "explanation". Generate 2-4 questions per concept. Only return the JSON array, no other text.`

export const QUESTION_GENERATION_USER = (
  title: string,
  description: string
) =>
  `Generate quiz questions for concept: "${title}"\nDescription: ${description}`
