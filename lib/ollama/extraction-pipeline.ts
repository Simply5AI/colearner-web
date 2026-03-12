import { OllamaClient } from './ollama-client'
import {
  CONCEPT_EXTRACTION_SYSTEM,
  CONCEPT_EXTRACTION_USER,
  CONCEPT_RANKING_SYSTEM,
  CONCEPT_RANKING_USER,
  QUESTION_GENERATION_SYSTEM,
  QUESTION_GENERATION_USER,
} from './prompts'

interface ConceptResult {
  title: string
  description: string
}

interface RankedConcept {
  title: string
  tier: 'core' | 'supporting' | 'supplementary'
  questionsCount: number
}

interface QuestionResult {
  type: 'MULTIPLE_CHOICE' | 'TRUE_FALSE'
  text: string
  options: string[]
  correctIndex: number
  explanation: string
}

interface PipelineConfig {
  transcript: string
  pass1Model: string
  pass2Model: string
  ollamaBaseUrl: string
  /** Max concurrent Ollama requests (default 3) */
  concurrency?: number
  signal?: AbortSignal
}

interface PipelineProgress {
  phase: 'chunking' | 'pass1' | 'ranking' | 'pass2' | 'saving'
  current: number
  total: number
  detail?: string
}

interface PipelineResult {
  concepts: ConceptResult[]
  questions: { conceptIndex: number; questions: QuestionResult[] }[]
}

export function chunkTranscript(
  text: string,
  chunkSize = 750,
  overlap = 100
): string[] {
  const words = text.split(/\s+/)
  if (words.length <= chunkSize) return [text]

  const chunks: string[] = []
  let start = 0

  while (start < words.length) {
    const end = Math.min(start + chunkSize, words.length)
    chunks.push(words.slice(start, end).join(' '))
    start = end - overlap
    if (start + overlap >= words.length) break
  }

  return chunks
}

function parseJsonArray<T>(text: string): T[] {
  const match = text.match(/\[[\s\S]*\]/)
  if (!match) return []
  try {
    return JSON.parse(match[0]) as T[]
  } catch {
    return []
  }
}

/** Sanitize LLM-generated questions: clamp correctIndex, fix options, drop invalid */
function sanitizeQuestions(raw: QuestionResult[]): QuestionResult[] {
  return raw
    .filter(
      (q) =>
        q.text &&
        Array.isArray(q.options) &&
        q.options.length >= 2 &&
        typeof q.correctIndex === 'number'
    )
    .map((q) => {
      // Ensure options are strings and cap at 6
      const options = q.options
        .map((o) => (typeof o === 'string' ? o : String(o)))
        .slice(0, 6)

      // Clamp correctIndex to valid range [0, options.length - 1]
      const correctIndex = Math.max(
        0,
        Math.min(Math.floor(q.correctIndex), options.length - 1)
      )

      // Normalize type
      const type =
        q.type === 'TRUE_FALSE' ? 'TRUE_FALSE' : 'MULTIPLE_CHOICE'

      return { ...q, type, options, correctIndex }
    })
}

/** Run async tasks with a concurrency limit (worker-pool pattern) */
async function mapConcurrent<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let nextIndex = 0

  async function worker() {
    while (nextIndex < items.length) {
      const i = nextIndex++
      results[i] = await fn(items[i]!, i)
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    () => worker()
  )
  await Promise.all(workers)
  return results
}

/** Fallback ranking when the ranking model fails */
function fallbackRanking(
  concepts: ConceptResult[],
  maxConcepts: number
): RankedConcept[] {
  const selected = concepts.slice(0, Math.min(maxConcepts, 10))
  let budget = 30
  return selected
    .map((c) => {
      const count = Math.min(3, budget)
      budget -= count
      return {
        title: c.title,
        tier: 'core' as const,
        questionsCount: count,
      }
    })
    .filter((c) => c.questionsCount > 0)
}

