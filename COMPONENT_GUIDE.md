# Component Guide — CoLearner Web

## Design System

### Foundation: shadcn/ui + Tailwind CSS 4

All UI components are built on shadcn/ui. We do NOT wrap shadcn components — we use them directly and style with Tailwind. Custom CoLearner components compose shadcn primitives.

### Design Tokens

```typescript
// lib/design-tokens.ts — shared with @colearner/ui package
export const colors = {
  brand: {
    primary: '#2E75B6',      // CoLearner blue
    secondary: '#1A3C5E',    // Dark blue (headings)
    accent: '#F59E0B',       // Amber (NCU, achievements)
    success: '#10B981',      // Green (pass, mastery)
    warning: '#F97316',      // Orange (review due)
    danger: '#EF4444',       // Red (fail, overdue)
  },
  mastery: {
    new: '#94A3B8',          // Slate (unseen concept)
    learning: '#3B82F6',     // Blue (in progress)
    review: '#F59E0B',       // Amber (due for review)
    mastered: '#10B981',     // Green (mastered)
    excel: '#8B5CF6',        // Purple (excel state)
  }
}

export const spacing = {
  page: 'px-4 md:px-6 lg:px-8',
  section: 'py-6 md:py-8',
  card: 'p-4 md:p-6',
}
```

## Component Hierarchy

```
components/
├── ui/                          # shadcn/ui primitives (DO NOT MODIFY)
│   ├── button.tsx
│   ├── card.tsx
│   ├── dialog.tsx
│   ├── input.tsx
│   ├── badge.tsx
│   ├── progress.tsx
│   ├── toast.tsx
│   └── ...
│
├── shared/                      # Cross-cutting CoLearner components
│   ├── AppSidebar.tsx           # Dashboard sidebar navigation
│   ├── TopBar.tsx               # Top navigation bar with user menu
│   ├── NCUBadge.tsx             # NCU balance display with animation
│   ├── StreakCounter.tsx        # Daily streak flame icon + count
│   ├── MasteryBadge.tsx         # Mastery state badge (New/Learning/Review/Mastered/Excel)
│   ├── LoadingSkeleton.tsx      # Skeleton loading states
│   └── ErrorFallback.tsx        # Error boundary fallback UI
│
├── dashboard/
│   ├── DashboardOverview.tsx    # Summary cards: due items, streak, NCU
│   ├── DueItemsList.tsx         # List of concepts due for review today
│   ├── MasteryLedger.tsx        # Full concept list with SM-2 state
│   ├── MasteryProgressBar.tsx   # Visual progress: % mastered per topic
│   ├── TopicHeatMap.tsx         # Recharts heat map of topic strengths
│   └── RetentionCurve.tsx       # Recharts line chart of retention over time
│
├── recall/
│   ├── RecallSession.tsx        # Main recall session container
│   ├── QuestionCard.tsx         # Renders question (MCQ/Open/Cloze)
│   ├── MCQQuestion.tsx          # Multiple choice question variant
│   ├── OpenQuestion.tsx         # Free-text answer variant
│   ├── ClozeQuestion.tsx        # Fill-in-the-blank variant
│   ├── AnswerFeedback.tsx       # Score + AI feedback after answer
│   ├── SessionTimer.tsx         # Countdown/elapsed timer
│   ├── SessionProgress.tsx      # Progress bar: X of Y questions
│   └── SessionSummary.tsx       # End-of-session results + stats
│
├── extraction/
│   ├── VideoExtractor.tsx       # Video URL input + extraction trigger
│   ├── ExtractionProgress.tsx   # Progress indicator during extraction
│   ├── ConceptPreview.tsx       # Preview extracted concepts before save
│   └── ExtractionHistory.tsx    # List of past extractions
│
└── settings/
    ├── ProfileForm.tsx          # User profile edit form
    ├── NotificationPrefs.tsx    # Notification settings (push, email, quiet hours)
    ├── BillingSection.tsx       # Subscription status + upgrade CTA
    └── DangerZone.tsx           # Account deletion, data export
```

## Component Patterns

### Server Component (default)
```tsx
// components/dashboard/MasteryLedger.tsx
// No 'use client' — this is a Server Component

import { Badge } from '@/components/ui/badge'
import { MasteryBadge } from '@/components/shared/MasteryBadge'

interface MasteryLedgerProps {
  concepts: ConceptWithSM2State[]
}

export function MasteryLedger({ concepts }: MasteryLedgerProps) {
  return (
    <div className="space-y-2">
      {concepts.map((concept) => (
        <div key={concept.id} className="flex items-center justify-between p-3 border rounded-lg">
          <span className="font-medium">{concept.title}</span>
          <MasteryBadge state={concept.masteryState} />
        </div>
      ))}
    </div>
  )
}
```

### Client Component (interactive)
```tsx
// components/recall/QuestionCard.tsx
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { useRecallStore } from '@/lib/stores/recall-store'

interface QuestionCardProps {
  question: Question
  onAnswer: (answer: string) => void
}

export function QuestionCard({ question, onAnswer }: QuestionCardProps) {
  const [answer, setAnswer] = useState('')
  const { isSubmitting } = useRecallStore()

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">{question.text}</h2>
      {/* Question-type-specific input */}
      <Button
        onClick={() => onAnswer(answer)}
        disabled={isSubmitting || !answer}
      >
        Submit Answer
      </Button>
    </div>
  )
}
```

### Animated Component (Framer Motion)
```tsx
// components/shared/NCUBadge.tsx
'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { Badge } from '@/components/ui/badge'

interface NCUBadgeProps {
  balance: number
  previousBalance: number
}

export function NCUBadge({ balance, previousBalance }: NCUBadgeProps) {
  const gained = balance > previousBalance

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={balance}
        initial={gained ? { scale: 1.3, color: '#F59E0B' } : {}}
        animate={{ scale: 1, color: '#1A3C5E' }}
        transition={{ type: 'spring', stiffness: 300 }}
      >
        <Badge variant="outline" className="text-lg font-bold">
          {balance} NCU
        </Badge>
      </motion.div>
    </AnimatePresence>
  )
}
```

## Rules

1. **Server Component by default** — only add `'use client'` when you need useState, useEffect, event handlers, or browser APIs
2. **Props over context** — pass data via props from Server Components; only use Zustand for truly global client state
3. **No `any` types** — every component prop must have a typed interface
4. **Accessible by default** — use shadcn/ui which has ARIA attributes built in; add `aria-label` to custom interactive elements
5. **Responsive** — mobile-first Tailwind classes (`text-sm md:text-base lg:text-lg`)
6. **Loading states** — every async component must have a Suspense boundary with a skeleton fallback
7. **Error boundaries** — every route-level component must have an `error.tsx` sibling
