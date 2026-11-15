import type {
  TutorFindMaterialState,
  TutorMaterialProposalItem,
  TutorSessionSummaryItem,
  TutorSourceCitation,
} from '@/lib/api/tutor-loop/co'
import type { TutorMode, TutorQuickActionMode } from '@/lib/tutor-loop/open-tutor'

export interface QuickActionDefinition {
  mode: TutorQuickActionMode
  label: string
  description: string
}

export const TUTOR_QUICK_ACTIONS: readonly QuickActionDefinition[] = [
  {
    mode: 'EXPLAIN',
    label: 'Explain a topic',
    description: 'Short explanation grounded in your material',
  },
  {
    mode: 'QUIZ',
    label: 'Quiz me',
    description: 'Check your recall with one question at a time',
  },
  {
    mode: 'HOMEWORK',
    label: 'Work through a problem',
    description: 'Step-by-step hints without giving away the answer',
  },
  {
    mode: 'BRIEF',
    label: 'Prepare a brief',
    description: 'Key points, worked example and 3 self-checks',
  },
  {
    mode: 'CLARIFY',
    label: 'Clarify something',
    description: 'Unpack a confusing passage or mix-up',
  },
  {
    mode: 'TODAY',
    label: 'What should I do today?',
    description: 'Next suggested step from your schedule',
  },
] as const

export const DEFAULT_PINNED_ACTIONS: TutorQuickActionMode[] = [
  'EXPLAIN',
  'QUIZ',
  'BRIEF',
  'CLARIFY',
]

export interface TutorTreeTopicNode {
  topicId: string
  title: string
  subjectId: string
  subjectTitle: string
  planId?: string | null
  planTitle?: string | null
  state?: string | null
  materialIds?: string[]
  sessions: TutorSessionSummaryItem[]
}

export interface TutorTreeGroupNode {
  id: string
  title: string
  kind: 'SUBJECT' | 'PLAN'
  ownership?: 'OWN' | 'ASSIGNED'
  topics: TutorTreeTopicNode[]
}

export interface TutorPlanTopicInput {
  id: string
  title: string
  subjectId?: string | null
  subjectTitle?: string | null
  state?: string | null
  materialIds?: string[]
}

export interface TutorPlanPhaseInput {
  id: string
  title: string
  topics: TutorPlanTopicInput[]
}

export interface TutorPlanInput {
  id: string
  title: string
  ownership?: 'OWN' | 'ASSIGNED'
  phases: TutorPlanPhaseInput[]
}

export interface TutorTopicNoteItem {
  id: string
  kind: string
  title: string
  body: string
  materialId?: string | null
  topicId?: string | null
  createdAt?: string
}

export interface TutorFindMaterialFlowState {
  status: 'IDLE' | 'SEARCHING' | 'READY' | 'LOCKED' | 'UNAVAILABLE' | 'ERROR'
  query: string
  topicId: string
  proposals: TutorMaterialProposalItem[]
  addedByProposalId: Record<
    string,
    {
      materialId: string
      publisher: string
      host: string
      addedByTutor: boolean
    }
  >
  errorMessage?: string | null
}

export interface ActiveCitationSelection extends TutorSourceCitation {
  materialTitle?: string | null
}

export interface TutorLearnerCapabilities {
  band: '14-17' | '18+'
  scope: 'SCHOOL' | 'PERSONAL'
  findMaterial: TutorFindMaterialState
  tutorName: string
  tutorIcon: 'BUDDY' | 'CLOUD' | 'SPARK' | 'SPROUT'
  tutorStyle: 'FRIENDLY' | 'TO_THE_POINT' | 'DETAILED' | 'CHALLENGING'
  readAloud: boolean
}

