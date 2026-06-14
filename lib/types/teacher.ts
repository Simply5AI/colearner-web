/**
 * Teacher-role domain types (TASK-12).
 * Mirrors planned B2–B4 API contracts from colearner-platform.
 */

export type TeacherQuestionType =
  | 'MCQ'
  | 'MULTI_SELECT'
  | 'TRUE_FALSE'
  | 'SHORT_ANSWER'
  | 'LONG_ANSWER'
  | 'FILL_BLANK'
  | 'CODE'

export type TeacherQuestionStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'

export interface TeacherQuestionOption {
  id: string
  label: string
}

export interface McqCorrectAnswer {
  optionId: string
}

export interface MultiSelectCorrectAnswer {
  optionIds: string[]
}

export interface TrueFalseCorrectAnswer {
  value: boolean
}

export interface TextCorrectAnswer {
  accepted: string[]
  caseSensitive: boolean
}

export interface LongAnswerCorrectAnswer {
  rubric: string
  keyPoints: string[]
}

export interface CodeTestCase {
  input: string
  expected: string
}

export interface CodeCorrectAnswer {
  language: string
  testCases: CodeTestCase[]
}

export type TeacherCorrectAnswer =
  | McqCorrectAnswer
  | MultiSelectCorrectAnswer
  | TrueFalseCorrectAnswer
  | TextCorrectAnswer
  | LongAnswerCorrectAnswer
  | CodeCorrectAnswer

export interface TeacherQuestion {
  id: string
  planId: string
  topicId: string
  type: TeacherQuestionType
  status: TeacherQuestionStatus
  prompt: string
  options?: TeacherQuestionOption[]
  correctAnswer: TeacherCorrectAnswer
  explanation: string
  referenceMaterialIds?: string[]
  aiGenerated?: boolean
}

export type TeacherAnswerValue =
  | { type: 'MCQ'; optionId: string }
  | { type: 'MULTI_SELECT'; optionIds: string[] }
  | { type: 'TRUE_FALSE'; value: boolean }
  | { type: 'SHORT_ANSWER'; text: string }
  | { type: 'LONG_ANSWER'; text: string }
  | { type: 'FILL_BLANK'; text: string }
  | { type: 'CODE'; code: string }

export type MaterialType =
  | 'PDF'
  | 'VIDEO_UPLOAD'
  | 'VIDEO_LINK'
  | 'EXTERNAL_LINK'
  | 'RICH_TEXT'
  | 'EXTENSION_CAPTURE'

export type MaterialVisibility = 'PREVIEW' | 'SUBSCRIBER'

export interface TeacherMaterial {
  id: string
  planId: string
  topicId?: string
  title: string
  type: MaterialType
  visibility: MaterialVisibility
  downloadable: boolean
  sortOrder?: number
  url?: string
  contentUrl?: string
  richTextContent?: Record<string, unknown>
  externalUrl?: string
  externalTitle?: string
  externalDescription?: string
  externalImageUrl?: string
  extensionContent?: string
  mimeType?: string
  sizeBytes?: number
}

export type PlanStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'

export interface TeacherStudyPlanSummary {
  id: string
  title: string
  description: string
  status: PlanStatus
  enrollmentCount: number
  topicCount: number
  questionCount: number
  subjectTags: string[]
  updatedAt: string
  publishedAt: string | null
}

export interface TeacherStudyPlan extends TeacherStudyPlanSummary {
  tree: TreeNode[]
}

export type TreeNodeKind = 'module' | 'topic' | 'subtopic'

export interface TreeNode {
  id: string
  kind: TreeNodeKind
  title: string
  description?: string
  prerequisiteTopicIds?: string[]
  children?: TreeNode[]
}

export type MasteryLevel = 'new' | 'learning' | 'review' | 'mastered' | 'excel'

export interface UploadProgress {
  fileName: string
  progress: number
  status: 'pending' | 'uploading' | 'completed' | 'failed'
  error?: string
}

export interface CompletedUpload {
  fileName: string
  storageKey?: string
  mimeType?: string
  type?: MaterialType
  sizeBytes?: number
  material?: Pick<TeacherMaterial, 'id' | 'title' | 'type' | 'url' | 'contentUrl'>
}

export interface TeacherEnrollment {
  id: string
  planId: string
  studentUserId: string
  studentName: string
  studentEmail: string
  source: 'invite' | 'org'
  enrolledAt: string
  status: 'active' | 'revoked' | 'completed'
  progressPercent: number
  lastExamScore: number | null
  lastRecallAt: string | null
}

export interface OrgStudentOption {
  userId: string
  name: string
  email: string
}

export interface AssignStudentsResult {
  results: Array<{
    studentUserId: string
    status: 'assigned' | 'skipped'
    enrollmentId?: string
    reason?: string
  }>
}

export interface TeacherStudentRosterEntry {
  studentUserId: string
  studentName: string
  studentEmail: string
  totalPlans: number
  enrolledPlans: Array<{ planId: string; planTitle: string; enrolledAt: string }>
}

export interface TeacherInviteCode {
  id: string
  planId: string
  code: string
  maxUses: number
  usedCount: number
  expiresAt: string | null
  createdAt: string
  createdBy: string
  revokedAt: string | null
}

export interface TopicAnalyticsEntry {
  topicId: string
  title: string
  avgMastery: number
  avgFirstAttemptCorrectPct: number
}

export interface PlanAggregateAnalytics {
  planId: string
  enrollmentCount: number
  activeCount: number
  completedCount: number
  avgProgress: number
  avgExamScore: number
  hardestTopic: string
  strongestTopic: string
  hardestTopics: TopicAnalyticsEntry[]
  strongestTopics: TopicAnalyticsEntry[]
  scoreDistribution: { range: string; count: number }[]
  engagementTrend: { date: string; sessions: number; dailyActiveStudents: number }[]
}

export interface StudentTopicProgress {
  topicId: string
  title: string
  mastery: MasteryLevel
  attempts: number
  correctPct: number
  lastReviewed: string | null
}

export interface StudentPlanAnalytics {
  profile: {
    userId: string
    name: string
    email: string
    enrolledAt: string
    progressPercent: number
    masteryLevel: MasteryLevel
  }
  topicProgress: StudentTopicProgress[]
  recallHistory: Array<{
    sessionId: string
    completedAt: string | null
    accuracy: number
    totalQuestions: number
    correctCount: number
  }>
  examHistory: Array<{
    sessionId: string
    completedAt: string | null
    score: number
    totalQuestions: number
    correctCount: number
  }>
}

export interface PlanRosterEntry {
  studentUserId: string
  studentName: string
  studentEmail: string
  progressPercent: number
  masteryLevel: MasteryLevel
  lastActiveAt: string | null
  lastExamScore: number | null
}