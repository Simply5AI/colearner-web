import type { PlanTopicState, TutorPlan, TutorPlanTopic } from '@/lib/api/tutor-loop/client'

export const stateLabel: Record<PlanTopicState, string> = {
  NOT_STARTED: 'Not started', LEARNING: 'Learning', PRACTICING: 'Practising', SECURE: 'Secure', MASTERED: 'Mastered', NEEDS_REVIEW: 'Needs practice',
}
const stateOrder: PlanTopicState[] = ['NEEDS_REVIEW', 'LEARNING', 'PRACTICING', 'NOT_STARTED', 'SECURE', 'MASTERED']

export interface PlanGroup { key: string; title: string; note: string; topics: { topic: TutorPlanTopic; planId: string }[] }

const count = (n: number) => `${n} ${n === 1 ? 'topic' : 'topics'}`

/** Groups topics by phase/subject or by status; filters on the "Find a topic" text. Archived topics are hidden. */
export function groupPlanTopics(plans: TutorPlan[], mode: 'SUBJECT' | 'STATUS', query: string): PlanGroup[] {
  const q = query.trim().toLowerCase()
  const rows: { topic: TutorPlanTopic; planId: string; phase: string }[] = []
  for (const plan of plans) for (const phase of plan.phases) for (const topic of phase.topics) {
    if (topic.archived) continue
    if (q && !topic.title.toLowerCase().includes(q)) continue
    rows.push({ topic, planId: plan.id, phase: topic.subjectTitle || phase.title })
  }
  const map = new Map<string, PlanGroup>()
  for (const r of rows) {
    const key = mode === 'STATUS' ? r.topic.state : r.phase
    const title = mode === 'STATUS' ? stateLabel[r.topic.state] : r.phase
    const g = map.get(key) ?? { key, title, note: '', topics: [] }
    g.topics.push({ topic: r.topic, planId: r.planId })
    map.set(key, g)
  }
  const groups = [...map.values()]
  if (mode === 'STATUS') groups.sort((a, b) => stateOrder.indexOf(a.key as PlanTopicState) - stateOrder.indexOf(b.key as PlanTopicState))
  for (const g of groups) g.note = count(g.topics.length)
  return groups
}

export function topicMeta(topic: TutorPlanTopic): string {
  const parts = [`${topic.estimateMin} min`]
  if (topic.materialIds.length > 0) parts.push(`${topic.materialIds.length} ${topic.materialIds.length === 1 ? 'material' : 'materials'}`)
  return parts.join(' · ')
}
