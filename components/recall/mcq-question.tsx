'use client'

import { useState } from 'react'
import { Check } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface MCQQuestionProps {
  questionText: string
  options: string[]
  onSubmit: (answer: string) => void
  disabled: boolean
}

const labels = ['A', 'B', 'C', 'D']

export function MCQQuestion({ questionText, options, onSubmit, disabled }: MCQQuestionProps) {
  const [selected, setSelected] = useState<number | null>(null)

  function handleSubmit() {
    if (selected === null || disabled) return
    onSubmit(String(selected))
  }

  return (
    <div>
      <p className="text-lg font-medium mb-4">{questionText}</p>

      <div className="space-y-2 mb-4">
        {options.map((option, i) => (
          <button
            key={i}
            onClick={() => !disabled && setSelected(i)}
            disabled={disabled}
            className={`w-full flex items-center gap-3 rounded-lg border p-3 text-left transition-colors ${
              selected === i
                ? 'border-brand-teal bg-brand-teal/5 ring-1 ring-brand-teal'
                : 'hover:border-muted-foreground/30'
            } ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            <span
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-xs font-bold ${
                selected === i
                  ? 'bg-brand-teal text-white'
                  : 'bg-muted'
              }`}
            >
              {labels[i]}
            </span>
            <span className="text-sm">{option}</span>
          </button>
        ))}
      </div>

      <Button
        onClick={handleSubmit}
        disabled={selected === null || disabled}
        className="w-full bg-brand-teal hover:bg-brand-teal/90 text-white"
      >
        <Check className="mr-2 h-4 w-4" />
        Confirm Answer
      </Button>
    </div>
  )
}
