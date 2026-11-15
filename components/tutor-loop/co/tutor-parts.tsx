'use client'

import Link from 'next/link'
import { useState, type FormEvent } from 'react'
import {
  ArrowLeft,
  BookOpen,
  CalendarDays,
  CircleHelp,
  Link2,
  MessageCircle,
  Pencil,
  Plus,
  ScrollText,
  Send,
  Sparkles,
  Upload,
  Lightbulb,
} from 'lucide-react'
import type { TutorFindMaterialState, TutorSourceCitation } from '@/lib/api/tutor-loop/co'
import type { TutorMemoryResponse } from '@/lib/api/tutor-loop/profile'
import type { TutorQuickActionMode } from '@/lib/tutor-loop/open-tutor'
import { coArtSrc, TUTOR_QUICK_ACTIONS } from './tutor-types'

type Icon = 'BUDDY' | 'CLOUD' | 'SPARK' | 'SPROUT'

const ACTION_ICONS: Record<TutorQuickActionMode, typeof Lightbulb> = {
  EXPLAIN: Lightbulb,
  QUIZ: CircleHelp,
  HOMEWORK: Pencil,
  BRIEF: ScrollText,
  CLARIFY: MessageCircle,
  TODAY: CalendarDays,
}

/* ---------- Quick actions ---------- */

export function QuickActions({
  pinned,
  onRun,
  onChangePins,
  disabled,
}: {
  pinned: TutorQuickActionMode[]
  onRun: (mode: TutorQuickActionMode) => void
  onChangePins: (next: TutorQuickActionMode[]) => void
  disabled?: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [notice, setNotice] = useState('')
  const ordered = [
    ...pinned.map(mode => TUTOR_QUICK_ACTIONS.find(a => a.mode === mode)!).filter(Boolean),
    ...(editing ? TUTOR_QUICK_ACTIONS.filter(a => !pinned.includes(a.mode)) : []),
  ]
  const move = (mode: TutorQuickActionMode, delta: number) => {
    const index = pinned.indexOf(mode)
    const target = index + delta
    if (index < 0 || target < 0 || target >= pinned.length) return
    const next = pinned.slice()
    next.splice(index, 1)
    next.splice(target, 0, mode)
    onChangePins(next)
  }
  const toggle = (mode: TutorQuickActionMode) => {
    if (pinned.includes(mode)) {
      setNotice('')
      onChangePins(pinned.filter(m => m !== mode))
    } else if (pinned.length >= 4) {
      setNotice('You can pin up to 4')
    } else {
      setNotice('')
      onChangePins([...pinned, mode])
    }
  }
  return (
    <section aria-label="Quick actions" className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <b>Quick actions</b>
        <button
          type="button"
          onClick={() => setEditing(v => !v)}
          className="text-sm font-bold text-primary underline"
        >
          {editing ? 'Done' : 'More actions'}
        </button>
      </div>
      {editing && (
        <p className="text-xs text-muted-foreground">Pin up to 4. Use the arrows to reorder.</p>
      )}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {ordered.map(action => {
          const Icon = ACTION_ICONS[action.mode]
          const isPinned = pinned.includes(action.mode)
          return (
            <div key={action.mode} className={`flex flex-col gap-1 ${editing && !isPinned ? 'opacity-70' : ''}`}>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onRun(action.mode)}
                className="flex min-h-[56px] items-center gap-3 rounded-2xl border border-border bg-card px-4 text-start font-bold hover:bg-muted/50"
              >
                <Icon size={18} aria-hidden="true" className="text-primary" />
                {action.label}
              </button>
              {editing && (
                <span className="flex items-center gap-2">
                  <button
                    type="button"
                    aria-pressed={isPinned}
                    onClick={() => toggle(action.mode)}
                    className="rounded-full border border-border px-2.5 py-1 text-xs font-bold"
                  >
                    {isPinned ? 'Pinned' : 'Pin'}
                  </button>
                  {isPinned && (
                    <>
                      <button
                        type="button"
                        aria-label={`Move ${action.label} earlier`}
                        onClick={() => move(action.mode, -1)}
                        className="rounded-full border border-border px-2 py-1 text-xs"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        aria-label={`Move ${action.label} later`}
                        onClick={() => move(action.mode, 1)}
                        className="rounded-full border border-border px-2 py-1 text-xs"
                      >
                        ↓
                      </button>
                    </>
                  )}
                </span>
              )}
            </div>
          )
        })}
      </div>
      <span role="status" className="text-xs text-muted-foreground">
        {notice}
      </span>
    </section>
  )
}

