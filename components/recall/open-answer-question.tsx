'use client'

import { useState } from 'react'
import { Send } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface OpenAnswerQuestionProps {
  questionText: string
  onSubmit: (answer: string) => void
  disabled: boolean
}

const MAX_CHARS = 500

export function OpenAnswerQuestion({ questionText, onSubmit, disabled }: OpenAnswerQuestionProps) {
  const [answer, setAnswer] = useState('')

  function handleSubmit() {
    if (answer.trim().length === 0 || disabled) return
    onSubmit(answer.trim())
  }

  return (
    <div>
      <p className="text-lg font-medium mb-4">{questionText}</p>

      <textarea
        className="w-full min-h-[140px] rounded-lg border bg-background p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-teal/50 focus:border-brand-teal"
        placeholder="Type your answer here..."
        value={answer}
        onChange={(e) => setAnswer(e.target.value.slice(0, MAX_CHARS))}
        disabled={disabled}
      />

      <div className="flex items-center justify-between mt-2">
        <span className={`text-xs ${answer.length >= MAX_CHARS ? 'text-destructive' : 'text-muted-foreground'}`}>
          {answer.length}/{MAX_CHARS}
        </span>

        <Button
          onClick={handleSubmit}
          disabled={answer.trim().length === 0 || disabled}
          className="bg-brand-teal hover:bg-brand-teal/90 text-white"
        >
          <Send className="mr-2 h-4 w-4" />
          Submit Answer
        </Button>
      </div>
    </div>
  )
}
