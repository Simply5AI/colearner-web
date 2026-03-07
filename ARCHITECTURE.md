# Architecture — CoLearner Web

## System Context

```
┌─────────────────────────────────────────────────────────────────┐
│                        User's Browser                           │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │              colearner-web (Next.js 15)                    │  │
│  │  ┌─────────────┐  ┌──────────────┐  ┌─────────────────┐  │  │
│  │  │ Server      │  │ Client       │  │ Auth.js v5      │  │  │
│  │  │ Components  │  │ Components   │  │ (NextAuth)      │  │  │
│  │  │ (RSC)       │  │ (Zustand +   │  │ Google OAuth    │  │  │
│  │  │             │  │  React Query)│  │ Email/Password  │  │  │
│  │  └──────┬──────┘  └──────┬───────┘  └────────┬────────┘  │  │
│  └─────────┼────────────────┼───────────────────┼────────────┘  │
│            │                │                   │               │
└────────────┼────────────────┼───────────────────┼───────────────┘
             │ REST           │ WebSocket         │ OAuth
             ▼                ▼                   ▼
┌────────────────────────────────────────────────────────────────┐
│            colearner-platform (NestJS 11)                       │
│  ┌──────────┐  ┌───────────┐  ┌──────────┐  ┌──────────────┐  │
│  │ REST API │  │ WebSocket │  │ BullMQ   │  │ Prisma ORM   │  │
│  │          │  │ Gateway   │  │ Daemon   │  │ (PostgreSQL) │  │
│  └──────────┘  └───────────┘  └──────────┘  └──────────────┘  │
│                                     │                          │
│                                     ▼                          │
│                          ┌──────────────────┐                  │
│                          │ colearner-ai     │                  │
│                          │ (FastAPI/Python) │                  │
│                          │ LangGraph agents │                  │
│                          └──────────────────┘                  │
└────────────────────────────────────────────────────────────────┘
```

## Rendering Strategy

| Route | Rendering | Reason |
|---|---|---|
| `/` (landing) | Static (SSG) | Marketing page, no user data |
| `/login`, `/signup` | Static + Client | Auth forms need client interactivity |
| `/dashboard` | Server Component | Load mastery data server-side, avoid fetch waterfall on 4G |
| `/dashboard/mastery` | Server Component + Suspense | Stream mastery ledger data progressively |
| `/dashboard/analytics` | Client Component | Recharts needs client-side rendering |
| `/recall/[sessionId]` | Client Component | Real-time WebSocket interaction, timer state |
| `/recall/summary` | Server Component | Fetch session results server-side |
| `/extract` | Client Component | Video URL input, progress polling |
| `/settings` | Server Component + Client Islands | Profile loads server-side, form edits are client |

## Route Groups

```
app/
├── (marketing)/            # Public routes — no auth required
│   ├── page.tsx            # Landing page (/)
│   ├── pricing/page.tsx    # Pricing page
│   └── layout.tsx          # Marketing layout (no sidebar)
│
├── (auth)/                 # Auth routes — redirect if already authenticated
│   ├── login/page.tsx
│   ├── signup/page.tsx
│   ├── callback/page.tsx   # OAuth callback handler
│   └── layout.tsx          # Minimal auth layout
│
├── (dashboard)/            # Protected routes — require authentication
│   ├── dashboard/
│   │   ├── page.tsx        # Main dashboard (overview, due items, streak)
│   │   ├── mastery/page.tsx    # Mastery ledger (all concepts + SM-2 state)
│   │   ├── analytics/page.tsx  # Charts: retention curves, topic heat maps
│   │   └── history/page.tsx    # Past recall sessions
│   ├── extract/page.tsx    # Video extraction page
│   ├── settings/
│   │   ├── page.tsx        # Profile settings
│   │   ├── billing/page.tsx    # Subscription management (Razorpay)
│   │   └── notifications/page.tsx
│   └── layout.tsx          # Dashboard layout (sidebar + topbar)
│
├── (recall)/               # Recall session flow — full screen, no sidebar
│   ├── recall/
│   │   ├── [sessionId]/page.tsx    # Active recall session
│   │   └── summary/[sessionId]/page.tsx  # Session summary
│   └── layout.tsx          # Recall layout (minimal chrome, focus mode)
│
├── api/                    # Route handlers
│   ├── auth/[...nextauth]/route.ts  # Auth.js catch-all
│   └── webhooks/
│       └── razorpay/route.ts        # Billing webhooks
│
├── layout.tsx              # Root layout (providers, fonts, analytics)
├── not-found.tsx           # 404 page
├── error.tsx               # Global error boundary
└── loading.tsx             # Global loading UI
```

## Data Flow Patterns

### Pattern 1: Server Component Data Fetch (Dashboard)
```
[Server Component] → fetch(API_URL/mastery, { headers: authHeaders })
                   → Render HTML on server
                   → Stream to client (Suspense boundary)
                   → No client-side JavaScript for data fetching
```

### Pattern 2: Client Mutation via Server Action (Recall Answer)
```
[Client Component] → calls Server Action: submitAnswer(questionId, answer)
[Server Action]    → POST to API_URL/recall/answer (server-to-server, no CORS)
                   → revalidatePath('/dashboard')
                   → Return result to client
```

### Pattern 3: Real-time WebSocket (Recall Session)
```
[Client Component] → Connect WebSocket to WS_URL/recall
                   → Send: { type: 'answer', questionId, answer }
                   → Receive: { type: 'judged', score, feedback, nextQuestion }
                   → Zustand store updates local state
                   → On session end: POST summary via Server Action
```

### Pattern 4: Optimistic Update (NCU Balance)
```
[React Query mutation] → Optimistic update Zustand store (instant UI feedback)
                       → POST to API
                       → On success: React Query cache invalidation
                       → On error: rollback Zustand store
```

## Middleware

```typescript
// middleware.ts — runs on Edge Runtime
// Handles: auth redirect, locale detection, rate limiting headers

export function middleware(request: NextRequest) {
  // 1. Check auth token in cookies
  // 2. Redirect unauthenticated users from /dashboard/* to /login
  // 3. Redirect authenticated users from /login to /dashboard
  // 4. Set x-user-locale header from Accept-Language (India: hi/en, Qatar: ar/en)
}

export const config = {
  matcher: ['/(dashboard|recall|extract|settings)/:path*', '/login', '/signup']
}
```

## Deployment Architecture

```
Vercel Edge Network
├── Mumbai PoP       ← India users (primary market)
├── Dubai PoP        ← Qatar/UAE users (secondary market)
└── Other PoPs       ← Global fallback

Build: Vercel auto-deploy on push to main
Preview: Vercel Preview URL per PR
Environment: Production (main), Staging (develop), Preview (PR branches)
```
