# CLAUDE.md — CoLearner Web Application

> This file is the master context for Claude Code sessions on the `colearner-web` repository.
> Claude Code reads this automatically. Do NOT delete.

## Task Management (READ FIRST)

Tasks are tracked in **two places** — always keep both in sync:

1. **GitHub Issues** (source of truth): `https://github.com/Simply5AI/colearner-web/issues`
   - Labels: `super-admin`, `teacher-role`, `frontend`, `blocked`, `in-progress`, `done-code`
   - When starting a task: add `in-progress` label
   - When code is done: add `done-code` label + comment with what was built

2. **Status Tracker**: `../tasks/TASK-STATUS-TRACKER.md` — quick reference for all task statuses

3. **Task Specs**: `../tasks/TASK-XX-*.md` — full requirements for each task

### Done criteria
- `pnpm type-check` passes
- GitHub issue updated with `done-code` label
- `TASK-STATUS-TRACKER.md` updated

### Backend dependency
This repo depends on `Simply5AI/colearner-platform`. Backend issues are tracked there. Frontend issues reference their backend counterparts in cross-repo links.

## Project Identity

- **Product**: CoLearner — AI-powered adaptive learning platform
- **Brand**: simply5ai
- **Repo**: `colearner-web` (GitHub: Simply5AI/colearner-web)
- **Role**: Primary SaaS web application — student dashboard, recall sessions, mastery analytics, settings
- **Markets**: India & Qatar

## Tech Stack

| Concern | Technology | Version |
|---|---|---|
| Framework | Next.js (App Router) | 15 |
| Language | TypeScript (strict mode) | 5.x |
| React | React with Server Components | 19 |
| Styling | Tailwind CSS + shadcn/ui | 4 |
| State (client) | Zustand | latest |
| State (server) | TanStack React Query | latest |
| Forms | React Hook Form + Zod | latest |
| Animation | Framer Motion | latest |
| Charts | Recharts | latest |
| Auth | Auth.js v5 (NextAuth) | 5 |
| Testing | Vitest + React Testing Library + Playwright | latest |
| Deployment | Vercel (Edge: Mumbai + Dubai PoPs) | — |

## Repository Structure

```
colearner-web/
├── app/                    # Next.js App Router pages
│   ├── (auth)/             # Auth group: login, signup, callback
│   ├── (dashboard)/        # Protected routes: dashboard, mastery, settings
│   ├── (recall)/           # Recall session flow: start, question, summary
│   ├── api/                # Route handlers (auth callbacks, webhooks)
│   ├── layout.tsx          # Root layout with providers
│   └── page.tsx            # Landing page
├── components/
│   ├── ui/                 # shadcn/ui base components
│   ├── dashboard/          # Dashboard-specific components
│   ├── recall/             # Recall session components
│   ├── extraction/         # Video extraction UI
│   └── shared/             # Cross-cutting components (nav, footer, error)
├── lib/
│   ├── api/                # API client (typed fetch wrapper for colearner-platform)
│   ├── auth/               # Auth.js configuration
│   ├── stores/             # Zustand stores
│   ├── hooks/              # Custom React hooks
│   ├── utils/              # Utility functions
│   └── validators/         # Zod schemas (shared with backend DTOs)
├── public/                 # Static assets
├── styles/                 # Global CSS, Tailwind config
├── tests/
│   ├── unit/               # Vitest unit tests
│   ├── integration/        # React Testing Library tests
│   └── e2e/                # Playwright E2E tests
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── vitest.config.ts
├── playwright.config.ts
└── .github/workflows/      # CI/CD
```

## Sibling Repositories

| Repo | Purpose | How Web Connects |
|---|---|---|
| `colearner-platform` | NestJS API, BullMQ daemon, shared packages | Web calls API via REST + WebSocket |
| `colearner-mobile` | React Native iOS/Android app | Shares @colearner/types package |
| `colearner-ai` | Python LangGraph agentic AI | Consumed via platform API proxy |

## Shared Packages (from GitHub Packages)

- `@colearner/types` — TypeScript interfaces + Zod schemas for all API contracts
- `@colearner/ui` — Design tokens (colors, spacing, typography) shared with mobile
- `@colearner/config` — Shared ESLint + TypeScript configs

**Install**: `pnpm add @colearner/types @colearner/ui @colearner/config`

## Key Architecture Decisions (LOCKED — do not deviate)

1. **Next.js App Router only** — no Pages Router, no `getServerSideProps`
2. **Server Components by default** — use `'use client'` only when state/interactivity is required
3. **Zustand for client state, React Query for server state** — never mix these responsibilities
4. **Zod schemas shared with backend** — validation logic is defined once in `@colearner/types`
5. **No raw content in DB** — SHA-256 hashes only. Never store raw transcripts or video URLs
6. **Auth.js v5 handles all consumer auth** — Google OAuth 2.0 primary, email/password secondary
7. **Tailwind CSS + shadcn/ui only** — no CSS modules, no styled-components, no Emotion
8. **TypeScript strict mode** — no `any`, no `@ts-ignore` without documented justification

## API Base URL

```
NEXT_PUBLIC_API_URL=https://api.colearner.app   # Production
NEXT_PUBLIC_API_URL=http://localhost:3000         # Development
```

All API calls go to `colearner-platform` NestJS backend. Auth tokens are JWT (15min access, 7d refresh). WebSocket connection for real-time recall session feedback.

## Environment Variables

```env
# Auth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=<generate-with-openssl>
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# API
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_WS_URL=ws://localhost:3000

# Analytics
NEXT_PUBLIC_POSTHOG_KEY=
NEXT_PUBLIC_SENTRY_DSN=

# Feature Flags
NEXT_PUBLIC_ENABLE_NCU=true
NEXT_PUBLIC_ENABLE_EXTRACTION=true
```

## Coding Conventions

- **File naming**: kebab-case for files (`mastery-ledger.tsx`), PascalCase for components (`MasteryLedger`)
- **Imports**: absolute imports via `@/` prefix (maps to project root)
- **Components**: functional components with arrow functions, typed with `interface` not `type`
- **Exports**: named exports for components, default export only for page routes
- **Error handling**: Error Boundaries at route level, try/catch in Server Actions
- **Commit style**: conventional commits (`feat:`, `fix:`, `chore:`, `docs:`)

## Commands

```bash
pnpm dev          # Start dev server (port 3000)
pnpm build        # Production build
pnpm start        # Start production server
pnpm lint         # ESLint check
pnpm test         # Run Vitest unit tests
pnpm test:e2e     # Run Playwright E2E tests
pnpm type-check   # TypeScript type checking
```

## Important: What NOT to Do

- Do NOT install Express or any custom server — Next.js handles routing
- Do NOT use `localStorage` for auth tokens — use HTTP-only cookies via Auth.js
- Do NOT make direct database calls from the web app — always go through the platform API
- Do NOT use `useEffect` for data fetching — use Server Components or React Query
- Do NOT create API routes for business logic — that belongs in colearner-platform
- Do NOT hardcode API URLs — always use environment variables