/* ---------- Came-from bar ---------- */

export function CameFromBar({
  fromLabel,
  fromHref,
  onToggleTree,
  treeOpen,
  onTogglePanel,
  panelOpen,
  crumb,
  coName,
  coIcon,
}: {
  fromLabel: string | null
  fromHref: string | null
  onToggleTree: () => void
  treeOpen: boolean
  onTogglePanel: () => void
  panelOpen: boolean
  crumb: string
  coName: string
  coIcon: Icon
}) {
  return (
    <div className="col-start-1 row-start-1 flex shrink-0 flex-wrap items-center gap-2 border-b border-border px-4 py-2.5">
      {fromLabel && fromHref ? (
        <>
          <span className="text-sm">
            You came from: <b>{fromLabel}</b>
          </span>
          <Link
            href={fromHref}
            className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-sm font-bold"
          >
            <ArrowLeft size={14} aria-hidden="true" className="rtl:rotate-180" /> Back to where I was
          </Link>
        </>
      ) : (
        <span className="flex items-center gap-2 text-sm font-bold">
          <img src={coArtSrc(coIcon, 'idle')} alt="" width={24} height={24} />
          {crumb || coName}
        </span>
      )}
      <span className="flex-1" />
      <button
        type="button"
        aria-pressed={treeOpen}
        onClick={onToggleTree}
        className={`rounded-full border border-border px-3 py-1 text-sm font-bold ${treeOpen ? 'bg-primary/15' : ''}`}
      >
        Topics
      </button>
      <button
        type="button"
        aria-pressed={panelOpen}
        onClick={onTogglePanel}
        className={`rounded-full border border-border px-3 py-1 text-sm font-bold ${panelOpen ? 'bg-primary/15' : ''}`}
      >
        Source and notes
      </button>
    </div>
  )
}

/* ---------- Composer with + menu ---------- */

