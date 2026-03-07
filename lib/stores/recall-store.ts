'use client'

import { create } from 'zustand'
import type { Question, AnswerFeedback, SessionSummary } from '@/lib/types'

interface RecallState {
  sessionId: string | null
  currentQuestion: Question | null
  questionIndex: number
  totalQuestions: number
  isSubmitting: boolean
  lastFeedback: AnswerFeedback | null
  showFeedback: boolean
  isComplete: boolean
  summary: SessionSummary | null

  startSession: (sessionId: string, totalQuestions: number) => void
  setQuestion: (question: Question) => void
  setSubmitting: (isSubmitting: boolean) => void
  setFeedback: (feedback: AnswerFeedback) => void
  dismissFeedback: () => void
  setSessionComplete: (summary: SessionSummary) => void
  reset: () => void
}

export const useRecallStore = create<RecallState>((set) => ({
  sessionId: null,
  currentQuestion: null,
  questionIndex: 0,
  totalQuestions: 0,
  isSubmitting: false,
  lastFeedback: null,
  showFeedback: false,
  isComplete: false,
  summary: null,

  startSession: (sessionId, totalQuestions) =>
    set({ sessionId, totalQuestions, questionIndex: 0, isComplete: false }),

  setQuestion: (question) =>
    set((state) => ({
      currentQuestion: question,
      questionIndex: state.questionIndex + 1,
      showFeedback: false,
    })),

  setSubmitting: (isSubmitting) => set({ isSubmitting }),

  setFeedback: (feedback) =>
    set({ lastFeedback: feedback, showFeedback: true, isSubmitting: false }),

  dismissFeedback: () => set({ showFeedback: false }),

  setSessionComplete: (summary) =>
    set({ isComplete: true, summary, isSubmitting: false }),

  reset: () =>
    set({
      sessionId: null,
      currentQuestion: null,
      questionIndex: 0,
      totalQuestions: 0,
      isSubmitting: false,
      lastFeedback: null,
      showFeedback: false,
      isComplete: false,
      summary: null,
    }),
}))
