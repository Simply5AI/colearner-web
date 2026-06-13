'use client'

import type { TeacherAnswerValue, TeacherQuestion } from '@/lib/types/teacher'
import { CodeQuestionType } from '@/components/questions/types/code-question-type'
import { McqQuestionType } from '@/components/questions/types/mcq-question-type'
import { MultiSelectQuestionType } from '@/components/questions/types/multi-select-question-type'
import { TextQuestionType } from '@/components/questions/types/text-question-type'
import { TrueFalseQuestionType } from '@/components/questions/types/true-false-question-type'

export type QuestionRenderMode = 'preview' | 'attempt' | 'review'

export interface QuestionRendererProps {
  question: TeacherQuestion
  mode: QuestionRenderMode
  answer?: TeacherAnswerValue
  onAnswer?: (answer: TeacherAnswerValue) => void
  showExplanation?: boolean
}

export function QuestionRenderer({
  question,
  mode,
  answer,
  onAnswer,
  showExplanation = mode === 'review',
}: QuestionRendererProps) {
  switch (question.type) {
    case 'MCQ':
      return (
        <McqQuestionType
          question={question}
          mode={mode}
          answer={answer}
          onAnswer={onAnswer}
          showExplanation={showExplanation}
        />
      )
    case 'MULTI_SELECT':
      return (
        <MultiSelectQuestionType
          question={question}
          mode={mode}
          answer={answer}
          onAnswer={onAnswer}
          showExplanation={showExplanation}
        />
      )
    case 'TRUE_FALSE':
      return (
        <TrueFalseQuestionType
          question={question}
          mode={mode}
          answer={answer}
          onAnswer={onAnswer}
          showExplanation={showExplanation}
        />
      )
    case 'SHORT_ANSWER':
    case 'LONG_ANSWER':
    case 'FILL_BLANK':
      return (
        <TextQuestionType
          question={question}
          type={question.type}
          mode={mode}
          answer={answer}
          onAnswer={onAnswer}
          showExplanation={showExplanation}
        />
      )
    case 'CODE':
      return (
        <CodeQuestionType
          question={question}
          mode={mode}
          answer={answer}
          onAnswer={onAnswer}
          showExplanation={showExplanation}
        />
      )
    default:
      return (
        <p className="text-sm text-muted-foreground">
          Unsupported question type.
        </p>
      )
  }
}