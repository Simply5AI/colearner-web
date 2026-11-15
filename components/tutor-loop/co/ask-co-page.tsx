'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import {
  acceptTutorProposal,
  findTutorMaterial,
  addFoundTutorMaterial,
  deleteTutorSession,
  getTutorContext,
  listTutorSessions,
  type TutorCheckQuestion,
  type TutorMaterialProposalItem,
  type TutorObjectiveAnswer,
  type TutorProposalCard,
  type TutorSourceCitation,
} from '@/lib/api/tutor-loop/co'
import { getTutorWorkspaceScope, tutorLoopClient } from '@/lib/api/tutor-loop/client'
import { getTutorMemory, getTutorProfile, speakTutorText, updateTutorProfile } from '@/lib/api/tutor-loop/profile'
import { notesApi } from '@/lib/api/notes'
import {
  resolveReturnToTarget,
  type TutorContextDescriptor,
  type TutorMode,
  type TutorQuickActionMode,
} from '@/lib/tutor-loop/open-tutor'
import { TutorSessionTree } from './tutor-session-tree'
import { TutorExchange, type ReplyActions } from './tutor-reply'
import {
  BlockedState,
  CameFromBar,
  ExamAway,
  QuickActions,
  RestingBanner,
  SourceNotesPanel,
  TutorComposer,
} from './tutor-parts'
import { useTutorChat, type Exchange } from './use-tutor-chat'
import {
  buildTutorTreeGroups,
  coArtSrc,
  DEFAULT_PINNED_ACTIONS,
  modeDisplayLabel,
  newClientRequestId,
  replyPlainText,
  TUTOR_QUICK_ACTIONS,
  TUTOR_STYLE_LABEL,
  tutorActionHref,
  type TutorTreeTopicNode,
} from './tutor-types'

export interface AskCoPageProps {
  initialSessionId?: string | null
  initialContext: TutorContextDescriptor
  initialMode?: TutorMode | null
}

const ACTION_TEXT: Record<TutorQuickActionMode, (topic: string | null) => string> = {
  EXPLAIN: t => (t ? `Explain ${t}` : 'Explain a topic'),
  QUIZ: t => (t ? `Quiz me on ${t}` : 'Quiz me'),
  HOMEWORK: () => 'Help me work through a problem',
  BRIEF: t => (t ? `Prepare a brief on ${t}` : 'Prepare a brief'),
  CLARIFY: () => 'Help me clarify something',
  TODAY: () => 'What should I do today?',
}

