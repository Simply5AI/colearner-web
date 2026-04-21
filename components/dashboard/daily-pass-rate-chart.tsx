'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import type { DailyPassRate } from '@/lib/types'

interface DailyPassRateChartProps {
  data: DailyPassRate[]
}

function getBarColor(rate: number): string {
  if (rate >= 80) return '#16A34A'
  if (rate >= 60) return '#D97706'
  return '#DC2626'
}

export function DailyPassRateChart({ data }: DailyPassRateChartProps) {
  const chartData = data.map((d) => ({
    date: new Date(d.date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    }),
    passRate: d.passRate,
    attempts: d.attempts,
  }))

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="border-b border-border/50 px-[18px] py-3.5">
        <div className="text-[13px] font-bold text-foreground">
          📊 Daily Success Rate
        </div>
      </div>
      <div className="p-[18px]">
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chartData} barSize={16}>
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke="var(--color-border)"
            />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: 'var(--color-muted-foreground)' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: 'var(--color-muted-foreground)' }}
              axisLine={false}
              tickLine={false}
              domain={[0, 100]}
              tickFormatter={(v) => `${v}%`}
            />
            <Tooltip
              contentStyle={{
                fontSize: 11,
                borderRadius: 8,
                border: '1px solid var(--color-border)',
              }}
              formatter={(value) => [`${value}%`, 'Success Rate']}
            />
            <Bar dataKey="passRate" radius={[4, 4, 0, 0]}>
              {chartData.map((entry, index) => (
                <Cell key={index} fill={getBarColor(entry.passRate)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
