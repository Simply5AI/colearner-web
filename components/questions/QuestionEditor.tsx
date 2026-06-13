'use client'

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { QuestionRenderer } from '@/components/questions/QuestionRenderer'
import type {
  TeacherCorrectAnswer,
  TeacherQuestion,
  TeacherQuestionOption,
  TeacherQuestionType,
} from '@/lib/types/teacher'

interface QuestionEditorProps {
  initialQuestion?: Partial<TeacherQuestion>
  onSave: (question: Omit<TeacherQuestion, 'id' | 'planId' | 'topicId' | 'status'>) => void
  onCancel: () => void
}

const questionTypes: TeacherQuestionType[] = [
  'MCQ',
  'MULTI_SELECT',
  'TRUE_FALSE',
  'SHORT_ANSWER',
  'LONG_ANSWER',
  'FILL_BLANK',
  'CODE',
]

let optionCounter = 0

function createOptionId(): string {
  optionCounter += 1
  return `option-${optionCounter}`
}

function defaultOptions(): TeacherQuestionOption[] {
  return [
    { id: createOptionId(), label: 'Option A' },
    { id: createOptionId(), label: 'Option B' },
  ]
}

function defaultCorrectAnswer(type: TeacherQuestionType): TeacherCorrectAnswer {
  switch (type) {
    case 'MCQ':
      return { optionId: '' }
    case 'MULTI_SELECT':
      return { optionIds: [] }
    case 'TRUE_FALSE':
      return { value: true }
    case 'SHORT_ANSWER':
    case 'FILL_BLANK':
      return { accepted: [''], caseSensitive: false }
    case 'LONG_ANSWER':
      return { rubric: '', keyPoints: [''] }
    case 'CODE':
      return { language: 'javascript', testCases: [{ input: '', expected: '' }] }
  }
}

function validateQuestion(question: {
  prompt: string
  explanation: string
  type: TeacherQuestionType
  options?: TeacherQuestionOption[]
  correctAnswer: TeacherCorrectAnswer
}): string | null {
  if (!question.prompt.trim()) return 'Prompt is required.'
  if (question.explanation.trim().length < 10) {
    return 'Explanation must be at least 10 characters.'
  }

  if (question.type === 'MCQ') {
    const options = question.options ?? []
    if (options.length < 2) return 'MCQ requires at least 2 options.'
    if (!('optionId' in question.correctAnswer) || !question.correctAnswer.optionId) {
      return 'Select a correct MCQ option.'
    }
  }

  if (question.type === 'MULTI_SELECT') {
    const options = question.options ?? []
    if (options.length < 2) return 'Multi-select requires at least 2 options.'
    if (
      !('optionIds' in question.correctAnswer) ||
      question.correctAnswer.optionIds.length === 0
    ) {
      return 'Select at least one correct option.'
    }
  }

  if (
    (question.type === 'SHORT_ANSWER' || question.type === 'FILL_BLANK') &&
    'accepted' in question.correctAnswer &&
    question.correctAnswer.accepted.filter(Boolean).length === 0
  ) {
    return 'Provide at least one accepted answer.'
  }

  if (
    question.type === 'CODE' &&
    'testCases' in question.correctAnswer &&
    question.correctAnswer.testCases.filter((tc) => tc.input && tc.expected).length === 0
  ) {
    return 'Code questions require at least one test case.'
  }

  return null
}

