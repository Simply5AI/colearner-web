/**
 * Placeholder types until @colearner/types package is published.
 * These mirror the API contracts from colearner-platform.
 */

export interface User {
  id: string
  email: string
  name: string
  image?: string
  tier: 'free' | 'pro' | 'enterprise'
  ncuBalance: number
  currentStreak: number
  createdAt: string
}

export interface Concept {
  id: string
  title: string
  topicId: string
  topicName: string
}

export interface ConceptWithSM2State extends Concept {
  masteryState: MasteryState
  easeFactor: number
  interval: number
  repetitions: number
  nextReviewDate: string
  lastReviewDate: string | null
}

export type MasteryState = 'new' | 'learning' | 'review' | 'mastered' | 'excel'

export interface DueItem {
  id: string
  title: string
  dueDate: string
  masteryState: MasteryState
  topicName: string
}

export interface Question {
  id: string
  text: string
  type: 'mcq' | 'open' | 'cloze'
  options?: string[]
  clozeTemplate?: string
  conceptId: string
}

export interface AnswerFeedback {
  score: number
  feedback: string
  correctAnswer?: string
}

export interface SessionSummary {
  sessionId: string
  totalQuestions: number
  correctCount: number
  averageScore: number
  ncuEarned: number
  conceptResults: ConceptResult[]
  completedAt: string
}

export interface ConceptResult {
  conceptId: string
  conceptTitle: string
  score: number
  previousState: MasteryState
  newState: MasteryState
}

export interface ExtractionJob {
  id: string
  videoUrl: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  conceptCount?: number
  questionCount?: number
  createdAt: string
}

export interface Toast {
  id: string
  title: string
  description?: string
  variant: 'default' | 'success' | 'destructive'
}

export interface StreakData {
  currentStreak: number
  longestStreak: number
  lastActivityDate: string
}

export interface BillingStatus {
  tier: 'free' | 'pro' | 'enterprise'
  subscriptionId?: string
  nextBillingDate?: string
  cancelledAt?: string
}

export type LearningGoal = 'build_knowledge' | 'retain_more' | 'exam_prep' | 'career_growth'

export interface UserProfile {
  userId: string
  email: string
  name: string
  profileImageUrl?: string
  bio?: string
  goals?: LearningGoal[]
  dailyGoalMinutes?: number
  skillsInterests?: string[]
  preferredLanguage?: string
  onboardingCompletedAt?: string
  createdAt: string
  updatedAt: string
  // AI Processing preferences
  processingMode?: 'cloud' | 'local'
  ollamaBaseUrl?: string
  ollamaPass1Model?: string | null
  ollamaPass2Model?: string | null
}

// ─── Dashboard Types ───

export interface DashboardStats {
  totalRecalls: number
  passRate: number
  activeConcepts: number
  streak: number
  bestStreak: number
}

export interface RecallQueueItem {
  id: string
  conceptTitle: string
  type: 'open' | 'mcq' | 'cloze'
  source: 'sm2_due' | 'failed'
  lastScore: number | null
  easeFactor: number
  interval: number
  dueDate: string
  dueCount: number
}

export interface ActivityItem {
  id: string
  type: 'recall_pass' | 'recall_fail' | 'capture' | 'state_change' | 'milestone'
  message: string
  detail?: string
  createdAt: string
}

export interface SourceProgress {
  currentSource: number
  sourceName: string
  totalAttempts: number
  requiredAttempts: number
  passRate: number
  requiredPassRate: number
  masteredConcepts: number
  milestones: SourceMilestone[]
  engagementState: 'explore' | 'learn' | 'grow' | 'excel'
  availableStates: string[]
}

export interface SourceMilestone {
  label: string
  completed: boolean
}

export interface StreakCalendar {
  days: StreakDay[]
  currentStreak: number
  bestStreak: number
}

export interface StreakDay {
  date: string
  dayLabel: string
  status: 'active' | 'missed' | 'today' | 'future'
}

// ─── Recall Session Types ───

export type QuestionType = 'MULTIPLE_CHOICE' | 'FREE_TEXT' | 'TRUE_FALSE' | 'CLOZE'

export interface QuestionWithMeta {
  id: string
  text: string
  type: QuestionType
  options?: string[]
  clozeTemplate?: string
  clozeBlankCount?: number
  hint?: string
  conceptTitle: string
  sortOrder: number
  answered: boolean
  skipped: boolean
}

