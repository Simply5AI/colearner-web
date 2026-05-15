'use client'

import { create } from 'zustand'
import type {
  QuestionWithMeta,
  AnswerResult,
  SessionSummaryDetailed,
} from '@/lib/types'

interface RecallState {
  // Session state
  sessionId: string | null
  questions: QuestionWithMeta[]
  currentQuestionIndex: number
  totalQuestions: number

  // Answer state
  isSubmitting: boolean
  lastResult: AnswerResult | null
  showFeedback: boolean
  answerResults: AnswerResult[]

  // UI state
  hintVisible: boolean
  timerStartedAt: number | null

  // Completion
  isComplete: boolean
  summary: SessionSummaryDetailed | null

  // Actions
  startSession: (sessionId: string, questions: QuestionWithMeta[]) => void
  nextQuestion: () => void
  setSubmitting: (isSubmitting: boolean) => void
  setResult: (result: AnswerResult) => void
  dismissFeedback: () => void
  toggleHint: () => void
  startTimer: () => void
  setSessionComplete: (summary: SessionSummaryDetailed) => void
  markQuestionSkipped: (questionId: string) => void
  reset: () => void
}

const initialState = {
  sessionId: null,
  questions: [],
  currentQuestionIndex: 0,
  totalQuestions: 0,
  isSubmitting: false,
  lastResult: null,
  showFeedback: false,
  answerResults: [],
  hintVisible: false,
  timerStartedAt: null,
  isComplete: false,
  summary: null,
}

export const useRecallStore = create<RecallState>((set) => ({
  ...initialState,

  startSession: (sessionId, questions) => {
    // Resume from the first unanswered, unskipped question. Falls back to the
    // last question if everything is already done (the user will see the
    // last-question state and can complete the session from there).
    const firstUnansweredIdx = questions.findIndex((q) => !q.answered && !q.skipped)
    const resumeIdx =
      firstUnansweredIdx >= 0 ? firstUnansweredIdx : Math.max(0, questions.length - 1)
    return set({
      ...initialState,
      sessionId,
      questions,
      totalQuestions: questions.length,
      currentQuestionIndex: resumeIdx,
      timerStartedAt: Date.now(),
    })
  },

  nextQuestion: () =>
    set((state) => ({
      currentQuestionIndex: state.currentQuestionIndex + 1,
      showFeedback: false,
      lastResult: null,
      hintVisible: false,
      timerStartedAt: Date.now(),
    })),

  setSubmitting: (isSubmitting) => set({ isSubmitting }),

  setResult: (result) =>
    set((state) => ({
      lastResult: result,
      showFeedback: true,
      isSubmitting: false,
      answerResults: [...state.answerResults, result],
    })),

  dismissFeedback: () => set({ showFeedback: false }),

  toggleHint: () => set((state) => ({ hintVisible: !state.hintVisible })),

  startTimer: () => set({ timerStartedAt: Date.now() }),

  setSessionComplete: (summary) =>
    set({ isComplete: true, summary, isSubmitting: false }),

  markQuestionSkipped: (questionId) =>
    set((state) => ({
      questions: state.questions.map((q) =>
        q.id === questionId ? { ...q, skipped: true } : q
      ),
    })),

  reset: () => set(initialState),
}))