export function QuestionEditor({ initialQuestion, onSave, onCancel }: QuestionEditorProps) {
  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit')
  const [type, setType] = useState<TeacherQuestionType>(
    initialQuestion?.type ?? 'MCQ',
  )
  const [prompt, setPrompt] = useState(initialQuestion?.prompt ?? '')
  const [explanation, setExplanation] = useState(initialQuestion?.explanation ?? '')
  const [options, setOptions] = useState<TeacherQuestionOption[]>(
    initialQuestion?.options ?? defaultOptions(),
  )
  const [correctAnswer, setCorrectAnswer] = useState<TeacherCorrectAnswer>(
    initialQuestion?.correctAnswer ?? defaultCorrectAnswer(type),
  )
  const [error, setError] = useState<string | null>(null)

  const previewQuestion = useMemo<TeacherQuestion>(
    () => ({
      id: 'preview',
      planId: 'preview',
      topicId: 'preview',
      type,
      status: 'DRAFT',
      prompt: prompt || 'Question prompt preview',
      options,
      correctAnswer,
      explanation,
    }),
    [type, prompt, options, correctAnswer, explanation],
  )

  function handleTypeChange(nextType: TeacherQuestionType) {
    setType(nextType)
    setCorrectAnswer(defaultCorrectAnswer(nextType))
    if (nextType === 'MCQ' || nextType === 'MULTI_SELECT') {
      setOptions(defaultOptions())
    }
  }

  function handleSave() {
    const validationError = validateQuestion({
      prompt,
      explanation,
      type,
      options,
      correctAnswer,
    })
    if (validationError) {
      setError(validationError)
      return
    }
    setError(null)
    onSave({ type, prompt: prompt.trim(), explanation: explanation.trim(), options, correctAnswer })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant={activeTab === 'edit' ? 'default' : 'outline'}
          onClick={() => setActiveTab('edit')}
        >
          Edit
        </Button>
        <Button
          type="button"
          variant={activeTab === 'preview' ? 'default' : 'outline'}
          onClick={() => setActiveTab('preview')}
        >
          Preview
        </Button>
      </div>

      {activeTab === 'preview' ? (
        <QuestionRenderer question={previewQuestion} mode="preview" />
      ) : (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="question-type">Question type</Label>
            <Select value={type} onValueChange={(value) => handleTypeChange(value as TeacherQuestionType)}>
              <SelectTrigger id="question-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {questionTypes.map((questionType) => (
                  <SelectItem key={questionType} value={questionType}>
                    {questionType.replaceAll('_', ' ')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="question-prompt">Prompt</Label>
            <Textarea
              id="question-prompt"
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              rows={3}
            />
          </div>

          {(type === 'MCQ' || type === 'MULTI_SELECT') && (
            <div className="space-y-2">
              <Label>Options</Label>
              {options.map((option, index) => (
                <div key={option.id} className="flex items-center gap-2">
                  <Input
                    value={option.label}
                    onChange={(event) => {
                      const next = [...options]
                      next[index] = { ...option, label: event.target.value }
                      setOptions(next)
                    }}
                  />
                  {type === 'MCQ' && (
                    <Button
                      type="button"
                      size="sm"
                      variant={
                        'optionId' in correctAnswer && correctAnswer.optionId === option.id
                          ? 'default'
                          : 'outline'
                      }
                      onClick={() => setCorrectAnswer({ optionId: option.id })}
                    >
                      Correct
                    </Button>
                  )}
                  {type === 'MULTI_SELECT' && (
                    <Button
                      type="button"
                      size="sm"
                      variant={
                        'optionIds' in correctAnswer &&
                        correctAnswer.optionIds.includes(option.id)
                          ? 'default'
                          : 'outline'
                      }
                      onClick={() => {
                        if (!('optionIds' in correctAnswer)) return
                        const selected = correctAnswer.optionIds.includes(option.id)
                          ? correctAnswer.optionIds.filter((id) => id !== option.id)
                          : [...correctAnswer.optionIds, option.id]
                        setCorrectAnswer({ optionIds: selected })
                      }}
                    >
                      Correct
                    </Button>
                  )}
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setOptions([
                    ...options,
                    { id: createOptionId(), label: `Option ${String.fromCharCode(65 + options.length)}` },
                  ])
                }
              >
                Add option
              </Button>
            </div>
          )}

          {type === 'TRUE_FALSE' && (
            <div className="flex gap-2">
              <Button
                type="button"
                variant={'value' in correctAnswer && correctAnswer.value ? 'default' : 'outline'}
                onClick={() => setCorrectAnswer({ value: true })}
              >
                Correct: True
              </Button>
              <Button
                type="button"
                variant={'value' in correctAnswer && !correctAnswer.value ? 'default' : 'outline'}
                onClick={() => setCorrectAnswer({ value: false })}
              >
                Correct: False
              </Button>
            </div>
          )}

          {(type === 'SHORT_ANSWER' || type === 'FILL_BLANK') && (
            <div className="space-y-2">
              <Label>Accepted answers (comma-separated)</Label>
              <Input
                value={
                  'accepted' in correctAnswer ? correctAnswer.accepted.join(', ') : ''
                }
                onChange={(event) =>
                  setCorrectAnswer({
                    accepted: event.target.value.split(',').map((value) => value.trim()),
                    caseSensitive: false,
                  })
                }
              />
            </div>
          )}

          {type === 'LONG_ANSWER' && (
            <div className="space-y-2">
              <Label>Rubric</Label>
              <Textarea
                value={'rubric' in correctAnswer ? correctAnswer.rubric : ''}
                onChange={(event) =>
                  setCorrectAnswer({
                    rubric: event.target.value,
                    keyPoints:
                      'keyPoints' in correctAnswer ? correctAnswer.keyPoints : [''],
                  })
                }
              />
            </div>
          )}

          {type === 'CODE' && (
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Language</Label>
                <Input
                  value={'language' in correctAnswer ? correctAnswer.language : 'javascript'}
                  onChange={(event) =>
                    setCorrectAnswer({
                      language: event.target.value,
                      testCases:
                        'testCases' in correctAnswer
                          ? correctAnswer.testCases
                          : [{ input: '', expected: '' }],
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Test case (input → expected)</Label>
                <Input
                  placeholder="sum(2,3) → 5"
                  value={
                    'testCases' in correctAnswer
                      ? `${correctAnswer.testCases[0]?.input ?? ''} → ${correctAnswer.testCases[0]?.expected ?? ''}`
                      : ''
                  }
                  onChange={(event) => {
                    const [input = '', expected = ''] = event.target.value.split('→').map((v) => v.trim())
                    setCorrectAnswer({
                      language:
                        'language' in correctAnswer ? correctAnswer.language : 'javascript',
                      testCases: [{ input, expected }],
                    })
                  }}
                />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="question-explanation">Explanation (required)</Label>
            <Textarea
              id="question-explanation"
              value={explanation}
              onChange={(event) => setExplanation(event.target.value)}
              rows={3}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSave}>
              Save question
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}