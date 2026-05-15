'use client'

import { useEffect, useState } from 'react'
import { Archive, Brain, CheckCircle2, Loader2, Save, Trash2 } from 'lucide-react'
import { useSession } from 'next-auth/react'
import { toast } from 'sonner'
import {
  archiveMemory,
  deleteMemory,
  getMemories,
  getMemoryDiff,
  markMemoryViewed,
  resolveMemory,
  updateMemory,
  type LearningMemory,
  type MemoryDiff,
} from '@/lib/api/memory'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'

export default function MemorySettingsPage() {
  const { data: session } = useSession()
  const [memories, setMemories] = useState<LearningMemory[]>([])
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [diff, setDiff] = useState<MemoryDiff | null>(null)

  useEffect(() => {
    const token = session?.accessToken
    if (!token) return

    setLoading(true)
    Promise.all([getMemories(token), getMemoryDiff(token).catch(() => null)])
      .then(([items, diffResult]) => {
        setMemories(items)
        setDrafts(Object.fromEntries(items.map((item) => [item.id, item.content])))
        setDiff(diffResult)
        if (diffResult && diffResult.counts.created + diffResult.counts.updated + diffResult.counts.resolved > 0) {
          markMemoryViewed(token).catch(() => null)
        }
      })
      .catch(() => toast.error('Could not load memory'))
      .finally(() => setLoading(false))
  }, [session?.accessToken])

  const token = session?.accessToken

  async function save(memory: LearningMemory) {
    if (!token) return
    setSavingId(memory.id)
    try {
      const updated = await updateMemory(token, memory.id, { content: drafts[memory.id] })
      setMemories((items) => items.map((item) => (item.id === updated.id ? updated : item)))
      toast.success('Memory updated')
    } catch {
      toast.error('Could not update memory')
    } finally {
      setSavingId(null)
    }
  }

  async function archive(memory: LearningMemory) {
    if (!token) return
    setSavingId(memory.id)
    try {
      const updated = await archiveMemory(token, memory.id)
      setMemories((items) => items.map((item) => (item.id === updated.id ? updated : item)))
      toast.success('Memory archived')
    } catch {
      toast.error('Could not archive memory')
    } finally {
      setSavingId(null)
    }
  }

  async function resolve(memory: LearningMemory) {
    if (!token) return
    setSavingId(memory.id)
    try {
      const updated = await resolveMemory(token, memory.id)
      setMemories((items) => items.map((item) => (item.id === updated.id ? updated : item)))
      toast.success('Marked as resolved — we’ll stop using it')
    } catch {
      toast.error('Could not resolve memory')
    } finally {
      setSavingId(null)
    }
  }

  async function remove(memory: LearningMemory) {
    if (!token) return
    setSavingId(memory.id)
    try {
      await deleteMemory(token, memory.id)
      setMemories((items) => items.filter((item) => item.id !== memory.id))
      toast.success('Memory deleted')
    } catch {
      toast.error('Could not delete memory')
    } finally {
      setSavingId(null)
    }
  }

  const diffTotal = diff
    ? diff.counts.created + diff.counts.updated + diff.counts.resolved
    : 0

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3">
        <Brain className="mt-1 h-5 w-5 text-muted-foreground" />
        <div>
          <h2 className="text-lg font-semibold">Memory</h2>
          <p className="text-sm text-muted-foreground">
            Review what CoLearner uses to personalize tutoring and capture recall.
          </p>
        </div>
      </div>

      {diff && diffTotal > 0 ? (
        <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
          <span className="font-medium">Since you last looked: </span>
          <span className="text-muted-foreground">
            {diff.counts.created} new, {diff.counts.updated} updated, {diff.counts.resolved} resolved.
          </span>
        </div>
      ) : null}

      {loading ? (
        <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading memory
        </div>
      ) : memories.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
          CoLearner has not saved any learner memory yet.
        </div>
      ) : (
        <div className="space-y-3">
          {memories.map((memory) => {
            const isWeakness = memory.type === 'WEAKNESS' || memory.type === 'MISTAKE'
            const isResolved = memory.status === 'RESOLVED'
            return (
              <section
                key={memory.id}
                className={`rounded-lg border p-4 ${isResolved ? 'border-dashed bg-muted/20' : 'border-border'}`}
              >
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{memory.type.replaceAll('_', ' ')}</Badge>
                  <Badge variant={memory.status === 'NEEDS_REVIEW' ? 'destructive' : 'outline'}>
                    {memory.status.replaceAll('_', ' ')}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    Confidence {Math.round(memory.confidence * 100)}%
                  </span>
                </div>
                <Textarea
                  value={drafts[memory.id] ?? memory.content}
                  onChange={(event) =>
                    setDrafts((current) => ({ ...current, [memory.id]: event.target.value }))
                  }
                  className="min-h-24"
                  disabled={isResolved}
                />
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    onClick={() => save(memory)}
                    disabled={savingId === memory.id || isResolved}
                  >
                    {savingId === memory.id ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="mr-2 h-4 w-4" />
                    )}
                    Save
                  </Button>
                  {isWeakness && !isResolved ? (
                    <Button size="sm" variant="outline" onClick={() => resolve(memory)}>
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Mark resolved
                    </Button>
                  ) : null}
                  <Button size="sm" variant="outline" onClick={() => archive(memory)} disabled={isResolved}>
                    <Archive className="mr-2 h-4 w-4" />
                    Archive
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => remove(memory)}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </Button>
                </div>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
