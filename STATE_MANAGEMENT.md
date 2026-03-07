# State Management — CoLearner Web

## Principle: Two Systems, Clear Boundaries

| State Type | Tool | What Goes Here |
|---|---|---|
| **Server state** | React Query (TanStack) | API data: concepts, questions, user profile, analytics |
| **Client state** | Zustand | UI state: active recall session, NCU animations, sidebar open/close |

**Rule**: If the data comes from an API, use React Query. If the data exists only in the browser, use Zustand. Never put API data in Zustand or UI state in React Query.

## React Query Setup

```typescript
// lib/providers/query-provider.tsx
'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { useState } from 'react'

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,          // 1 minute default
        gcTime: 5 * 60 * 1000,         // 5 minutes garbage collection
        retry: 2,
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
      },
      mutations: {
        retry: 1,
      },
    },
  }))

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {process.env.NODE_ENV === 'development' && <ReactQueryDevtools />}
    </QueryClientProvider>
  )
}
```

### Query Key Convention

All query keys follow a factory pattern for consistent invalidation:

```typescript
// lib/api/query-keys.ts
export const queryKeys = {
  // Mastery
  mastery: {
    all: ['mastery'] as const,
    concepts: () => [...queryKeys.mastery.all, 'concepts'] as const,
    concept: (id: string) => [...queryKeys.mastery.all, 'concept', id] as const,
    due: () => [...queryKeys.mastery.all, 'due'] as const,
    analytics: () => [...queryKeys.mastery.all, 'analytics'] as const,
    topics: () => [...queryKeys.mastery.all, 'topics'] as const,
  },

  // Recall
  recall: {
    all: ['recall'] as const,
    session: (id: string) => [...queryKeys.recall.all, 'session', id] as const,
    history: () => [...queryKeys.recall.all, 'history'] as const,
    summary: (id: string) => [...queryKeys.recall.all, 'summary', id] as const,
  },

  // Extraction
  extraction: {
    all: ['extraction'] as const,
    status: (id: string) => [...queryKeys.extraction.all, 'status', id] as const,
    result: (id: string) => [...queryKeys.extraction.all, 'result', id] as const,
    history: () => [...queryKeys.extraction.all, 'history'] as const,
  },

  // User
  user: {
    all: ['user'] as const,
    profile: () => [...queryKeys.user.all, 'profile'] as const,
    ncu: () => [...queryKeys.user.all, 'ncu'] as const,
    streak: () => [...queryKeys.user.all, 'streak'] as const,
    notifications: () => [...queryKeys.user.all, 'notifications'] as const,
  },

  // Billing
  billing: {
    all: ['billing'] as const,
    status: () => [...queryKeys.billing.all, 'status'] as const,
  },
}
```

### Stale Times by Data Type

```typescript
// How long before data is considered "stale" and refetched
const staleTimes = {
  static: 30 * 60 * 1000,    // 30 min — user profile, settings
  moderate: 5 * 60 * 1000,   // 5 min  — mastery concepts, extraction history
  fresh: 60 * 1000,          // 1 min  — due items, NCU balance
  realtime: 0,               // always — active recall session data
}
```

## Zustand Stores

### Recall Session Store
```typescript
// lib/stores/recall-store.ts
'use client'

import { create } from 'zustand'

interface RecallState {
  // Session state
  sessionId: string | null
  currentQuestion: Question | null
  questionIndex: number
  totalQuestions: number
  isSubmitting: boolean

  // Feedback state
  lastFeedback: AnswerFeedback | null
  showFeedback: boolean

  // Session results
  isComplete: boolean
  summary: SessionSummary | null

  // Actions
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
      sessionId: null, currentQuestion: null, questionIndex: 0,
      totalQuestions: 0, isSubmitting: false, lastFeedback: null,
      showFeedback: false, isComplete: false, summary: null,
    }),
}))
```

### UI Store
```typescript
// lib/stores/ui-store.ts
'use client'

import { create } from 'zustand'

interface UIState {
  sidebarOpen: boolean
  toggleSidebar: () => void

  // Toast/notification queue
  toasts: Toast[]
  addToast: (toast: Omit<Toast, 'id'>) => void
  dismissToast: (id: string) => void
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),

  toasts: [],
  addToast: (toast) =>
    set((state) => ({
      toasts: [...state.toasts, { ...toast, id: crypto.randomUUID() }],
    })),
  dismissToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),
}))
```

### User Store
```typescript
// lib/stores/user-store.ts
'use client'

import { create } from 'zustand'

interface UserState {
  // NCU state (optimistic updates)
  ncuBalance: number
  previousBalance: number
  setNCUBalance: (balance: number) => void

  // Streak
  currentStreak: number
  setStreak: (streak: number) => void

  // Subscription tier
  tier: 'free' | 'pro' | 'enterprise'
  setTier: (tier: 'free' | 'pro' | 'enterprise') => void
}

export const useUserStore = create<UserState>((set) => ({
  ncuBalance: 0,
  previousBalance: 0,
  setNCUBalance: (balance) =>
    set((state) => ({ ncuBalance: balance, previousBalance: state.ncuBalance })),

  currentStreak: 0,
  setStreak: (streak) => set({ currentStreak: streak }),

  tier: 'free',
  setTier: (tier) => set({ tier }),
}))
```

## Provider Composition

```typescript
// app/layout.tsx
import { QueryProvider } from '@/lib/providers/query-provider'
import { AuthProvider } from '@/lib/providers/auth-provider'
import { ThemeProvider } from '@/lib/providers/theme-provider'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <QueryProvider>
            <ThemeProvider>
              {children}
            </ThemeProvider>
          </QueryProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
```

## Rules

1. **Never store API response data in Zustand** — that's React Query's job
2. **Zustand stores are client-only** — always mark store files with `'use client'`
3. **Use selectors** to prevent unnecessary re-renders: `useRecallStore((s) => s.currentQuestion)`
4. **Query keys must use the factory pattern** — never write raw string arrays
5. **Invalidate, don't refetch** — after mutations, invalidate the relevant query key; React Query handles the rest
6. **Optimistic updates for instant feedback** — NCU balance changes, answer submissions
