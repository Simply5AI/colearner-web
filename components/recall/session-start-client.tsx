'use client'

import { useState, useMemo, useCallback } from 'react'
import { SessionConfigPanel } from '@/components/recall/session-config-panel'
import { QueuePreviewV2 } from '@/components/recall/queue-preview-v2'
import type { QueueStats, QueueItem } from '@/lib/types'

interface SessionStartClientProps {
  stats: QueueStats
  items: QueueItem[]
  extractionId: string
  authHeaders: Record<string, string>
}

export function SessionStartClient({ stats, items, extractionId, authHeaders }: SessionStartClientProps) {
  // Initialize all items as selected
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(items.map((i) => i.questionId))
  )

  const handleToggle = useCallback((questionId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(questionId)) {
        next.delete(questionId)
      } else {
        next.add(questionId)
      }
      return next
    })
  }, [])

  const selectedCount = selectedIds.size

  return (
    <div className="space-y-6">
      <SessionConfigPanel
        stats={stats}
        extractionId={extractionId}
        authHeaders={authHeaders}
        selectedCount={selectedCount}
      />
      <QueuePreviewV2
        items={items}
        selectedIds={selectedIds}
        onToggle={handleToggle}
      />
    </div>
  )
}
