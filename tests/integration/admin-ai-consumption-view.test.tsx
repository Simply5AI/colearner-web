import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AiConsumptionView } from '@/components/admin/ai-consumption-view'
import type { ConsumptionReport } from '@/lib/api/admin'

const getLlmConsumption = vi.hoisted(() => vi.fn())
const getLlmConsumptionByUser = vi.hoisted(() => vi.fn())
const getLlmConsumptionByOrgBreakdown = vi.hoisted(() => vi.fn())
const getLlmConsumptionByModel = vi.hoisted(() => vi.fn())
const getLlmConsumptionByFeature = vi.hoisted(() => vi.fn())
const getLlmRateLimits = vi.hoisted(() => vi.fn())
const getLlmPricingMeta = vi.hoisted(() => vi.fn())

vi.mock('@/lib/api/admin', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api/admin')>()
  return {
    ...actual,
    getLlmConsumption,
    getLlmConsumptionByUser,
    getLlmConsumptionByOrgBreakdown,
    getLlmConsumptionByModel,
    getLlmConsumptionByFeature,
    getLlmRateLimits,
    getLlmPricingMeta,
  }
})

vi.mock('recharts', () => ({
  Area: () => null,
  AreaChart: ({ children }: { children?: React.ReactNode }) => <svg>{children}</svg>,
  CartesianGrid: () => null,
  ComposedChart: ({ children }: { children?: React.ReactNode }) => <svg>{children}</svg>,
  Legend: () => null,
  Line: () => null,
  ResponsiveContainer: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Tooltip: () => null,
  XAxis: () => null,
  YAxis: () => null,
}))

function makeReport(overrides: Partial<ConsumptionReport> = {}): ConsumptionReport {
  return {
    range: '30d',
    groupBy: 'agent',
    startDate: '2026-05-12',
    endDate: '2026-06-11',
    granularity: 'day',
    totals: {
      costUsd: 12.5,
      inputTokens: 1000,
      outputTokens: 500,
      cachedTokens: 0,
      calls: 25,
      avgCostPerCallUsd: 0.5,
      avgLatencyMs: 420,
      errorRate: 4,
    },
    series: [
      {
        date: '2026-06-10',
        costUsd: 8,
        inputTokens: 600,
        outputTokens: 300,
        calls: 15,
        byKey: { CAPTURE: 8 },
      },
    ],
    breakdown: [
      {
        key: 'CAPTURE',
        label: 'CAPTURE',
        costUsd: 8,
        inputTokens: 600,
        outputTokens: 300,
        cachedTokens: 0,
        calls: 15,
        pctOfTotal: 64,
      },
    ],
    ...overrides,
  }
}

describe('AiConsumptionView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getLlmConsumptionByUser.mockResolvedValue([
      { userId: 'u1', email: 'ada@example.com', tokens: 900, costUsd: 5, requests: 10, avgLatencyMs: 300 },
    ])
    getLlmConsumptionByOrgBreakdown.mockResolvedValue([
      { key: 'org-1', label: 'Acme', costUsd: 8, inputTokens: 600, outputTokens: 300, cachedTokens: 0, calls: 15, pctOfTotal: 100 },
    ])
    getLlmConsumptionByModel.mockResolvedValue([
      { provider: 'anthropic', model: 'claude-haiku', tokens: 900, costUsd: 8, requests: 15, avgLatencyMs: 410 },
    ])
    getLlmConsumptionByFeature.mockResolvedValue(makeReport().breakdown)
    getLlmRateLimits.mockResolvedValue({
      summary: { recentCalls: 25, totalCostUsd: 12.5, providers: ['anthropic'] },
      queue: { available: true, pending: 2, active: 1, failed: 0 },
      providerErrorRates: [{ provider: 'anthropic', last15m: 0, last1h: 2, last24h: 4 }],
      recentRetries: [],
      byProvider: [],
      note: '',
    })
    getLlmPricingMeta.mockResolvedValue({
      version: '2026-06-11',
      updatedAt: '2026-06-11',
      ageDays: 0,
      isStale: false,
      staleAfterDays: 30,
    })
  })

  it('renders KPI strip from initial report', () => {
    render(<AiConsumptionView initial={makeReport()} />)
    expect(screen.getByText('Total tokens')).toBeInTheDocument()
    expect(screen.getByText('1.5k')).toBeInTheDocument()
    expect(screen.getByText('420 ms')).toBeInTheDocument()
    expect(screen.getByText('4.00%')).toBeInTheDocument()
  })

  it('renders by-user drill-down links', () => {
    render(<AiConsumptionView initial={makeReport()} />)
    expect(screen.getByRole('link', { name: 'ada@example.com' })).toHaveAttribute('href', '/admin/users/u1')
  })

  it('refetches when range changes', async () => {
    const user = userEvent.setup()
    getLlmConsumption.mockResolvedValue(makeReport({ range: '7d' }))
    render(<AiConsumptionView initial={makeReport()} />)

    await user.click(screen.getByRole('tab', { name: '7 days' }))

    expect(getLlmConsumption).toHaveBeenCalled()
  })
})