export function TutorComposer({
  coName,
  placeholder,
  maxLength,
  disabled,
  findMaterial,
  footer,
  pinned,
  showPinned,
  onRunPinned,
  onSend,
  onFind,
  onUpsell,
}: {
  coName: string
  placeholder: string
  maxLength: number
  disabled: boolean
  findMaterial: TutorFindMaterialState
  footer: string
  pinned: TutorQuickActionMode[]
  showPinned: boolean
  onRunPinned: (mode: TutorQuickActionMode) => void
  onSend: (text: string) => void
  onFind: () => void
  onUpsell: () => void
}) {
  const [draft, setDraft] = useState('')
  const [menu, setMenu] = useState(false)
  const submit = (event: FormEvent) => {
    event.preventDefault()
    const text = draft.trim()
    if (!text || disabled) return
    onSend(text)
    setDraft('')
  }
  return (
    <div className="col-start-1 row-start-3 shrink-0 border-t border-border bg-background px-4 py-3">
      <div className="mx-auto flex max-w-3xl flex-col gap-2">
        {showPinned && (
          <div className="flex flex-wrap gap-2">
            {pinned.map(mode => {
              const action = TUTOR_QUICK_ACTIONS.find(a => a.mode === mode)!
              return (
                <button
                  key={mode}
                  type="button"
                  disabled={disabled}
                  onClick={() => onRunPinned(mode)}
                  className="rounded-full border border-border px-3 py-1.5 text-xs font-bold hover:bg-muted/60"
                >
                  {action.label}
                </button>
              )
            })}
          </div>
        )}
        {menu && (
          <div role="menu" aria-label="Add material" className="flex flex-col rounded-2xl border border-border bg-card p-1 shadow-md">
            <Link role="menuitem" href="/learn/import" className="flex min-h-[44px] items-center gap-3 rounded-xl px-3 hover:bg-muted/60">
              <Upload size={16} aria-hidden="true" /> Upload a file myself
            </Link>
            <Link role="menuitem" href="/learn/import" className="flex min-h-[44px] items-center gap-3 rounded-xl px-3 hover:bg-muted/60">
              <Link2 size={16} aria-hidden="true" /> Paste a link
            </Link>
            {findMaterial !== 'HIDDEN' && (
              <button
                type="button"
                role="menuitem"
                disabled={findMaterial === 'UNAVAILABLE'}
                onClick={() => {
                  setMenu(false)
                  if (findMaterial === 'LOCKED') onUpsell()
                  else onFind()
                }}
                className="flex min-h-[44px] items-center gap-3 rounded-xl px-3 text-start hover:bg-muted/60 disabled:opacity-60"
              >
                <Sparkles size={16} aria-hidden="true" />
                <span className="flex-1">
                  Ask {coName} to find material
                  {findMaterial === 'UNAVAILABLE' ? ' (not available right now)' : ''}
                </span>
                {findMaterial === 'LOCKED' && (
                  <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-extrabold text-primary">Plus</span>
                )}
              </button>
            )}
          </div>
        )}
        <form onSubmit={submit} className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Add material"
            aria-expanded={menu}
            onClick={() => setMenu(v => !v)}
            className="grid size-11 shrink-0 place-items-center rounded-full border border-border"
          >
            <Plus size={18} aria-hidden="true" />
          </button>
          <input
            value={draft}
            onChange={event => setDraft(event.target.value)}
            placeholder={placeholder}
            aria-label={`Message ${coName}`}
            maxLength={maxLength}
            disabled={disabled}
            className="ds-input min-h-[44px] min-w-0 flex-1"
          />
          <button
            type="submit"
            aria-label="Send"
            disabled={disabled || !draft.trim()}
            className="grid size-11 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground disabled:opacity-50"
          >
            <Send size={18} aria-hidden="true" className="rtl:-scale-x-100" />
          </button>
        </form>
        <p className="text-xs text-muted-foreground">{footer}</p>
      </div>
    </div>
  )
}

/* ---------- Source and notes panel ---------- */