export function AskCoPage({ initialSessionId = null, initialContext, initialMode = null }: AskCoPageProps) {
  const workspace = getTutorWorkspaceScope()
  const queryClient = useQueryClient()
  const { data: auth } = useSession()
  const firstName = auth?.user?.name?.trim().split(/\s+/)[0] ?? null

  const [treeOpen, setTreeOpen] = useState(false)
  const [panelOpen, setPanelOpen] = useState(false)
  const transcript = useRef<HTMLDivElement>(null)
  const followLatest = useRef(true)
  const [groupBy, setGroupBy] = useState<'SUBJECT' | 'PLAN'>('SUBJECT')
  const [search, setSearch] = useState('')
  const [topic, setTopic] = useState<TutorTreeTopicNode | null>(null)
  const [context, setContext] = useState<TutorContextDescriptor>(initialContext)
  const [citation, setCitation] = useState<TutorSourceCitation | null>(null)
  const [answered, setAnswered] = useState<Record<string, string>>({})
  const [pins, setPins] = useState<TutorQuickActionMode[] | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [status, setStatus] = useState('')
  const [find, setFind] = useState<{
    state: 'idle' | 'searching' | 'ready' | 'error' | 'upsell'
    proposals: TutorMaterialProposalItem[]
    added: Record<string, string>
    message?: string
  }>({ state: 'idle', proposals: [], added: {} })

  const entry = useQuery({
    queryKey: ['tutor-shell', 'entry', workspace],
    queryFn: () => tutorLoopClient.entry({ workspace }),
    retry: false,
    staleTime: 60_000,
  })
  const profile = useQuery({
    queryKey: ['tutor-co', 'profile', workspace],
    queryFn: () => getTutorProfile({ workspace }),
    retry: false,
    staleTime: 60_000,
  })
  const ctx = useQuery({
    queryKey: ['tutor-co', 'context', workspace, JSON.stringify(context)],
    queryFn: () => getTutorContext(context),
    retry: false,
  })
  const sessions = useQuery({
    queryKey: ['tutor-co', 'sessions', workspace],
    queryFn: () => listTutorSessions({ limit: 50 }),
    retry: false,
  })
  const plans = useQuery({
    queryKey: ['tutor-co', 'plans', workspace],
    queryFn: () => tutorLoopClient.plans({}, { workspace }),
    retry: false,
    staleTime: 60_000,
  })
  const memory = useQuery({
    queryKey: ['tutor-co', 'memory', workspace],
    queryFn: () => getTutorMemory({ workspace }),
    enabled: panelOpen,
    retry: false,
  })

  const chat = useTutorChat({
    onSessionCreated: created => {
      void queryClient.invalidateQueries({ queryKey: ['tutor-co', 'sessions'] })
      if (typeof window !== 'undefined') {
        window.history.replaceState(null, '', `/learn/co/${encodeURIComponent(created.id)}`)
      }
    },
  })

  const adult = entry.data?.band === '18+'
  const coName = entry.data?.tutorIdentity?.name || profile.data?.name || 'Co'
  const coIcon = entry.data?.tutorIdentity?.icon ?? profile.data?.icon ?? 'SPROUT'
  const findState = entry.data?.capabilities.findMaterial ?? 'HIDDEN'
  const styleLabel = TUTOR_STYLE_LABEL[profile.data?.style ?? 'FRIENDLY'] ?? ''
  const pinned = pins ?? (profile.data?.pinnedActions?.length ? profile.data.pinnedActions : DEFAULT_PINNED_ACTIONS)
  const readAloud = !!profile.data?.accessibility.readAloud

  const ctxError = ctx.error as { code?: string; status?: number; message?: string } | null
  const examLocked = ctxError?.code === 'EXAM_CONDITIONS_ACTIVE'
  const notEnabled = ctxError?.code === 'TUTOR_NOT_ENABLED' || ctxError?.code === 'CONSENT_REQUIRED'
  const restingFromContext =
    ctxError?.code === 'TUTOR_RESTING' ||
    ctxError?.code === 'AI_UNAVAILABLE' ||
    ctx.data?.reasonCode === 'TUTOR_RESTING' ||
    ctx.data?.reasonCode === 'AI_UNAVAILABLE'
  const restingFromTurn = chat.exchanges.some(
    e => e.status === 'failed' && (e.reasonCode === 'TUTOR_RESTING' || e.reasonCode === 'AI_UNAVAILABLE'),
  )
  const resting = restingFromContext || restingFromTurn
  const dailyLimit = chat.exchanges.some(e => e.reasonCode === 'DAILY_TUTOR_LIMIT')
  const generalOff = (ctx.data?.groundingMode ?? 'MATERIAL_ONLY') === 'MATERIAL_ONLY'

  const groups = useMemo(
    () =>
      buildTutorTreeGroups({
        groupBy,
        plans: (plans.data?.items ?? []).map(p => ({
          id: p.id,
          title: p.title,
          ownership: p.ownership,
          phases: p.phases.map(ph => ({
            id: ph.id,
            title: ph.title,
            topics: ph.topics
              .filter(t => !t.archived)
              .map(t => ({
                id: t.id,
                title: t.title,
                subjectId: t.subjectId,
                subjectTitle: t.subjectTitle,
                state: t.state,
                materialIds: t.materialIds,
              })),
          })),
        })),
        sessions: sessions.data?.items ?? [],
        contextSubjectRef: ctx.data?.subjectRef,
        contextTopicRef: ctx.data?.topicRef,
        contextTopicTitle: ctx.data?.source?.title ?? null,
        searchQuery: search,
      }),
    [groupBy, plans.data, sessions.data, ctx.data, search],
  )

  const started = useRef(false)
  const startedSession = useRef(false)
  useEffect(() => {
    if (initialSessionId && !startedSession.current) {
      startedSession.current = true
      void chat.openSession(initialSessionId)
    }
  }, [initialSessionId, chat])

  const topicTitle = topic?.title ?? (ctx.data?.topicRef ? ctx.data.source?.title ?? null : null)
  const topicPlanId = topic?.planId ?? null
  const topicIdForContext = topic?.topicId ?? null
  const activeContext = useMemo<TutorContextDescriptor>(
    () =>
      topicPlanId && topicIdForContext
        ? { kind: 'PLAN_TOPIC', planId: topicPlanId, topicId: topicIdForContext }
        : context,
    [topicPlanId, topicIdForContext, context],
  )

  const runMode = useCallback(
    (mode: TutorMode, text?: string) => {
      chat.send({
        text: text ?? (ACTION_TEXT[mode as TutorQuickActionMode]?.(topicTitle) ?? modeDisplayLabel(mode)),
        mode,
        context: activeContext,
      })
    },
    [chat, topicTitle, activeContext],
  )

  // Auto-start only when a calling screen passed an explicit mode (W2/W4/W5 openTutor({mode})).
  useEffect(() => {
    if (started.current || initialSessionId || !initialMode || !ctx.data?.available) return
    started.current = true
    runMode(initialMode)
  }, [initialMode, initialSessionId, ctx.data, runMode])

  const savePins = async (next: TutorQuickActionMode[]) => {
    setPins(next)
    const base = profile.data
    if (!base) return
    try {
      const updated = await updateTutorProfile({ revision: base.revision, pinnedActions: next }, { workspace })
      queryClient.setQueryData(['tutor-co', 'profile', workspace], updated)
    } catch {
      setStatus('Could not save your pinned actions. They stay for this visit.')
    }
  }

  const setStyle = async (style: 'TO_THE_POINT' | 'DETAILED') => {
    const base = profile.data
    if (!base) return
    try {
      const updated = await updateTutorProfile({ revision: base.revision, style }, { workspace })
      queryClient.setQueryData(['tutor-co', 'profile', workspace], updated)
      setStatus(style === 'TO_THE_POINT' ? 'Okay, shorter answers from now on' : 'Okay, more detail from now on')
    } catch {
      setStatus('Could not change that right now.')
    }
  }

  const selectSession = (id: string, node: TutorTreeTopicNode) => {
    setTopic(node)
    setCitation(null)
    startedSession.current = true
    if (typeof window !== 'undefined') window.history.pushState(null, '', `/learn/co/${encodeURIComponent(id)}`)
    void chat.openSession(id)
  }
  const newSession = () => {
    followLatest.current = true
    if (!window.matchMedia?.('(min-width: 1024px)')?.matches) setTreeOpen(false)
    chat.reset()
    setTopic(null)
    setCitation(null)
    setContext({ kind: 'GLOBAL' })
    if (typeof window !== 'undefined') window.history.pushState(null, '', '/learn/co')
  }
  const removeSession = async (id: string) => {
    setDeleting(id)
    try {
      await deleteTutorSession(id)
      await queryClient.invalidateQueries({ queryKey: ['tutor-co', 'sessions'] })
      if (chat.sessionId === id) newSession()
    } catch {
      setStatus('Could not delete that session. Try again.')
    } finally {
      setDeleting(null)
    }
  }

  const actions: ReplyActions = {
    coName,
    coIcon,
    readAloud,
    answered,
    busy: chat.pending || resting,
    onOpenCitation: c => {
      setCitation(c)
      if (!window.matchMedia?.('(min-width: 1024px)')?.matches) setTreeOpen(false)
      setPanelOpen(true)
    },
    onAnswerCheck: (exchange: Exchange, question: TutorCheckQuestion, answer: TutorObjectiveAnswer, label: string) => {
      if (!exchange.turnId) return
      setAnswered(prev => ({ ...prev, [exchange.turnId!]: label }))
      chat.send({
        text: label,
        mode: 'QUIZ',
        checkResponse: { turnId: exchange.turnId, questionRef: question.questionRef, answer },
      })
    },
    onStillStuck: () => chat.send({ text: 'I still don’t get it', mode: 'EXPLAIN_DIFFERENTLY' }),
    onShorter: () => void setStyle('TO_THE_POINT'),
    onMoreDetail: () => void setStyle('DETAILED'),
    onNextHint: () => chat.send({ text: 'I need another hint', mode: 'HOMEWORK' }),
    onSpeak: text => {
      const spoken = speakTutorText(text)
      setStatus(spoken.spoken ? '' : 'Read aloud is not available on this device. The text is on screen.')
    },
    onRetry: e => void chat.retry(e.key),
    onCancel: e => void chat.cancel(e.key),
    onSave: async exchange => {
      if (!exchange.result) return
      const first = exchange.result.segments.find(s => s.source === 'MATERIAL')
      const materialId = first && first.source === 'MATERIAL' ? first.citation.materialId : null
      await notesApi.create({
        kind: 'CO_ANSWER',
        title: topicTitle ?? chat.session?.title ?? `${coName}’s answer`,
        body: replyPlainText(exchange.result),
        materialId: materialId ?? ctx.data?.source?.materialId ?? null,
      })
    },
    onAcceptProposal: async (proposal: TutorProposalCard) => {
      await acceptTutorProposal(proposal.id, newClientRequestId())
      if (typeof window !== 'undefined') window.location.assign(tutorActionHref(proposal.target))
    },
  }

  const runFind = async () => {
    const topicId = topic?.topicId ?? ctx.data?.topicRef
    if (!topicId) {
      setFind({ state: 'error', proposals: [], added: {}, message: 'Pick a topic first so I know what to look for.' })
      return
    }
    setFind({ state: 'searching', proposals: [], added: {} })
    try {
      const res = await findTutorMaterial({ clientRequestId: newClientRequestId(), topicId })
      setFind({ state: 'ready', proposals: res.items, added: {} })
    } catch (e) {
      setFind({
        state: (e as { code?: string }).code === 'FIND_MATERIAL_NOT_ENTITLED' ? 'upsell' : 'error',
        proposals: [],
        added: {},
        message: (e as { message?: string }).message,
      })
    }
  }
  const addFound = async (proposal: TutorMaterialProposalItem) => {
    try {
      const res = await addFoundTutorMaterial(proposal.id, newClientRequestId())
      setFind(f => ({ ...f, added: { ...f.added, [proposal.id]: res.materialId } }))
    } catch (e) {
      setFind(f => ({ ...f, message: (e as { message?: string }).message ?? 'Could not add that.' }))
    }
  }

  const resolvedReturn = resolveReturnToTarget(ctx.data?.returnTo ?? null, ctx.data?.source?.title ?? null)
  const returnTarget = resolvedReturn
    ? { href: resolvedReturn.href, label: `${resolvedReturn.categoryLabel} · ${resolvedReturn.detailLabel}` }
    : null
  useEffect(() => {
    const pane = transcript.current
    if (pane && followLatest.current) pane.scrollTop = pane.scrollHeight
  }, [chat.exchanges])

  const inSession = chat.sessionId !== null || chat.exchanges.length > 0
  const composerDisabled = resting || chat.pending || dailyLimit
  const examHref = ctx.data?.activeExamSessionId
    ? `/learn/practice/mock/${encodeURIComponent(ctx.data.activeExamSessionId)}`
    : '/learn/practice'

  if (examLocked) {
    return (
      <main className="min-h-[60vh]">
        <ExamAway coName={coName} coIcon={coIcon} href={examHref} />
      </main>
    )
  }
  if (notEnabled) {
    return (
      <main>
        <BlockedState
          title="Ask Co is not available here yet"
          body="Your learning space does not have the full-page tutor turned on."
          href="/learn"
          hrefLabel="Back to Learn"
        />
      </main>
    )
  }

  const placeholder = `Ask ${coName} anything`
  const footer = `${coName} is an AI tutor and can make mistakes${styleLabel ? ` · ${styleLabel}` : ''}${
    generalOff ? ' · Answers come from your material' : ''
  }`

  return (
    <div className="grid min-h-0 min-w-0 flex-1 grid-cols-[minmax(0,1fr)] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden lg:flex" data-testid="ask-co-page">
      {treeOpen && (
        <TutorSessionTree
          groups={groups}
          groupBy={groupBy}
          onGroupByChange={setGroupBy}
          searchQuery={search}
          onSearchQueryChange={setSearch}
          selectedTopicId={topic?.topicId ?? null}
          selectedSessionId={chat.sessionId}
          onSelectTopic={node => {
            followLatest.current = true
            chat.reset()
            setTopic(node)
            if (!window.matchMedia?.('(min-width: 1024px)')?.matches) setTreeOpen(false)
            if (typeof window !== 'undefined') window.history.pushState(null, '', '/learn/co')
          }}
          onSelectSession={(id, node) => {
            followLatest.current = true
            selectSession(id, node)
            if (!window.matchMedia?.('(min-width: 1024px)')?.matches) setTreeOpen(false)
          }}
          onNewSession={newSession}
          onDeleteSession={removeSession}
          deletingSessionId={deleting}
        />
      )}

      <div className="contents lg:flex lg:min-h-0 lg:min-w-0 lg:flex-1 lg:flex-col">
        <CameFromBar
          fromLabel={returnTarget?.label ?? null}
          fromHref={returnTarget?.href ?? null}
          onToggleTree={() => {
            if (!window.matchMedia?.('(min-width: 1024px)')?.matches) setPanelOpen(false)
            setTreeOpen(v => !v)
          }}
          treeOpen={treeOpen}
          onTogglePanel={() => {
            if (!window.matchMedia?.('(min-width: 1024px)')?.matches) setTreeOpen(false)
            setPanelOpen(v => !v)
          }}
          panelOpen={panelOpen}
          crumb={chat.session?.title ?? topicTitle ?? coName}
          coName={coName}
          coIcon={coIcon}
        />

        <div
          ref={transcript}
          onScroll={event => {
            const pane = event.currentTarget
            followLatest.current = pane.scrollHeight - pane.scrollTop - pane.clientHeight < 80
          }}
          className={`col-start-1 row-start-2 min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:py-6 ${treeOpen || panelOpen ? 'max-lg:invisible' : ''}`}
        >
          <div className="mx-auto flex max-w-3xl flex-col gap-5">
            {resting && <RestingBanner coName={coName} coIcon={coIcon} />}
            {dailyLimit && (
              <p role="status" className="rounded-2xl border border-border bg-card p-3 text-sm">
                {coName} has helped a lot today and is available again tomorrow. Your notes, library and practice still work.
              </p>
            )}
            {status && (
              <p role="status" className="text-sm text-muted-foreground">
                {status}
              </p>
            )}
            {ctx.isError && !resting && (
              <BlockedState
                title={`${coName} could not open this`}
                body={ctxError?.message ?? 'Something went wrong. Try again.'}
                onRetry={() => void ctx.refetch()}
              />
            )}
            {chat.loadError && (
              <BlockedState
                title="This session could not open"
                body={chat.loadError.message}
                onRetry={() => (chat.sessionId ? void chat.openSession(chat.sessionId) : undefined)}
                href="/learn/co"
                hrefLabel="Start a new session"
              />
            )}
            {chat.loading && (
              <p role="status" className="text-sm text-muted-foreground">
                Opening your session…
              </p>
            )}

            {!inSession && !chat.loading && !ctx.isError && !restingFromContext && (
              <StartView
                coName={coName}
                coIcon={coIcon}
                firstName={firstName}
                topic={topic}
                contextTitle={ctx.data?.source?.title ?? null}
                quote={ctx.data?.source?.quote ?? null}
                recap={ctx.data?.recap?.summary ?? null}
                loading={ctx.isPending}
                pinned={pinned}
                onRun={mode => runMode(mode)}
                onChangePins={next => void savePins(next)}
                disabled={composerDisabled}
              />
            )}

            {inSession && ctx.data?.source?.quote && (
              <div className="rounded-xl border border-border bg-muted/40 p-3 text-sm">
                <span className="block text-xs font-bold text-muted-foreground">
                  From {ctx.data.source.title}
                </span>
                {ctx.data.source.quote}
              </div>
            )}

            <div role="log" aria-live="polite" aria-label="Conversation" className="flex flex-col gap-5">
              {chat.exchanges.map(exchange => (
                <TutorExchange key={exchange.key} exchange={exchange} actions={actions} />
              ))}
            </div>

            <FindResults
              find={find}
              coName={coName}
              onAdd={addFound}
              onClose={() => setFind({ state: 'idle', proposals: [], added: {} })}
            />
          </div>
        </div>

        <TutorComposer
          coName={coName}
          placeholder={placeholder}
          maxLength={adult ? 1600 : 1000}
          disabled={composerDisabled}
          findMaterial={findState}
          footer={footer}
          pinned={pinned}
          showPinned={inSession}
          onRunPinned={mode => runMode(mode)}
          onSend={text => {
            followLatest.current = true
            chat.send({ text, mode: 'ASK', context: activeContext })
          }}
          onFind={() => void runFind()}
          onUpsell={() => setFind({ state: 'upsell', proposals: [], added: {} })}
        />
      </div>

      {panelOpen && (
        <SourceNotesPanel
          citation={citation}
          covered={chat.session?.title ?? (inSession ? 'This topic' : 'Nothing yet')}
          memory={memory.data ?? null}
          memoryError={memory.isError}
          adult={adult}
          coName={coName}
        />
      )}
    </div>
  )
}

