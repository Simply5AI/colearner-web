'use client'

import { useEffect, useState } from 'react'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import type { TeacherAnswerValue, TeacherQuestion, TeacherQuestionType } from '@/lib/types/teacher'

interface TextQuestionTypeProps {
  question: TeacherQuestion
  type: Extract<TeacherQuestionType, 'SHORT_ANSWER' | 'LONG_ANSWER' | 'FILL_BLANK'>
  mode: 'preview' | 'attempt' | 'review'
  answer?: TeacherAnswerValue
  onAnswer?: (answer: TeacherAnswerValue) => void
  showExplanation?: boolean
}

function getAnswerText(answer: TeacherAnswerValue | undefined, type: TextQuestionTypeProps['type']) {
  if (!answer) return ''
  if (type === 'SHORT_ANSWER' && answer.type === 'SHORT_ANSWER') return answer.text
  if (type === 'LONG_ANSWER' && answer.type === 'LONG_ANSWER') return answer.text
  if (type === 'FILL_BLANK' && answer.type === 'FILL_BLANK') return answer.text
  return ''
}

export function TextQuestionType({
  question,
  type,
  mode,
  answer,
  onAnswer,
  showExplanation,
}: TextQuestionTypeProps) {
  const externalText = getAnswerText(answer, type)
  const [draftText, setDraftText] = useState(externalText)

  useEffect(() => {
    if (mode !== 'attempt') {
      setDraftText(externalText)
    }
  }, [externalText, mode])

  const text = mode === 'attempt' ? draftText : externalText
  const accepted =
    question.correctAnswer && 'accepted' in question.correctAnswer
      ? question.correctAnswer.accepted
      : undefined
  const keyPoints =
    question.correctAnswer && 'keyPoints' in question.correctAnswer
      ? question.correctAnswer.keyPoints
      : undefined

  function handleChange(value: string) {
    if (mode !== 'attempt') return
    setDraftText(value)
    if (type === 'SHORT_ANSWER') onAnswer?.({ type: 'SHORT_ANSWER', text: value })
    if (type === 'LONG_ANSWER') onAnswer?.({ type: 'LONG_ANSWER', text: value })
    if (type === 'FILL_BLANK') onAnswer?.({ type: 'FILL_BLANK', text: value })
  }

  return (
    <div className="space-y-3">
      <p className="text-base font-medium">{question.prompt}</p>
      <Textarea
        value={text}
        readOnly={mode !== 'attempt'}
        rows={type === 'LONG_ANSWER' ? 8 : type === 'FILL_BLANK' ? 2 : 3}
        placeholder={
          type === 'FILL_BLANK'
            ? 'Fill in the blank...'
            : type === 'LONG_ANSWER'
              ? 'Write your detailed answer...'
              : 'Type your answer...'
        }
        onChange={(event) => handleChange(event.target.value)}
        className={cn(mode === 'review' && 'bg-muted/30')}
      />
      {mode === 'review' && accepted && (
        <p className="text-sm text-muted-foreground">
          Accepted answers: {accepted.join(', ')}
        </p>
      )}
      {mode === 'review' && keyPoints && keyPoints.length > 0 && (
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          {keyPoints.map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>
      )}
      {showExplanation && question.explanation && (
        <p className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
          {question.explanation}
        </p>
      )}
    </div>
  )
}