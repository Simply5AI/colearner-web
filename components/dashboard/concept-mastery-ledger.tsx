'use client'

import { useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { Download } from 'lucide-react'
import { cn } from '@/lib/utils'
import { exportMasteryCSV } from '@/lib/api/mastery'
import type { ConceptLedgerEntry } from '@/lib/types'

interface ConceptMasteryLedgerProps {
  data: ConceptLedgerEntry[]
  total: number
}

const statusBadge: Record<string, { label: string; className: string }> = {
  strong: { label: 'Strong', className: 'bg-green-50 text-green-700' },
  fair: { label: 'Fair', className: 'bg-amber-50 text-amber-700' },
  weak: { label: 'Weak', className: 'bg-red-50 text-red-700' },
}

export function ConceptMasteryLedger({
  data,
  total,
}: ConceptMasteryLedgerProps) {
  const { data: session } = useSession()

  const handleExport = useCallback(async () => {
    if (!session?.accessToken) return
    try {
      const blob = await exportMasteryCSV({
        Authorization: `Bearer ${session.accessToken}`,
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'mastery-ledger.csv'
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      // Export failed
    }
  }, [session?.accessToken])

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border/50 px-[18px] py-3.5">
        <div className="text-[13px] font-bold text-foreground">
          📖 Concept Mastery Ledger
          <span className="ml-2 text-[10px] font-normal text-muted-foreground">
            {total} concepts
          </span>
        </div>
        <button
          onClick={handleExport}
          className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1 text-[11px] font-semibold text-muted-foreground transition-colors hover:border-muted-foreground hover:text-foreground"
        >
          <Download className="h-3.5 w-3.5" />
          Export CSV
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border/50 bg-accent/30">
              <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Concept
              </th>
              <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Attempts
              </th>
              <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Pass Rate
              </th>
              <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Avg Score
              </th>
              <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                EF
              </th>
              <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Next Review
              </th>
              <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {data.map((entry) => {
              const badge = statusBadge[entry.status] ?? { label: 'Fair', className: 'bg-amber-50 text-amber-700' }
              return (
                <tr
                  key={entry.conceptId}
                  className="border-b border-border/30 transition-colors last:border-b-0 hover:bg-accent/50"
                >
                  <td className="max-w-[200px] truncate px-4 py-3 text-xs font-semibold text-foreground">
                    {entry.conceptTitle}
                  </td>
                  <td className="px-4 py-3 font-mono text-[11px] text-foreground">
                    {entry.attempts}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        'font-mono text-[11px] font-semibold',
                        entry.passRate >= 80
                          ? 'text-green-600'
                          : entry.passRate >= 60
                            ? 'text-warning'
                            : 'text-destructive'
                      )}
                    >
                      {entry.passRate}%
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-[11px] text-foreground">
                    {entry.avgScore.toFixed(1)}
                  </td>
                  <td className="px-4 py-3 font-mono text-[11px] text-muted-foreground">
                    {entry.easeFactor.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-[11px] text-muted-foreground">
                    {new Date(entry.nextReviewDate).toLocaleDateString(
                      'en-US',
                      { month: 'short', day: 'numeric' }
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        'rounded px-2 py-0.5 text-[10px] font-bold',
                        badge.className
                      )}
                    >
                      {badge.label}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
