'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Archive,
  Brain,
  CheckCircle2,
  History,
  Loader2,
  Save,
  Sparkles,
  Target,
  Trash2,
} from 'lucide-react'
import { useSession } from 'next-auth/react'
import { toast } from 'sonner'
import {
  archiveMemory,
  deleteMemory,
  getLearningProfile,
  getMemories,
  getMemoryDiff,
  markMemoryViewed,
  resolveMemory,
  updateMemory,
  type LearnerConceptLevel,
  type LearningMemory,
  type LearningProfileDashboard,
  type LearningProfileInsight,
  type MemoryDiff,
} from '@/lib/api/memory'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'

const emptyProfile: LearningProfileDashboard = {
  learnerBrief: 'CoLearner is still building this learner profile from captures, recall, and tutor activity.',
  stats: { activeMemories: 0, weakAreas: 0, strengths: 0, reviewedConcepts: 0 },
  profile: [],
  preferences: [],
  weakAreas: [],
  strengths: [],
  conceptLevels: [],
  recentEvidence: [],
  usage: [],
  rawMemoryCount: 0,
}

export default function MemorySettingsPage() {
  const { data: session } = useSession()
  const [profile, setProfile] = useState<LearningProfileDashboard>(emptyProfile)
  const [memories, setMemories] = useState<LearningMemory[]>([])
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [diff, setDiff] = useState<MemoryDiff | null>(null)

  useEffect(() => {
    const token = session?.accessToken
    if (!token) return

    setLoading(true)
    Promise.all([
      getLearningProfile(token),
      getMemories(token),
      getMemoryDiff(token).catch(() => null),
    ])
      .then(([profileResult, items, diffResult]) => {
        setProfile(profileResult)
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
  const diffTotal = diff
    ? diff.counts.created + diff.counts.updated + diff.counts.resolved
    : 0
  const hasProfile = profile.rawMemoryCount > 0 || profile.conceptLevels.length > 0

  async function refreshProfile(accessToken: string) {
    const updatedProfile = await getLearningProfile(accessToken)
    setProfile(updatedProfile)
  }

  async function save(memory: LearningMemory) {
    if (!token) return
    setSavingId(memory.id)
    try {
      const updated = await updateMemory(token, memory.id, { content: drafts[memory.id] })
      setMemories((items) => items.map((item) => (item.id === updated.id ? updated : item)))
      await refreshProfile(token)
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
      await refreshProfile(token)
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
      await refreshProfile(token)
      toast.success("Marked as resolved. We'll stop using it.")
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
      await refreshProfile(token)
      toast.success('Memory deleted')
    } catch {
      toast.error('Could not delete memory')
    } finally {
      setSavingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <Brain className="mt-1 h-5 w-5 text-muted-foreground" />
        <div>
          <h2 className="text-lg font-semibold">Memory</h2>
          <p className="text-sm text-muted-foreground">
            See how CoLearner personalizes tutoring, recall, and practice.
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
      ) : !hasProfile ? (
        <div className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
          CoLearner has not built a learner profile yet. Finish a capture, recall session, or questionnaire to start personalization.
        </div>
      ) : (
        <>
          <section className="grid gap-3 md:grid-cols-4">
            <StatTile label="Active memories" value={profile.stats.activeMemories} />
            <StatTile label="Weak areas" value={profile.stats.weakAreas} />
            <StatTile label="Strengths" value={profile.stats.strengths} />
            <StatTile label="Reviewed concepts" value={profile.stats.reviewedConcepts} />
          </section>

          <section className="rounded-lg border border-border p-4">
            <div className="mb-3 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <h3 className="font-semibold">Learner snapshot</h3>
            </div>
            <p className="whitespace-pre-line text-sm leading-6 text-muted-foreground">
              {profile.learnerBrief}
            </p>
          </section>

          <section className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
            <InsightSection
              title="Needs attention"
              empty="No active weak areas yet."
              items={profile.weakAreas}
              tone="attention"
            />
            <ConceptSection title="Strengths and improving areas" items={profile.strengths} />
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <InsightSection title="Profile and goals" empty="No profile memories yet." items={[...profile.profile, ...profile.preferences]} />
            <ActivitySection profile={profile} />
          </section>

          <AdvancedMemoryReview
            memories={memories}
            drafts={drafts}
            savingId={savingId}
            onDraftChange={(id, value) => setDrafts((current) => ({ ...current, [id]: value }))}
            onSave={save}
            onResolve={resolve}
            onArchive={archive}
            onRemove={remove}
          />
        </>
      )}
    </div>
  )
}

function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border p-4">
      <div className="text-2xl font-semibold">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  )
}

function InsightSection({
  title,
  empty,
  items,
  tone,
}: {
  title: string
  empty: string
  items: LearningProfileInsight[]
  tone?: 'attention'
}) {
  return (
    <section className="rounded-lg border border-border p-4">
      <div className="mb-3 flex items-center gap-2">
        <Target className={`h-4 w-4 ${tone === 'attention' ? 'text-amber-700' : 'text-muted-foreground'}`} />
        <h3 className="font-semibold">{title}</h3>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <div className="space-y-3">
          {items.slice(0, 6).map((item) => (
            <div key={item.id} className="rounded-md border border-border bg-background p-3">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <h4 className="text-sm font-semibold">{item.title}</h4>
                <Badge variant={item.status === 'NEEDS_REVIEW' ? 'destructive' : 'outline'}>
                  {item.status.replaceAll('_', ' ')}
                </Badge>
              </div>
              <p className="text-sm leading-5 text-muted-foreground">{item.summary}</p>
              <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                <span>{item.evidenceCount} evidence {item.evidenceCount === 1 ? 'point' : 'points'}</span>
                <span>Confidence {Math.round(item.confidence * 100)}%</span>
                <span>Seen {formatDate(item.lastSeenAt)}</span>
                {item.lastUsedAt ? <span>Used {formatDate(item.lastUsedAt)}</span> : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function ConceptSection({ title, items }: { title: string; items: LearnerConceptLevel[] }) {
  return (
    <section className="rounded-lg border border-border p-4">
      <div className="mb-3 flex items-center gap-2">
        <CheckCircle2 className="h-4 w-4 text-emerald-700" />
        <h3 className="font-semibold">{title}</h3>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Strengths will appear after recall reviews build enough signal.</p>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.conceptId} className="rounded-md border border-border bg-background p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h4 className="text-sm font-semibold">{item.title}</h4>
                  <p className="text-xs text-muted-foreground">
                    {item.questionsReviewed} reviewed · ease {item.averageReviewEase.toFixed(2)}
                  </p>
                </div>
                <Badge variant="secondary">{levelLabel(item.level)}</Badge>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function ActivitySection({ profile }: { profile: LearningProfileDashboard }) {
  const evidence = useMemo(() => profile.recentEvidence.slice(0, 4), [profile.recentEvidence])

  return (
    <section className="rounded-lg border border-border p-4">
      <div className="mb-3 flex items-center gap-2">
        <History className="h-4 w-4 text-muted-foreground" />
        <h3 className="font-semibold">Personalization activity</h3>
      </div>
      {profile.usage.length > 0 ? (
        <div className="space-y-3">
          {profile.usage.slice(0, 5).map((item) => (
            <div key={item.id} className="text-sm">
              <div className="font-medium">{item.purpose}</div>
              <div className="line-clamp-2 text-muted-foreground">{item.content}</div>
              <div className="mt-1 text-xs text-muted-foreground">{formatDate(item.createdAt)}</div>
            </div>
          ))}
        </div>
      ) : evidence.length > 0 ? (
        <div className="space-y-3">
          {evidence.map((item) => (
            <div key={item.id} className="text-sm">
              <div className="font-medium">{item.title}</div>
              <div className="line-clamp-2 text-muted-foreground">{item.summary}</div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Usage will appear once Tutor or recall uses memory.</p>
      )}
    </section>
  )
}

function AdvancedMemoryReview({
  memories,
  drafts,
  savingId,
  onDraftChange,
  onSave,
  onResolve,
  onArchive,
  onRemove,
}: {
  memories: LearningMemory[]
  drafts: Record<string, string>
  savingId: string | null
  onDraftChange: (id: string, value: string) => void
  onSave: (memory: LearningMemory) => void
  onResolve: (memory: LearningMemory) => void
  onArchive: (memory: LearningMemory) => void
  onRemove: (memory: LearningMemory) => void
}) {
  return (
    <details className="rounded-lg border border-border p-4">
      <summary className="cursor-pointer text-sm font-semibold">
        Advanced: review raw memories ({memories.length})
      </summary>
      <div className="mt-4 space-y-3">
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
              <p className="whitespace-pre-line text-sm leading-5 text-muted-foreground">{memory.content}</p>
              <details className="mt-3">
                <summary className="cursor-pointer text-sm font-medium">Edit memory text</summary>
                <Textarea
                  value={drafts[memory.id] ?? memory.content}
                  onChange={(event) => onDraftChange(memory.id, event.target.value)}
                  className="mt-2 min-h-24"
                  disabled={isResolved}
                />
              </details>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" onClick={() => onSave(memory)} disabled={savingId === memory.id || isResolved}>
                  {savingId === memory.id ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  Save
                </Button>
                {isWeakness && !isResolved ? (
                  <Button size="sm" variant="outline" onClick={() => onResolve(memory)}>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Mark resolved
                  </Button>
                ) : null}
                <Button size="sm" variant="outline" onClick={() => onArchive(memory)} disabled={isResolved}>
                  <Archive className="mr-2 h-4 w-4" />
                  Archive
                </Button>
                <Button size="sm" variant="destructive" onClick={() => onRemove(memory)}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </Button>
              </div>
            </section>
          )
        })}
      </div>
    </details>
  )
}

function levelLabel(level: LearnerConceptLevel['level']) {
  if (level === 'needs_attention') return 'Needs attention'
  return level.charAt(0).toUpperCase() + level.slice(1)
}

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'recently'
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}
