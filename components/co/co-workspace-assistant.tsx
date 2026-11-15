'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Dialog } from '@base-ui/react/dialog'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { Send, X } from 'lucide-react'
import { Button, CoAvatar } from '@/components/design-system'
import { useLearnIdentity } from '@/components/learn/learn-common'
import { useMaterialIdentity } from '@/components/materials/material-identity'
import { materialApi } from '@/lib/api/materials'
import type { LearnBand } from '@/lib/api/learn'
import { AskCoPanel } from './co-panel'
import {
  answerWorkspaceQuestion,
  workspaceCoContext,
  workspaceHelp,
  workspaceTutorHref,
  type ScreenHelp,
} from './workspace-help'
import type { CoContextRef } from './co-types'

/** Header entry on every student shell, including selected-child sessions and small screens. */
export function CoWorkspaceAssistant({ band, pathname }: { band: LearnBand; pathname: string }) {
  const [open, setOpen] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  return (
    <>
      <button
        ref={trigger}
        type="button"
        aria-label="Ask Co"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className="flex min-h-[var(--ds-target,44px)] shrink-0 items-center gap-1.5 rounded-xl border border-primary/30 bg-primary/10 px-2.5 font-bold text-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
      >
        <CoAvatar band={band} size={band === 'kids' ? 40 : 28} />
        <span className="text-sm">Ask Co</span>
      </button>
      {open && (
        <WorkspaceAssistant
          key={pathname}
          band={band}
          pathname={pathname}
          onClose={() => {
            setOpen(false)
            trigger.current?.focus()
          }}
        />
      )}
    </>
  )
}

