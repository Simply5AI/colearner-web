'use client'

import { motion } from 'framer-motion'
import { CheckCircle2, XCircle, ArrowRight, SkipForward, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { AnswerResult } from '@/lib/types'

interface AnswerFeedbackProps {
  result: AnswerResult
  isLastQuestion: boolean
  onNext: () => void
  onTutoring?: () => void
}

export function AnswerFeedback({ result, isLastQuestion, onNext, onTutoring }: AnswerFeedbackProps) {
  const passed = result.isCorrect

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`rounded-xl border-2 p-5 mt-4 ${
        passed
          ? 'border-green-300 bg-green-50 dark:border-green-700 dark:bg-green-950/30'
          : 'border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-950/30'
      }`}
    >
      <div className="flex items-start gap-3 mb-3">
        {passed ? (
          <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5 shrink-0" />
        ) : (
          <XCircle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
        )}
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <span className={`text-sm font-semibold ${passed ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>
              {passed ? 'Correct!' : 'Incorrect'}
            </span>
            <span className={`text-sm font-bold ${passed ? 'text-green-600' : 'text-red-600'}`}>
              {result.score}/10
            </span>
          </div>
          <p className="text-sm mt-1 text-foreground/80">{result.feedback}</p>

          {result.correctAnswer && !passed && (
            <p className="text-sm mt-2 font-medium text-foreground/90">
              Correct answer: {result.correctAnswer}
            </p>
          )}

          {!passed && onTutoring && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onTutoring}
              className="mt-2 text-brand-purple hover:text-brand-purple/90 -ml-2"
            >
              <Sparkles className="h-4 w-4 mr-1" />
              Why was I wrong?
            </Button>
          )}
        </div>
      </div>

      {/* SM-2 Update */}
      <div className="text-xs text-muted-foreground border-t pt-2 mt-2">
        <span>
          Next review: {formatInterval(result.sm2Delta.intervalBefore)} → {formatInterval(result.sm2Delta.intervalAfter)}
        </span>
        <span className="mx-2">·</span>
        <span>
          Difficulty: {result.sm2Delta.efBefore.toFixed(2)} → {result.sm2Delta.efAfter.toFixed(2)}
        </span>
      </div>

      <Button
        onClick={onNext}
        className="w-full mt-3 bg-brand-teal hover:bg-brand-teal/90 text-white"
      >
        {isLastQuestion ? (
          <>
            <SkipForward className="mr-2 h-4 w-4" />
            Finish Session
          </>
        ) : (
          <>
            <ArrowRight className="mr-2 h-4 w-4" />
            Next Question
          </>
        )}
      </Button>
    </motion.div>
  )
}

function formatInterval(days: number): string {
  if (days === 0) return 'now'
  if (days === 1) return '1d'
  if (days < 30) return `${days}d`
  if (days < 365) return `${Math.round(days / 30)}mo`
  return `${Math.round(days / 365)}y`
}
