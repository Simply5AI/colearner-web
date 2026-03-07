# API Integration Guide — CoLearner Web

## API Architecture

The web app communicates with `colearner-platform` (NestJS backend) via REST and WebSocket. The web app NEVER makes direct database calls or direct LLM calls.

```
colearner-web  ──REST/WS──►  colearner-platform (NestJS)
                                    │
                                    ├──► PostgreSQL (Neon) via Prisma
                                    ├──► Redis (Upstash) for cache/queue
                                    ├──► Anthropic API (Claude) for LLM
                                    └──► colearner-ai (FastAPI) for agents
```

## API Client Setup

```typescript
// lib/api/client.ts
import { z } from 'zod'

const API_URL = process.env.NEXT_PUBLIC_API_URL!

interface ApiOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  headers?: Record<string, string>
  schema?: z.ZodSchema  // Optional response validation
}

export async function apiClient<T>(
  path: string,
  options: ApiOptions = {}
): Promise<T> {
  const { method = 'GET', body, headers = {}, schema } = options

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: res.statusText }))
    throw new ApiError(res.status, error.message)
  }

  const data = await res.json()
  return schema ? schema.parse(data) : data as T
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
    this.name = 'ApiError'
  }
}
```

## Auth Token Flow

```
1. User logs in via Auth.js (Google OAuth or email/password)
2. Auth.js stores session in HTTP-only Secure cookie
3. Server Components: read cookie directly, pass JWT to API calls
4. Client Components: use Auth.js useSession() hook
5. API calls from server: include Authorization header from cookie
6. API calls from client: React Query passes token from session

Token lifecycle:
- Access token: 15 min expiry
- Refresh token: 7 days, rotation on use, stored in Redis
- On 401: Auth.js automatically refreshes token
```

```typescript
// lib/api/auth-headers.ts
import { auth } from '@/lib/auth/config'

export async function getAuthHeaders(): Promise<Record<string, string>> {
  const session = await auth()
  if (!session?.accessToken) {
    throw new Error('Not authenticated')
  }
  return {
    Authorization: `Bearer ${session.accessToken}`,
  }
}
```

## API Endpoints

### Authentication
| Method | Path | Purpose |
|---|---|---|
| POST | `/auth/login` | Email/password login |
| POST | `/auth/register` | New user registration |
| POST | `/auth/refresh` | Refresh access token |
| GET | `/auth/me` | Get current user profile |
| POST | `/auth/logout` | Invalidate refresh token |

### Extraction
| Method | Path | Purpose |
|---|---|---|
| POST | `/extraction/video` | Submit video URL for extraction |
| GET | `/extraction/:id/status` | Poll extraction job status |
| GET | `/extraction/:id/result` | Get extracted concepts + questions |
| GET | `/extraction/history` | List past extractions |

### Recall Sessions
| Method | Path | Purpose |
|---|---|---|
| POST | `/recall/start` | Start a new recall session (returns questions) |
| POST | `/recall/:sessionId/answer` | Submit answer for judging |
| GET | `/recall/:sessionId/summary` | Get session summary + scores |
| GET | `/recall/history` | List past recall sessions |
| WS | `/recall/live` | Real-time WebSocket for active session |

### Mastery & SM-2
| Method | Path | Purpose |
|---|---|---|
| GET | `/mastery/concepts` | All concepts with SM-2 state |
| GET | `/mastery/due` | Concepts due for review today |
| GET | `/mastery/analytics` | Aggregated mastery analytics |
| GET | `/mastery/topics` | Topic-level mastery summary |

### User & Settings
| Method | Path | Purpose |
|---|---|---|
| GET | `/user/profile` | User profile data |
| PATCH | `/user/profile` | Update profile |
| GET | `/user/ncu` | NCU balance + transaction history |
| GET | `/user/streak` | Streak data |
| PATCH | `/user/notifications` | Update notification preferences |

### Billing (Razorpay)
| Method | Path | Purpose |
|---|---|---|
| POST | `/billing/create-subscription` | Initiate Pro subscription |
| GET | `/billing/status` | Current subscription status |
| POST | `/billing/cancel` | Cancel subscription |

## WebSocket Integration

```typescript
// lib/api/websocket.ts
'use client'

import { useEffect, useRef } from 'react'
import { useRecallStore } from '@/lib/stores/recall-store'

export function useRecallWebSocket(sessionId: string, token: string) {
  const ws = useRef<WebSocket | null>(null)
  const { setQuestion, setFeedback, setSessionComplete } = useRecallStore()

  useEffect(() => {
    const WS_URL = process.env.NEXT_PUBLIC_WS_URL!
    ws.current = new WebSocket(`${WS_URL}/recall/live?session=${sessionId}&token=${token}`)

    ws.current.onmessage = (event) => {
      const data = JSON.parse(event.data)

      switch (data.type) {
        case 'question':
          setQuestion(data.question)
          break
        case 'judged':
          setFeedback({ score: data.score, feedback: data.feedback })
          break
        case 'session_complete':
          setSessionComplete(data.summary)
          break
      }
    }

    return () => ws.current?.close()
  }, [sessionId, token])

  const sendAnswer = (questionId: string, answer: string) => {
    ws.current?.send(JSON.stringify({
      type: 'answer',
      questionId,
      answer,
    }))
  }

  return { sendAnswer }
}
```

## React Query Patterns

```typescript
// lib/hooks/use-mastery.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api/client'

// Query key factory
export const masteryKeys = {
  all: ['mastery'] as const,
  concepts: () => [...masteryKeys.all, 'concepts'] as const,
  due: () => [...masteryKeys.all, 'due'] as const,
  analytics: () => [...masteryKeys.all, 'analytics'] as const,
}

// Fetch hook
export function useMasteryConcepts() {
  return useQuery({
    queryKey: masteryKeys.concepts(),
    queryFn: () => apiClient<ConceptWithSM2State[]>('/mastery/concepts'),
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

// Due items (refresh more frequently)
export function useDueItems() {
  return useQuery({
    queryKey: masteryKeys.due(),
    queryFn: () => apiClient<DueItem[]>('/mastery/due'),
    staleTime: 60 * 1000, // 1 minute
    refetchInterval: 5 * 60 * 1000, // Poll every 5 min
  })
}
```

## Server Action Patterns

```typescript
// app/(dashboard)/extract/actions.ts
'use server'

import { auth } from '@/lib/auth/config'
import { apiClient } from '@/lib/api/client'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const extractSchema = z.object({
  videoUrl: z.string().url(),
})

export async function extractVideo(formData: FormData) {
  const session = await auth()
  if (!session) throw new Error('Not authenticated')

  const { videoUrl } = extractSchema.parse({
    videoUrl: formData.get('videoUrl'),
  })

  const result = await apiClient('/extraction/video', {
    method: 'POST',
    body: { videoUrl },
    headers: { Authorization: `Bearer ${session.accessToken}` },
  })

  revalidatePath('/dashboard')
  return result
}
```

## Error Handling

| HTTP Status | Meaning | Web App Response |
|---|---|---|
| 401 | Token expired | Auth.js auto-refresh; if fails, redirect to /login |
| 403 | Forbidden (wrong org/tier) | Show upgrade CTA or permission error |
| 404 | Resource not found | Show 404 component |
| 409 | Conflict (duplicate extraction) | Show "already extracted" message |
| 429 | Rate limited | Show "slow down" toast with retry-after |
| 500 | Server error | Show error fallback, log to Sentry |