function StartView({
  coName,
  coIcon,
  firstName,
  topic,
  contextTitle,
  quote,
  recap,
  loading,
  pinned,
  onRun,
  onChangePins,
  disabled,
}: {
  coName: string
  coIcon: 'BUDDY' | 'CLOUD' | 'SPARK' | 'SPROUT'
  firstName: string | null
  topic: TutorTreeTopicNode | null
  contextTitle: string | null
  quote: string | null
  recap: string | null
  loading: boolean
  pinned: TutorQuickActionMode[]
  onRun: (mode: TutorQuickActionMode) => void
  onChangePins: (next: TutorQuickActionMode[]) => void
  disabled: boolean
}) {
  const heading = topic?.title ?? contextTitle
  const suggested: TutorQuickActionMode = topic?.state === 'NOT_STARTED' || topic?.state === 'NONE' ? 'EXPLAIN' : 'QUIZ'
  return (
    <>
      {heading ? (
        <div className="flex flex-col gap-3">
          <div>
            {topic && <span className="text-xs font-bold text-muted-foreground">{topic.subjectTitle}</span>}
            <h1 className="text-2xl font-extrabold">{heading}</h1>
          </div>
          {quote && <blockquote className="border-s-2 border-primary ps-3 text-sm">{quote}</blockquote>}
          {topic && (
            <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-4">
              <img src={coArtSrc(coIcon, 'speaking')} alt="" width={48} height={48} />
              <div className="flex min-w-0 flex-1 flex-col">
                <b>
                  {suggested === 'EXPLAIN'
                    ? 'Start with a short explanation, then one check question.'
                    : 'A quick quiz on this topic.'}
                </b>
                <span className="text-xs text-muted-foreground">
                  {topic.state === 'NOT_STARTED' || topic.state === 'NONE'
                    ? 'It’s next in your plan'
                    : 'Part of your plan'}
                </span>
              </div>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onRun(suggested)}
                className="ds-button ds-button-primary"
              >
                Start
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <img src={coArtSrc(coIcon, 'speaking')} alt="" width={64} height={64} />
          <div>
            <h1 className="text-2xl font-extrabold">
              Hi{firstName ? ` ${firstName}` : ''}, I’m {coName}
            </h1>
            <span className="text-sm text-muted-foreground">Ask me anything, or pick one of these.</span>
          </div>
        </div>
      )}
      {recap && (
        <div className="flex flex-col gap-1 rounded-2xl border border-border bg-card p-4 text-sm">
          <span className="text-xs font-bold text-muted-foreground">Last time</span>
          <b>{recap}</b>
        </div>
      )}
      {loading && (
        <p role="status" className="text-sm text-muted-foreground">
          Getting things ready…
        </p>
      )}
      <QuickActions pinned={pinned} onRun={onRun} onChangePins={onChangePins} disabled={disabled} />
    </>
  )
}

function FindResults({
  find,
  coName,
  onAdd,
  onClose,
}: {
  find: {
    state: 'idle' | 'searching' | 'ready' | 'error' | 'upsell'
    proposals: TutorMaterialProposalItem[]
    added: Record<string, string>
    message?: string
  }
  coName: string
  onAdd: (p: TutorMaterialProposalItem) => void
  onClose: () => void
}) {
  if (find.state === 'idle') return null
  if (find.state === 'searching') return <p role="status" className="text-sm">{coName} is looking…</p>
  if (find.state === 'upsell') {
    return (
      <section aria-label="Plus" className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4">
        <span className="text-xs font-extrabold text-primary">Plus</span>
        <b>{coName} can find trusted material and add it to your library.</b>
        <span className="text-sm text-muted-foreground">You can always upload your own for free.</span>
        <div className="flex gap-2">
          <Link href="/learn/me" className="ds-button ds-button-primary">See plans</Link>
          <button type="button" onClick={onClose} className="ds-button ds-button-secondary">Not now</button>
        </div>
      </section>
    )
  }
  if (find.state === 'error') {
    return (
      <p role="alert" className="text-sm">
        {find.message ?? 'Finding material is not available right now. You can still upload your own.'}{' '}
        <button type="button" onClick={onClose} className="font-bold underline">Dismiss</button>
      </p>
    )
  }
  return (
    <section aria-label="Material I found" className="flex flex-col gap-2">
      <b className="text-sm">I found {find.proposals.length} source{find.proposals.length === 1 ? '' : 's'}. Add them?</b>
      {find.proposals.map(p => (
        <div key={p.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
          <span className="flex min-w-0 flex-1 flex-col">
            <b className="truncate text-sm">{p.title}</b>
            <span className="text-xs text-muted-foreground">From {p.publisher} · {p.host}</span>
          </span>
          {find.added[p.id] ? (
            <Link href={`/learn/library/${encodeURIComponent(find.added[p.id]!)}`} className="ds-button ds-button-secondary">
              Added · Open
            </Link>
          ) : (
            <button type="button" onClick={() => onAdd(p)} className="ds-button ds-button-primary">
              Add to library
            </button>
          )}
        </div>
      ))}
      {find.message && <p role="alert" className="text-xs">{find.message}</p>}
    </section>
  )
}

export { TUTOR_QUICK_ACTIONS }
