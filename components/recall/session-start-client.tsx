'use client'

import { useState, useCallback, useMemo, useEffect } from 'react'
import { SessionConfigPanel } from '@/components/recall/session-config-panel'
import { ConceptGrid } from '@/components/recall/concept-grid'
import { TutorFAB } from '@/components/tutor/tutor-fab'
import { TutorDrawer } from '@/components/tutor/tutor-drawer'
import { useTutorStore } from '@/lib/stores/tutor-store'
import type { ConceptMastery } from '@/lib/types'

interface SessionStartClientProps {
  concepts: ConceptMastery[]
  extractionId: string
  extractionTitle: string
  authHeaders: Record<string, string>
}

export function SessionStartClient({
  concepts,
  extractionId,
  extractionTitle,
  authHeaders,
}: SessionStartClientProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(concepts.map((c) => c.conceptId)),
  )
  const setPinned = useTutorStore((s) => s.setPinned)

  const handleToggle = useCallback(
    (conceptId: string) => {
      setSelectedIds((prev) => {
        const next = new Set(prev)
        if (next.has(conceptId)) {
          next.delete(conceptId)
        } else {
          next.add(conceptId)
          setPinned(conceptId)
        }
        return next
      })
    },
    [setPinned],
  )

  const handleSelectAll = useCallback(() => {
    setSelectedIds(new Set(concepts.map((c) => c.conceptId)))
  }, [concepts])

  const handleDeselectAll = useCallback(() => {
    setSelectedIds(new Set())
  }, [])

  const selectedConceptIds = useMemo(() => Array.from(selectedIds), [selectedIds])

  const tutorConcepts = useMemo(
    () => concepts.map((c) => ({ id: c.conceptId, title: c.title })),
    [concepts],
  )

  useEffect(() => {
    return () => {
      useTutorStore.getState().close()
      useTutorStore.getState().setPinned(null)
    }
  }, [])

  return (
    <div className="space-y-6">
      <SessionConfigPanel
        extractionId={extractionId}
        authHeaders={authHeaders}
        selectedConceptIds={selectedConceptIds}
        conceptCount={concepts.length}
      />
      <ConceptGrid
        concepts={concepts}
        selectedIds={selectedIds}
        onToggle={handleToggle}
        onSelectAll={handleSelectAll}
        onDeselectAll={handleDeselectAll}
      />
      <TutorFAB />
      <TutorDrawer
        extractionId={extractionId}
        extractionTitle={extractionTitle}
        concepts={tutorConcepts}
      />
    </div>
  )
}
