# Testing Strategy — CoLearner Web

## Testing Pyramid

```
         ┌───────────┐
         │   E2E     │  Playwright — 5-10 critical user flows
         │  (few)    │  Covers: login → extract → recall → summary
         ├───────────┤
         │Integration│  React Testing Library — component + hook tests
         │ (moderate)│  Covers: form submissions, data display, error states
         ├───────────┤
         │   Unit    │  Vitest — pure functions, utils, validators
         │  (many)   │  Covers: Zod schemas, formatters, helpers, store logic
         └───────────┘
```

## Tool Stack

| Layer | Tool | Config File |
|---|---|---|
| Unit tests | Vitest | `vitest.config.ts` |
| Component tests | React Testing Library + Vitest | `vitest.config.ts` |
| E2E tests | Playwright | `playwright.config.ts` |
| Coverage | Vitest c8/istanbul | Built into Vitest |

## Directory Structure

```
tests/
├── unit/                    # Pure logic tests
│   ├── validators/          # Zod schema validation tests
│   ├── utils/               # Utility function tests
│   └── stores/              # Zustand store logic tests
├── integration/             # Component rendering + interaction tests
│   ├── dashboard/           # Dashboard component tests
│   ├── recall/              # Recall session component tests
│   ├── extraction/          # Extraction UI tests
│   └── auth/                # Auth flow tests
└── e2e/                     # Full browser E2E tests
    ├── auth.spec.ts         # Login/signup/logout flows
    ├── extraction.spec.ts   # Video extraction happy path
    ├── recall.spec.ts       # Full recall session flow
    ├── dashboard.spec.ts    # Dashboard navigation + data display
    └── billing.spec.ts      # Subscription upgrade flow
```

## Vitest Configuration

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/unit/**/*.test.ts', 'tests/integration/**/*.test.tsx'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'tests/',
        '**/*.d.ts',
        'components/ui/**',  // shadcn/ui — already tested upstream
      ],
      thresholds: {
        statements: 80,
        branches: 75,
        functions: 80,
        lines: 80,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
})
```

## Test Setup

```typescript
// tests/setup.ts
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

// Auto cleanup after each test
afterEach(() => {
  cleanup()
})

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    refresh: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/',
}))

// Mock environment variables
process.env.NEXT_PUBLIC_API_URL = 'http://localhost:3000'
process.env.NEXT_PUBLIC_WS_URL = 'ws://localhost:3000'
```

## Unit Test Examples

```typescript
// tests/unit/validators/extraction.test.ts
import { describe, it, expect } from 'vitest'
import { extractionSchema } from '@/lib/validators/extraction'

describe('extractionSchema', () => {
  it('accepts valid YouTube URL', () => {
    const result = extractionSchema.safeParse({
      videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    })
    expect(result.success).toBe(true)
  })

  it('rejects non-URL string', () => {
    const result = extractionSchema.safeParse({
      videoUrl: 'not a url',
    })
    expect(result.success).toBe(false)
  })

  it('rejects empty string', () => {
    const result = extractionSchema.safeParse({
      videoUrl: '',
    })
    expect(result.success).toBe(false)
  })
})
```

```typescript
// tests/unit/stores/recall-store.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { useRecallStore } from '@/lib/stores/recall-store'

describe('recallStore', () => {
  beforeEach(() => {
    useRecallStore.getState().reset()
  })

  it('starts a session correctly', () => {
    useRecallStore.getState().startSession('session-1', 10)

    const state = useRecallStore.getState()
    expect(state.sessionId).toBe('session-1')
    expect(state.totalQuestions).toBe(10)
    expect(state.questionIndex).toBe(0)
    expect(state.isComplete).toBe(false)
  })

  it('increments question index on setQuestion', () => {
    useRecallStore.getState().startSession('session-1', 10)
    useRecallStore.getState().setQuestion({ id: 'q1', text: 'What is X?', type: 'open' } as Question)

    expect(useRecallStore.getState().questionIndex).toBe(1)
  })

  it('resets all state on reset()', () => {
    useRecallStore.getState().startSession('session-1', 10)
    useRecallStore.getState().reset()

    const state = useRecallStore.getState()
    expect(state.sessionId).toBeNull()
    expect(state.totalQuestions).toBe(0)
  })
})
```

## Integration Test Examples

```typescript
// tests/integration/dashboard/due-items.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { DueItemsList } from '@/components/dashboard/DueItemsList'

// Mock API
vi.mock('@/lib/api/client', () => ({
  apiClient: vi.fn().mockResolvedValue([
    { id: '1', title: 'Photosynthesis', dueDate: new Date().toISOString(), masteryState: 'review' },
    { id: '2', title: 'Cell Division', dueDate: new Date().toISOString(), masteryState: 'learning' },
  ]),
}))

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe('DueItemsList', () => {
  it('renders due items from API', async () => {
    render(<DueItemsList />, { wrapper: createWrapper() })

    expect(await screen.findByText('Photosynthesis')).toBeInTheDocument()
    expect(await screen.findByText('Cell Division')).toBeInTheDocument()
  })

  it('shows empty state when no items are due', async () => {
    vi.mocked(apiClient).mockResolvedValueOnce([])
    render(<DueItemsList />, { wrapper: createWrapper() })

    expect(await screen.findByText(/no items due/i)).toBeInTheDocument()
  })
})
```

## Playwright E2E Configuration

```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['html', { open: 'never' }]],

  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 5'] } },
  ],

  webServer: {
    command: 'pnpm dev',
    port: 3000,
    reuseExistingServer: !process.env.CI,
  },
})
```

## E2E Test Example

```typescript
// tests/e2e/recall.spec.ts
import { test, expect } from '@playwright/test'

test.describe('Recall Session', () => {
  test.beforeEach(async ({ page }) => {
    // Login helper
    await page.goto('/login')
    await page.fill('[name="email"]', 'test@example.com')
    await page.fill('[name="password"]', 'testpassword')
    await page.click('button[type="submit"]')
    await page.waitForURL('/dashboard')
  })

  test('completes a full recall session', async ({ page }) => {
    // Start session
    await page.click('text=Start Recall')
    await expect(page.locator('[data-testid="question-card"]')).toBeVisible()

    // Answer a question
    await page.fill('[data-testid="answer-input"]', 'My answer')
    await page.click('text=Submit Answer')

    // Check feedback appears
    await expect(page.locator('[data-testid="answer-feedback"]')).toBeVisible()

    // Continue to next question
    await page.click('text=Next Question')
  })
})
```

## CI Pipeline

```yaml
# .github/workflows/test.yml
name: Test
on: [push, pull_request]

jobs:
  unit-integration:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: pnpm install --frozen-lockfile
      - run: pnpm type-check
      - run: pnpm lint
      - run: pnpm test --coverage

  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: pnpm install --frozen-lockfile
      - run: pnpm exec playwright install --with-deps
      - run: pnpm test:e2e
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: playwright-report/
```

## Coverage Targets

| Area | Target | Rationale |
|---|---|---|
| Zod validators | 100% | Shared with backend — bugs here cause API mismatches |
| Zustand stores | 95% | Core business logic — recall flow, NCU calculations |
| Utility functions | 90% | Pure functions, easy to test |
| Components | 80% | Focus on interaction logic, not layout |
| E2E flows | 5 critical paths | Login, extract, recall, dashboard, billing |

## Naming Conventions

- Unit tests: `*.test.ts`
- Component tests: `*.test.tsx`
- E2E tests: `*.spec.ts`
- Test data factories: `tests/factories/*.ts`
- Test helpers: `tests/helpers/*.ts`
