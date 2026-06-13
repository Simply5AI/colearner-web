'use client'

import MonacoEditor from '@monaco-editor/react'
import type { TeacherAnswerValue, TeacherQuestion } from '@/lib/types/teacher'

interface CodeQuestionTypeProps {
  question: TeacherQuestion
  mode: 'preview' | 'attempt' | 'review'
  answer?: TeacherAnswerValue
  onAnswer?: (answer: TeacherAnswerValue) => void
  showExplanation?: boolean
}

export function CodeQuestionType({
  question,
  mode,
  answer,
  onAnswer,
  showExplanation,
}: CodeQuestionTypeProps) {
  const code = answer?.type === 'CODE' ? answer.code : ''
  const language =
    question.correctAnswer && 'language' in question.correctAnswer
      ? question.correctAnswer.language
      : 'javascript'
  const testCases =
    question.correctAnswer && 'testCases' in question.correctAnswer
      ? question.correctAnswer.testCases
      : []

  return (
    <div className="space-y-3">
      <p className="text-base font-medium">{question.prompt}</p>
      <div className="overflow-hidden rounded-lg border">
        <MonacoEditor
          height={mode === 'preview' ? 180 : 260}
          language={language}
          value={mode === 'preview' ? '// Student writes code here' : code}
          options={{
            readOnly: mode !== 'attempt',
            minimap: { enabled: false },
            fontSize: 13,
            scrollBeyondLastLine: false,
          }}
          onChange={(value) => {
            if (mode === 'attempt') {
              onAnswer?.({ type: 'CODE', code: value ?? '' })
            }
          }}
        />
      </div>
      {mode === 'review' && testCases.length > 0 && (
        <div className="rounded-lg border bg-muted/30 p-3 text-sm">
          <p className="mb-2 font-medium">Test cases</p>
          <ul className="space-y-1 text-muted-foreground">
            {testCases.map((testCase, index) => (
              <li key={`${testCase.input}-${index}`}>
                {testCase.input} → {testCase.expected}
              </li>
            ))}
          </ul>
        </div>
      )}
      {showExplanation && question.explanation && (
        <p className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
          {question.explanation}
        </p>
      )}
    </div>
  )
}