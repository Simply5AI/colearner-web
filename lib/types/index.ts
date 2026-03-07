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