export interface SM2Delta {
  efBefore: number
  efAfter: number
  intervalBefore: number
  intervalAfter: number
  repsBefore: number
  repsAfter: number
}

export interface AnswerResult {
  attemptId: string
  isCorrect: boolean
  score: number
  feedback: string
  correctAnswer?: string
  sm2Delta: SM2Delta
  correctCount: number
  totalAttempts: number
  accuracy: number
}

export interface SessionSummaryDetailed {
  sessionId: string
  status: string
  totalQuestions: number
  answeredCount: number
  passedCount: number
  passRate: number
  avgScore: number
  totalTimeSeconds: number
  streakCurrent: number
  results: SessionQuestionResult[]
  completedAt: string | null
}

export interface SessionQuestionResult {
  questionId: string
  conceptTitle: string
  questionType: QuestionType
  questionText: string
  sortOrder: number
  skipped: boolean
  answered: boolean
  isCorrect: boolean
  score: number
  feedback: string | null
  userAnswer: string | null
  timeSpentSeconds: number
  currentInterval: number
  currentEF: number
  nextReviewDate: string | null
}

export interface QueueStats {
  totalAvailable: number
  dueCount: number
  newCount: number
  failedCount: number
  passRate: number
  typeBreakdown: Array<{ type: QuestionType; count: number }>
}

export type SessionQuestionTypeFilter = 'ALL' | QuestionType

export type SessionOrder = 'sm2' | 'failed_first' | 'random' | 'newest'

export interface RecallSessionConfig {
  extractionId?: string
  questionCount?: number
  questionType?: SessionQuestionTypeFilter
  order?: SessionOrder
  timerSeconds?: number
}

export interface RecallSessionResponse {
  id: string
  orgId: string
  userId: string
  extractionId: string | null
  status: string
  totalQuestions: number
  startedAt: string
  createdAt: string
}

// ─── Extraction Types ───

export type ExtractionSourceType = 'YOUTUBE' | 'WEB' | 'DOCUMENT' | 'AUDIO' | 'VIDEO'

export type ExtractionStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED_PASS1' | 'COMPLETED' | 'FAILED'

export interface Extraction {
  id: string
  title: string | null
  description: string | null
  summary: string | null
  videoUrl: string
  sourceType: ExtractionSourceType
  status: ExtractionStatus
  conceptCount: number
  questionCount: number
  completedAt: string | null
  createdAt: string
}

export interface ExtractionListResponse {
  data: Extraction[]
  meta: {
    total: number
    page: number
    limit: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
}

// ─── Queue Item Types ───

export interface QueueItem {
  questionId: string
  conceptTitle: string
  questionText: string
  questionType: QuestionType
  source: 'due' | 'failed' | 'new'
  lastScore: number | null
  lastAttemptDate: string | null
  interval: number
  repetitions: number
  easinessFactor: number
  nextReviewDate: string | null
}

// ─── Capture Types ───

export interface CaptureStats {
  todayCount: number
  totalConcepts: number
  dailyLimit: number
  plan: 'free' | 'pro' | 'enterprise'
}

export type CaptureSourceType = 'youtube' | 'web' | 'document' | 'audio' | 'video'

export interface ExtractionProgress {
  id: string
  status: 'pending' | 'pass1' | 'pass2' | 'completed' | 'failed'
  pass1Progress: number
  pass1Chunks: number
  pass1CompletedChunks: number
  pass2Progress: number
  conceptsFound: number
  concepts: ExtractedConcept[]
  error?: string
}

export interface ExtractedConcept {
  id: string
  title: string
  type: string
  chunkIndex: number
}

// ─── Mastery Analytics Types ───

export interface MasteryAnalyticsStats {
  totalAttempts: number
  passRate: number
  avgScore: number
  avgEF: number
}

export interface DailyPassRate {
  date: string
  passRate: number
  attempts: number
}

export interface TypeBreakdown {
  type:
    | 'open'
    | 'mcq'
    | 'cloze'
    | 'FREE_TEXT'
    | 'MULTIPLE_CHOICE'
    | 'TRUE_FALSE'
  passRate: number
  attempts: number
}

export interface ConceptLedgerEntry {
  conceptId: string
  conceptTitle: string
  attempts: number
  passRate: number
  avgScore: number
  easeFactor: number
  nextReviewDate: string
  status: 'strong' | 'fair' | 'weak'
}