export async function runPipeline(
  config: PipelineConfig,
  onProgress: (progress: PipelineProgress) => void
): Promise<PipelineResult> {
  const client = new OllamaClient(config.ollamaBaseUrl)

  // Phase 1: Chunk transcript
  onProgress({ phase: 'chunking', current: 0, total: 1 })
  const chunks = chunkTranscript(config.transcript)
  onProgress({ phase: 'chunking', current: 1, total: 1 })

  const transcriptWordCount = config.transcript.split(/\s+/).length

  // Phase 2: Extract concepts from each chunk (parallel, pass1Model = cheap)
  const concurrency = config.concurrency ?? 3
  let pass1Done = 0

  const chunkConcepts = await mapConcurrent(
    chunks,
    concurrency,
    async (chunk, i) => {
      onProgress({
        phase: 'pass1',
        current: pass1Done,
        total: chunks.length,
        detail: `Processing chunk ${i + 1}/${chunks.length}`,
      })

      const response = await client.chat({
        model: config.pass1Model,
        messages: [
          { role: 'system', content: CONCEPT_EXTRACTION_SYSTEM },
          { role: 'user', content: CONCEPT_EXTRACTION_USER(chunk) },
        ],
        maxTokens: 2000,
        temperature: 0.3,
        signal: config.signal,
      })

      pass1Done++
      onProgress({
        phase: 'pass1',
        current: pass1Done,
        total: chunks.length,
        detail: `Completed chunk ${i + 1}/${chunks.length}`,
      })

      return parseJsonArray<ConceptResult>(response.content)
    }
  )

  const allConcepts = chunkConcepts.flat()

  onProgress({
    phase: 'pass1',
    current: chunks.length,
    total: chunks.length,
    detail: `Extracted ${allConcepts.length} concepts`,
  })

  // Deduplicate concepts by title (case-insensitive)
  const seen = new Set<string>()
  const uniqueConcepts = allConcepts.filter((c) => {
    const key = c.title.toLowerCase().trim()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  // Phase 2.5: Rank concepts using the smarter model (pass2Model)
  onProgress({
    phase: 'ranking',
    current: 0,
    total: 1,
    detail: `Ranking ${uniqueConcepts.length} concepts by importance`,
  })

  let maxConcepts: number
  if (transcriptWordCount < 3000) {
    maxConcepts = 8
  } else if (transcriptWordCount < 8000) {
    maxConcepts = 12
  } else {
    maxConcepts = 15
  }

  let rankedConcepts: RankedConcept[]
  try {
    const rankResponse = await client.chat({
      model: config.pass2Model,
      messages: [
        { role: 'system', content: CONCEPT_RANKING_SYSTEM(maxConcepts) },
        { role: 'user', content: CONCEPT_RANKING_USER(uniqueConcepts) },
      ],
      maxTokens: 2000,
      temperature: 0.2,
      signal: config.signal,
    })

    const parsed = parseJsonArray<RankedConcept>(rankResponse.content)
    const validTitles = new Set(
      uniqueConcepts.map((c) => c.title.toLowerCase().trim())
    )
    const validated = parsed.filter(
      (r) =>
        validTitles.has(r.title.toLowerCase().trim()) &&
        ['core', 'supporting', 'supplementary'].includes(r.tier) &&
        r.questionsCount >= 1 &&
        r.questionsCount <= 3
    )

    // Enforce 30 question budget
    let budget = 30
    const budgeted: RankedConcept[] = []
    for (const item of validated) {
      if (budget <= 0) break
      const count = Math.min(item.questionsCount, budget)
      budgeted.push({ ...item, questionsCount: count })
      budget -= count
    }

    rankedConcepts =
      budgeted.length > 0
        ? budgeted
        : fallbackRanking(uniqueConcepts, maxConcepts)
  } catch {
    rankedConcepts = fallbackRanking(uniqueConcepts, maxConcepts)
  }

  onProgress({
    phase: 'ranking',
    current: 1,
    total: 1,
    detail: `Selected ${rankedConcepts.length} concepts from ${uniqueConcepts.length}`,
  })

  // Build ranked concept map for question counts
  const rankMap = new Map<string, RankedConcept>()
  for (const rc of rankedConcepts) {
    rankMap.set(rc.title.toLowerCase().trim(), rc)
  }

  // Filter to only ranked concepts
  const finalConcepts = uniqueConcepts.filter((c) =>
    rankMap.has(c.title.toLowerCase().trim())
  )

  // Phase 3: Generate questions per concept (parallel, pass1Model = cheap)
  let pass2Done = 0

  const questionsPerConcept = await mapConcurrent(
    finalConcepts,
    concurrency,
    async (concept, i) => {
      const ranked = rankMap.get(concept.title.toLowerCase().trim())
      const count = ranked?.questionsCount ?? 3

      onProgress({
        phase: 'pass2',
        current: pass2Done,
        total: finalConcepts.length,
        detail: `Generating ${count} question${count === 1 ? '' : 's'} for "${concept.title}"`,
      })

      const response = await client.chat({
        model: config.pass1Model,
        messages: [
          { role: 'system', content: QUESTION_GENERATION_SYSTEM(count) },
          {
            role: 'user',
            content: QUESTION_GENERATION_USER(
              concept.title,
              concept.description
            ),
          },
        ],
        maxTokens: 3000,
        temperature: 0.5,
        signal: config.signal,
      })

      const rawQuestions = parseJsonArray<QuestionResult>(response.content)
      const questions = sanitizeQuestions(rawQuestions)
      pass2Done++
      onProgress({
        phase: 'pass2',
        current: pass2Done,
        total: finalConcepts.length,
        detail: `Completed questions for "${concept.title}"`,
      })

      return { conceptIndex: i, questions }
    }
  )

  onProgress({
    phase: 'pass2',
    current: finalConcepts.length,
    total: finalConcepts.length,
    detail: 'Question generation complete',
  })

  return { concepts: finalConcepts, questions: questionsPerConcept }
}
