'use client'

import { useState } from 'react'
import { Send } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ClozeQuestionProps {
  questionText: string
  clozeTemplate: string
  blankCount: number
  onSubmit: (answer: string) => void
  disabled: boolean
}

export function ClozeQuestion({
  questionText,
  clozeTemplate,
  blankCount,
  onSubmit,
  disabled,
}: ClozeQuestionProps) {
  const [answers, setAnswers] = useState<string[]>(Array(blankCount).fill(''))

  function handleChange(index: number, value: string) {
    const newAnswers = [...answers]
    newAnswers[index] = value
    setAnswers(newAnswers)
  }

  function handleSubmit() {
    if (disabled || answers.some((a) => a.trim() === '')) return
    onSubmit(JSON.stringify(answers.map((a) => a.trim())))
  }

  // Render template with inline inputs
  const parts = clozeTemplate.split(/___(\d+)___/)

  return (
    <div>
      <p className="text-lg font-medium mb-4">{questionText}</p>

      <div className="rounded-lg bg-muted/50 p-4 mb-4 text-base leading-relaxed">
        {parts.map((part, i) => {
          if (i % 2 === 0) {
            return <span key={i}>{part}</span>
          }

          const blankIndex = parseInt(part, 10) - 1

          return (
            <input
              key={i}
              type="text"
              className="inline-block w-28 rounded border-b-2 border-brand-teal bg-background px-2 py-0.5 text-center text-sm font-medium focus:outline-none focus:ring-1 focus:ring-brand-teal mx-1"
              placeholder={`blank ${blankIndex + 1}`}
              value={answers[blankIndex] ?? ''}
              onChange={(e) => handleChange(blankIndex, e.target.value)}
              disabled={disabled}
            />
          )
        })}
      </div>

      <Button
        onClick={handleSubmit}
        disabled={disabled || answers.some((a) => a.trim() === '')}
        className="w-full bg-brand-teal hover:bg-brand-teal/90 text-white"
      >
        <Send className="mr-2 h-4 w-4" />
        Submit Answer
      </Button>
    </div>
  )
}