export function SourceNotesPanel({
  citation,
  covered,
  memory,
  memoryError,
  adult,
  coName,
}: {
  citation: (TutorSourceCitation & { materialTitle?: string | null }) | null
  covered: string
  memory: TutorMemoryResponse | null
  memoryError: boolean
  adult: boolean
  coName: string
}) {
  const [tab, setTab] = useState<'source' | 'notes'>('source')
  return (
    <aside aria-label="Source and notes" className="col-start-1 row-start-2 z-10 flex min-h-0 w-full shrink-0 flex-col gap-3 overflow-y-auto overscroll-contain bg-background p-4 lg:w-[300px] lg:border-s lg:border-border">
      <div className="flex flex-col gap-1 text-sm">
        <b>This session</b>
        <span>
          <b>Covered:</b> {covered}
        </span>
      </div>
      <div role="tablist" className="flex border-b border-border">
        {(['source', 'notes'] as const).map(id => (
          <button
            key={id}
            role="tab"
            type="button"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`min-h-[40px] flex-1 border-b-2 text-sm font-bold ${
              tab === id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'
            }`}
          >
            {id === 'source' ? 'Source' : 'Notes about you'}
          </button>
        ))}
      </div>
      {tab === 'source' ? (
        citation ? (
          <div className="flex flex-col gap-2 text-sm">
            <b>{citation.label || citation.materialTitle || 'From your material'}</b>
            <blockquote className="border-s-2 border-primary ps-3">{citation.quote}</blockquote>
            {citation.materialId && (
              <Link
                href={`/learn/library/${encodeURIComponent(citation.materialId)}${
                  citation.passageRef ? `?passageRef=${encodeURIComponent(citation.passageRef)}` : ''
                }`}
                className="inline-flex items-center gap-1.5 font-bold text-primary underline"
              >
                <BookOpen size={14} aria-hidden="true" /> Open in reader
              </Link>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Choose a source link in {coName}’s answer to see the passage here.
          </p>
        )
      ) : memoryError ? (
        <p className="text-sm text-muted-foreground">Notes about you could not load right now.</p>
      ) : !memory || !memory.enabled ? (
        <div className="flex flex-col gap-2 text-sm">
          <p className="text-muted-foreground">{coName} is not keeping notes about you.</p>
          <Link href="/learn/me?section=notes" className="font-bold text-primary underline">
            Manage notes
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-2 text-sm">
          <p className="text-xs text-muted-foreground">
            {adult
              ? 'Only you can see these.'
              : memory.visibleToLinkedParent
                ? 'Your parent can see these notes. Your school cannot.'
                : 'Only you can see these.'}
          </p>
          {memory.facts.length === 0 && <p className="text-muted-foreground">Nothing yet.</p>}
          {memory.facts.map(fact => (
            <div key={fact.id} className="rounded-xl border border-border p-2.5">
              <span className="text-[11px] font-bold text-muted-foreground uppercase">{fact.kind}</span>
              <p>{fact.statement}</p>
            </div>
          ))}
          <Link href="/learn/me?section=notes" className="font-bold text-primary underline">
            Manage notes
          </Link>
        </div>
      )}
    </aside>
  )
}

/* ---------- Banner states ---------- */

export function RestingBanner({ coName, coIcon }: { coName: string; coIcon: Icon }) {
  return (
    <div role="status" className="flex items-center gap-3 rounded-2xl border border-border bg-muted/40 p-4">
      <img src={coArtSrc(coIcon, 'resting')} alt="" width={56} height={56} />
      <div className="flex flex-col">
        <b>{coName} is resting</b>
        <span className="text-sm text-muted-foreground">
          Back soon. Your sessions, library and practice still work.
        </span>
      </div>
    </div>
  )
}

export function ExamAway({
  coName,
  coIcon,
  href,
}: {
  coName: string
  coIcon: Icon
  href: string
}) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 p-8 text-center" data-testid="tutor-exam-away">
      <img src={coArtSrc(coIcon, 'resting')} alt="" width={96} height={96} />
      <h1 className="text-xl font-extrabold">{coName} is away during your exam</h1>
      <p className="text-sm text-muted-foreground">
        You can ask questions again as soon as you finish. Good luck.
      </p>
      <Link href={href} className="ds-button ds-button-primary">
        Back to my exam
      </Link>
    </div>
  )
}

export function BlockedState({
  title,
  body,
  onRetry,
  href,
  hrefLabel,
}: {
  title: string
  body: string
  onRetry?: () => void
  href?: string
  hrefLabel?: string
}) {
  return (
    <div role="alert" className="mx-auto flex max-w-md flex-col items-center gap-3 p-8 text-center">
      <h1 className="text-xl font-extrabold">{title}</h1>
      <p className="text-sm text-muted-foreground">{body}</p>
      <div className="flex gap-2">
        {onRetry && (
          <button type="button" onClick={onRetry} className="ds-button ds-button-primary">
            Try again
          </button>
        )}
        {href && (
          <Link href={href} className="ds-button ds-button-secondary">
            {hrefLabel ?? 'Go back'}
          </Link>
        )}
      </div>
    </div>
  )
}