function WorkspaceAssistant({
  band,
  pathname,
  onClose,
}: {
  band: LearnBand
  pathname: string
  onClose: () => void
}) {
  const identity = useLearnIdentity()
  const materialActor = useMaterialIdentity()
  const actor = identity.band ? identity.actor : materialActor
  const [context, setContext] = useState<CoContextRef | null>(null)
  const current = workspaceCoContext(pathname)
  const tutorHref = workspaceTutorHref(pathname)
  const initial = workspaceHelp(pathname)
  const [messages, setMessages] = useState<Array<{ question: string; help: ScreenHelp }>>([])
  const [draft, setDraft] = useState('')
  const [selected, setSelected] = useState('')
  const latest = useRef<HTMLDivElement>(null)
  const materials = useQuery({
    queryKey: ['materials', actor, 'co-picker'],
    queryFn: () => materialApi.list({ status: 'ready' }),
    enabled: !!actor,
    retry: false,
    staleTime: 0,
    gcTime: 0,
  })
  useEffect(() => {
    latest.current?.scrollIntoView?.({ block: 'nearest' })
  }, [messages.length])
  const ask = (question: string) => {
    if (!question.trim()) return
    setMessages(rows =>
      [...rows, { question: question.trim(), help: answerWorkspaceQuestion(question, pathname) }].slice(
        -20,
      ),
    )
    setDraft('')
  }
  const submit = (event: FormEvent) => {
    event.preventDefault()
    ask(draft)
  }

  if (context)
    return (
      <AskCoPanel
        open
        onOpenChange={next => {
          if (!next) onClose()
        }}
        band={band}
        actor={actor}
        context={context}
      />
    )
  return (
    <Dialog.Root
      open
      onOpenChange={next => {
        if (!next) onClose()
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-[70] bg-foreground/25 backdrop-blur-[3px]" />
        <Dialog.Popup
          data-age-band={band}
          initialFocus={true}
          finalFocus={false}
          className="ds-age-scope fixed inset-y-0 end-0 z-[70] flex w-full flex-col border-s border-border bg-background text-foreground shadow-xl outline-none sm:w-[28rem] lg:w-[32rem]"
        >
          <header className="flex items-start gap-3 border-b border-border p-4">
            <CoAvatar band={band} size={48} />
            <div className="min-w-0 flex-1">
              <Dialog.Title className="text-xl font-extrabold">Ask Co</Dialog.Title>
              <Dialog.Description className="text-sm text-muted-foreground">
                Help with this screen and your learning.
              </Dialog.Description>
            </div>
            <Button variant="ghost" aria-label="Close Ask Co" onClick={onClose}>
              <X aria-hidden="true" />
            </Button>
          </header>
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
            <section aria-label="Screen help" className="space-y-3">
              <p className="text-xs font-bold uppercase tracking-wide text-primary">
                Screen help · built-in guidance
              </p>
              <HelpReply help={initial} onNavigate={onClose} />
              {messages.map((message, index) => (
                <div key={index} className="space-y-3">
                  <p className="ms-8 rounded-2xl bg-primary/10 p-3">{message.question}</p>
                  <HelpReply help={message.help} onNavigate={onClose} />
                </div>
              ))}
              <div ref={latest} />
              <div className="flex flex-wrap gap-2">
                {['What can I do here?', 'How do I add material?', 'How do I practise?'].map(
                  question => (
                    <Button key={question} variant="secondary" onClick={() => ask(question)}>
                      {question}
                    </Button>
                  ),
                )}
              </div>
            </section>
            <section aria-label="Learning chat" className="space-y-3 border-t border-border pt-4">
              <h2 className="font-bold">Chat about your learning</h2>
              <p className="text-sm text-muted-foreground">
                Co is an AI helper. Choose your lesson or a ready material for answers grounded in
                that source.
              </p>
              {(band === 'teens' || (band as string) === 'adults') && (
                <div>
                  <Link
                    href={tutorHref}
                    onClick={onClose}
                    className="ds-button ds-button-primary"
                  >
                    Open full-page tutor
                  </Link>
                </div>
              )}
              {current && (
                <Button onClick={() => setContext(current)}>
                  Ask about this {current.kind === 'LESSON' ? 'lesson' : 'material'}
                </Button>
              )}
              {materials.isPending && <p role="status">Finding your materials…</p>}
              {materials.error && (
                <div role="status">
                  <p>Your materials could not load.</p>
                  <Button variant="secondary" onClick={() => void materials.refetch()}>
                    Try again
                  </Button>
                </div>
              )}
              {materials.data && materials.data.items.length === 0 && (
                <p>You can add material to your library to start a learning chat.</p>
              )}
              {!!materials.data?.items.length && (
                <>
                  <label className="ds-field">
                    <span>Material to ask Co about</span>
                    <select
                      className="ds-input"
                      value={selected}
                      onChange={event => setSelected(event.target.value)}
                    >
                      <option value="">Choose a ready material</option>
                      {materials.data.items.map(item => (
                        <option key={item.id} value={item.id}>
                          {item.title}
                        </option>
                      ))}
                    </select>
                  </label>
                  <Button
                    disabled={!selected}
                    onClick={() => setContext({ kind: 'MATERIAL', materialId: selected })}
                  >
                    Start learning chat
                  </Button>
                </>
              )}
              <Link href="/learn/library" onClick={onClose} className="font-bold text-primary underline">
                Open library
              </Link>
            </section>
          </div>
          <form onSubmit={submit} className="space-y-2 border-t border-border p-4">
            <label className="ds-field">
              <span>Ask how to use CoLearner</span>
              <input
                className="ds-input"
                value={draft}
                maxLength={300}
                onChange={event => setDraft(event.target.value)}
                placeholder="How do I start a lesson?"
              />
            </label>
            <Button type="submit" disabled={!draft.trim()}>
              <Send size={18} aria-hidden="true" />
              Ask about CoLearner
            </Button>
            <p className="text-xs text-muted-foreground">
              Screen help uses built-in guidance. For subject questions, start a learning chat
              above.
            </p>
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function HelpReply({ help, onNavigate }: { help: ScreenHelp; onNavigate: () => void }) {
  return (
    <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
      <h2 className="font-bold">{help.title}</h2>
      <p>{help.message}</p>
      <div className="flex flex-wrap gap-2">
        {help.actions.map(action => (
          <Link
            key={action.href}
            href={action.href}
            onClick={onNavigate}
            className="ds-button ds-button-secondary"
          >
            {action.label}
          </Link>
        ))}
      </div>
    </div>
  )
}
