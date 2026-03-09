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
  type: 'open' | 'mcq' | 'cloze'
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