export function buildTutorTreeGroups(params: {
  groupBy: 'SUBJECT' | 'PLAN'
  plans: TutorPlanInput[]
  sessions: TutorSessionSummaryItem[]
  contextSubjectRef?: string | null
  contextTopicRef?: string | null
  contextTopicTitle?: string | null
  searchQuery?: string
}): TutorTreeGroupNode[] {
  const {
    groupBy,
    plans,
    sessions,
    contextSubjectRef,
    contextTopicRef,
    contextTopicTitle,
    searchQuery = '',
  } = params
  const q = searchQuery.trim().toLowerCase()

  const sessionsByTopic = new Map<string, TutorSessionSummaryItem[]>()
  for (const session of sessions) {
    const key = session.topicRef ?? 'uncategorized-topic'
    const existing = sessionsByTopic.get(key) ?? []
    existing.push(session)
    sessionsByTopic.set(key, existing)
  }

  const placedTopicIds = new Set<string>()
  const groupsMap = new Map<string, TutorTreeGroupNode>()

  for (const plan of plans) {
    for (const phase of plan.phases) {
      for (const topic of phase.topics) {
        placedTopicIds.add(topic.id)
        const subjectId = topic.subjectId ?? phase.id
        const subjectTitle = topic.subjectTitle ?? phase.title
        const groupId = groupBy === 'SUBJECT' ? subjectId : plan.id
        const groupTitle = groupBy === 'SUBJECT' ? subjectTitle : plan.title

        let group = groupsMap.get(groupId)
        if (!group) {
          group = {
            id: groupId,
            title: groupTitle,
            kind: groupBy,
            ownership: plan.ownership,
            topics: [],
          }
          groupsMap.set(groupId, group)
        }

        if (!group.topics.some(t => t.topicId === topic.id)) {
          group.topics.push({
            topicId: topic.id,
            title: topic.title,
            subjectId,
            subjectTitle,
            planId: plan.id,
            planTitle: plan.title,
            state: topic.state ?? 'PRACTICING',
            materialIds: topic.materialIds ?? [],
            sessions: sessionsByTopic.get(topic.id) ?? [],
          })
        }
      }
    }
  }

  // Ensure any sessions whose topics were not in `plans` still appear in the tree
  for (const session of sessions) {
    const topicId = session.topicRef ?? `topic-${session.id}`
    if (placedTopicIds.has(topicId)) continue
    placedTopicIds.add(topicId)

    const subjectId = session.subjectRef ?? 'general-subject'
    const subjectTitle = 'Other topics'
    const groupId = groupBy === 'SUBJECT' ? subjectId : 'default-plan'
    const groupTitle = groupBy === 'SUBJECT' ? subjectTitle : 'My study plan'

    let group = groupsMap.get(groupId)
    if (!group) {
      group = {
        id: groupId,
        title: groupTitle,
        kind: groupBy,
        topics: [],
      }
      groupsMap.set(groupId, group)
    }

    group.topics.push({
      topicId,
      title: session.title || contextTopicTitle || 'Current topic',
      subjectId,
      subjectTitle,
      state: 'PRACTICING',
      sessions: sessionsByTopic.get(session.topicRef ?? 'uncategorized-topic') ?? [session],
    })
  }

  // Also ensure the current context topic appears if no plans/sessions covered it yet
  if (contextTopicRef && !placedTopicIds.has(contextTopicRef)) {
    const subjectId = contextSubjectRef ?? 'general-subject'
    const subjectTitle = 'Current subject'
    const groupId = groupBy === 'SUBJECT' ? subjectId : 'current-plan'
    const groupTitle = groupBy === 'SUBJECT' ? subjectTitle : 'My study plan'
    let group = groupsMap.get(groupId)
    if (!group) {
      group = {
        id: groupId,
        title: groupTitle,
        kind: groupBy,
        topics: [],
      }
      groupsMap.set(groupId, group)
    }
    group.topics.push({
      topicId: contextTopicRef,
      title: contextTopicTitle || 'Current topic',
      subjectId,
      subjectTitle,
      state: 'PRACTICING',
      sessions: sessionsByTopic.get(contextTopicRef) ?? [],
    })
  }

  const allGroups = Array.from(groupsMap.values())
  if (!q) return allGroups

  return allGroups
    .map(group => ({
      ...group,
      topics: group.topics.filter(
        topic =>
          topic.title.toLowerCase().includes(q) ||
          group.title.toLowerCase().includes(q) ||
          topic.sessions.some(sess => sess.title.toLowerCase().includes(q)),
      ),
    }))
    .filter(group => group.topics.length > 0)
}

export function modeDisplayLabel(mode: TutorMode): string {
  switch (mode) {
    case 'EXPLAIN':
      return 'Explain a topic'
    case 'EXPLAIN_DIFFERENTLY':
      return 'Explain differently'
    case 'QUIZ':
      return 'Quiz me'
    case 'HOMEWORK':
      return 'Work through a problem'
    case 'TEACH_BACK':
      return 'Teach it back'
    case 'BRIEF':
      return 'Prepare a brief'
    case 'CLARIFY':
      return 'Clarify something'
    case 'TODAY':
      return 'What should I do today?'
    case 'ASK':
    default:
      return 'Ask Co'
  }
}

export type TutorArtState = 'idle' | 'speaking' | 'resting' | 'celebrating' | 'thinking' | 'concerned' | 'asking'

/** The learner's chosen tutor artwork (public/tutor-loop). */
export function coArtSrc(
  icon: 'BUDDY' | 'CLOUD' | 'SPARK' | 'SPROUT',
  state: TutorArtState = 'idle',
): string {
  return `/tutor-loop/${icon.toLowerCase()}-${state}.svg`
}

/** Maps a server-offered action to an internal learner route. Never uses a URL from the server. */
export function tutorActionHref(action: {
  kind: string
  targetId: string | null
}): string {
  const id = action.targetId ? encodeURIComponent(action.targetId) : null
  switch (action.kind) {
    case 'LESSON':
      return id ? `/learn/lesson/${id}` : '/learn/practice'
    case 'MATERIAL':
      return id ? `/learn/library/${id}` : '/learn/library'
    case 'TEACH_BACK':
      return '/learn/teach'
    case 'PRACTICE':
    case 'REVIEW':
    case 'START_PRACTICE':
    case 'MOCK':
      return '/learn/practice'
    case 'DONE_FOR_TODAY':
    default:
      return '/learn/today'
  }
}

export const TUTOR_STYLE_LABEL: Record<string, string> = {
  FRIENDLY: 'Friendly style',
  TO_THE_POINT: 'To-the-point style',
  DETAILED: 'Detailed style',
  CHALLENGING: 'Challenging style',
}

export function newClientRequestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return `req-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

/** Plain-text body of a reply, used by Save to Notes and read aloud. */
export function replyPlainText(result: {
  segments: Array<{ text: string }>
  question?: { prompt?: string | null } | null
  brief?: {
    title: string
    sections: Array<{ heading: string; points: string[] }>
    workedExample: string
    selfChecks: string[]
  } | null
}): string {
  const parts = result.segments.map(segment => segment.text.trim()).filter(Boolean)
  if (result.brief) {
    parts.push(result.brief.title)
    for (const section of result.brief.sections) {
      parts.push(section.heading, ...section.points)
    }
    if (result.brief.workedExample) parts.push(`Worked example: ${result.brief.workedExample}`)
    if (result.brief.selfChecks.length) parts.push(`Check yourself: ${result.brief.selfChecks.join(' ')}`)
  }
  if (result.question?.prompt) parts.push(result.question.prompt)
  return parts.join('\n\n')
}
