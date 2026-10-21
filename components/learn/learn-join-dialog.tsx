'use client'

import Link from 'next/link'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Dialog } from '@base-ui/react/dialog'
import { X } from 'lucide-react'
import { Button, CoCharacter, Input } from '@/components/design-system'
import { linkHref, type JoinResult, type LearnBand } from '@/lib/api/learn'

export const approvalCopy = (band: LearnBand) => band === 'teens' ? 'Waiting for your parent or guardian to approve' : 'Waiting for your parent to say yes'

interface JoinDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  band: LearnBand
  /** Resolves with the server decision or rejects with a safe message. The server is idempotent per learner and code. */
  onJoin: (code: string) => Promise<JoinResult>
}

/**
 * F-L2-04. A typed code is kept after a failure. After a decision the same code is never sent again
 * from this dialog, so a retry or a double press cannot duplicate an enrolment.
 */
export function JoinWithCodeDialog({ open, onOpenChange, band, onJoin }: JoinDialogProps) {
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [decision, setDecision] = useState<{ code: string; result: JoinResult } | null>(null)
  const inFlight = useRef(false)
  useEffect(() => { if (!open && decision) { setCode(''); setDecision(null); setError(null) } }, [open, decision])
  const trimmed = code.trim()
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!trimmed || inFlight.current) return
    if (decision?.code === trimmed) return
    inFlight.current = true; setBusy(true); setError(null)
    try { setDecision({ code: trimmed, result: await onJoin(trimmed) }) }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'This could not be sent. Your code is still here; try again.') }
    finally { inFlight.current = false; setBusy(false) }
  }
  const result = decision?.result
  const planHref = result?.planId ? linkHref({ route: 'PLAN', id: result.planId }) : null
  return <Dialog.Root open={open} onOpenChange={onOpenChange}>
    <Dialog.Portal>
      <Dialog.Backdrop className="fixed inset-0 z-50 bg-foreground/40" />
      <Dialog.Popup data-age-band={band} initialFocus={true} finalFocus={true} className="fixed start-1/2 top-1/2 z-50 w-[min(28rem,92vw)] -translate-x-1/2 -translate-y-1/2 space-y-5 overflow-y-auto rounded-[var(--radius,18px)] border border-border bg-card p-6 shadow-xl outline-none rtl:translate-x-1/2" style={{ maxHeight: '90dvh' }}>
        <div className="flex items-start justify-between gap-3">
          <Dialog.Title className="text-[length:var(--ds-h2)] font-extrabold">Join with a code</Dialog.Title>
          <Dialog.Close aria-label="Close" className="flex min-h-[var(--ds-target,44px)] min-w-[var(--ds-target,44px)] items-center justify-center rounded-xl hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"><X aria-hidden="true" className="size-5" /></Dialog.Close>
        </div>
        {result ? <div className="space-y-4 text-center" data-state={result.status === 'ENROLLED' ? 'joined' : 'approval-pending'}>
          <div className="flex justify-center"><CoCharacter band={band} state={result.status === 'ENROLLED' ? 'celebrating' : 'idle'} decorative /></div>
          {result.status === 'ENROLLED'
            ? <div role="status" className="space-y-2"><p className="text-[length:var(--ds-h3)] font-bold">You are in!</p><p className="text-muted-foreground">The plan is now part of your learning.</p></div>
            : <div role="status" className="space-y-2"><p className="text-[length:var(--ds-h3)] font-bold">{approvalCopy(band)}</p><p className="text-muted-foreground">We asked your parent or guardian. You can start this plan after they say yes. You do not need to send the code again.</p></div>}
          <div className="flex flex-wrap justify-center gap-3">
            {planHref && <Link href={planHref} className="ds-button ds-button-primary">Open the plan</Link>}
            <Button variant="secondary" onClick={() => onOpenChange(false)}>Done</Button>
          </div>
        </div> : <form onSubmit={submit} className="space-y-4" noValidate>
          <Dialog.Description className="text-muted-foreground">Type the code your teacher gave you. {band !== 'teens' ? 'Your parent will be asked to say yes.' : 'Your parent or guardian will be asked to approve.'}</Dialog.Description>
          <Input label="Class code" value={code} onChange={event => setCode(event.target.value)} autoComplete="off" autoCapitalize="characters" spellCheck={false} maxLength={40} aria-invalid={error ? true : undefined} required />
          {error && <p role="alert" className="ds-field-error">{error}</p>}
          <div className="flex flex-wrap gap-3">
            <Button type="submit" loading={busy} disabled={!trimmed}>{error ? 'Try again' : 'Join'}</Button>
            <Button variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button>
          </div>
        </form>}
      </Dialog.Popup>
    </Dialog.Portal>
  </Dialog.Root>
}
