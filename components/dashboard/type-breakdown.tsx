import { cn } from '@/lib/utils'
import type { TypeBreakdown as TypeBreakdownData } from '@/lib/types'

interface TypeBreakdownProps {
  data: TypeBreakdownData[] | null | undefined
}

const typeConfig: Record<string, { label: string; color: string; bgColor: string }> = {
  open: { label: 'Open Answer', color: 'bg-blue-600', bgColor: 'bg-blue-100' },
  FREE_TEXT: { label: 'Open Answer', color: 'bg-blue-600', bgColor: 'bg-blue-100' },
  mcq: { label: 'MCQ', color: 'bg-teal-600', bgColor: 'bg-teal-100' },
  MULTIPLE_CHOICE: { label: 'MCQ', color: 'bg-teal-600', bgColor: 'bg-teal-100' },
  cloze: { label: 'True / False', color: 'bg-purple-600', bgColor: 'bg-purple-100' },
  TRUE_FALSE: { label: 'True / False', color: 'bg-purple-600', bgColor: 'bg-purple-100' },
}

export function TypeBreakdown({ data }: TypeBreakdownProps) {
  const items = Array.isArray(data) ? data : []

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="border-b border-border/50 px-[18px] py-3.5">
        <div className="text-[13px] font-bold text-foreground">
          📋 Performance by Type
        </div>
      </div>
      <div className="space-y-4 p-[18px]">
        {items.map((item) => {
          const cfg = typeConfig[item.type] ?? { label: 'Unknown', color: 'bg-gray-600', bgColor: 'bg-gray-100' }
          return (
            <div key={item.type}>
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-xs font-semibold text-foreground">
                  {cfg.label}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {item.passRate}% · {item.attempts} attempts
                </span>
              </div>
              <div className={cn('h-2 overflow-hidden rounded-full', cfg.bgColor)}>
                <div
                  className={cn('h-full rounded-full transition-all', cfg.color)}
                  style={{ width: `${Math.min(100, item.passRate)}%` }}
                />
              </div>
            </div>
          )
        })}
        {items.length === 0 ? (
          <div className="text-xs text-muted-foreground">
            No type performance data available yet.
          </div>
        ) : null}
      </div>
    </div>
  )
}
