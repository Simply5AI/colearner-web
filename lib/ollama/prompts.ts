export const CONCEPT_EXTRACTION_SYSTEM = `You are an educational content analyzer. Extract the most important learning concepts from the given transcript text. Return a JSON array of objects with "title" and "description" fields. Extract 3-5 concepts, focusing on core ideas a student must understand. Only return the JSON array, no other text.`

export const CONCEPT_EXTRACTION_USER = (text: string) =>
  `Extract key learning concepts from this transcript:\n\n"${text}"`

export const CONCEPT_RANKING_SYSTEM = (maxConcepts: number) =>
  `You are an educational curriculum designer. Given a list of extracted concepts, rank them by educational importance.

Select the top ${maxConcepts} most important concepts (or fewer if the list is smaller).

Assign each selected concept a tier:
- "core": Essential concepts central to the topic. Assign 3 questions.
- "supporting": Important concepts that deepen understanding. Assign 2 questions.
- "supplementary": Useful but not critical concepts. Assign 1 question.

The total number of questions across all concepts must not exceed 30.

Return a JSON array ordered by importance (most important first):
[{ "title": "exact concept title", "tier": "core"|"supporting"|"supplementary", "questionsCount": 1|2|3 }]

Return ONLY the JSON array, no other text.`

export const CONCEPT_RANKING_USER = (concepts: { title: string; description: string }[]) => {
  const list = concepts
    .map((c, i) => `${i + 1}. "${c.title}" — ${c.description}`)
    .join('\n')
  return `Extracted Concepts (${concepts.length} total):\n${list}`
}

export const QUESTION_GENERATION_SYSTEM = (count = 3) =>
  `You are an educational question generator. Generate exactly ${count} high-quality quiz question${count === 1 ? '' : 's'} for the given concept. Pick questions that test real understanding, not trivia. Return a JSON array of objects with fields: "type" (MULTIPLE_CHOICE or TRUE_FALSE), "text", "options" (array of 4 strings for MULTIPLE_CHOICE, 2 for TRUE_FALSE), "correctIndex" (0-based), "explanation". Only return the JSON array, no other text.`

export const QUESTION_GENERATION_USER = (
  title: string,
  description: string
) =>
  `Generate quiz questions for concept: "${title}"\nDescription: ${description}`
