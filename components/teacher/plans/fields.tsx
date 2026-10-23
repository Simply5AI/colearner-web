'use client'

import { useId, type ReactNode, type SelectHTMLAttributes } from 'react'
import { AlertTriangle, Info, Lock } from 'lucide-react'
import { cn } from '@/lib/utils'

/** A labelled native select: reliable with keyboard, screen readers and RTL, and matches the shadcn input look. */
export function NativeSelect({ label, hint, className, children, id, ...props }: SelectHTMLAttributes<HTMLSelectElement> & { label: string; hint?: string }) {
  const generated = useId()
  const selectId = id ?? generated
  const hintId = `${selectId}-hint`
  return <div className="space-y-1.5">
    <label htmlFor={selectId} className="block text-sm font-medium">{label}</label>
    <select id={selectId} aria-describedby={hint ? hintId : undefined} {...props}
      className={cn('h-9 w-full min-w-0 rounded-lg border border-input bg-background px-2.5 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-input/30', className)}>{children}</select>
    {hint && <p id={hintId} className="text-xs text-muted-foreground">{hint}</p>}
  </div>
}

export function FieldHint({ children, id }: { children: ReactNode; id?: string }) {
  return <p id={id} className="text-xs text-muted-foreground">{children}</p>
}

/** An error the teacher can act on. The draft stays on screen; nothing navigates away. */
export function InlineAlert({ children, tone = 'error', testId, className }: { children: ReactNode; tone?: 'error' | 'warning' | 'info' | 'locked'; testId?: string; className?: string }) {
  const Icon = tone === 'error' || tone === 'warning' ? AlertTriangle : tone === 'locked' ? Lock : Info
  return <div role={tone === 'error' ? 'alert' : 'note'} data-testid={testId} data-tone={tone}
    className={cn('flex items-start gap-2 rounded-lg border p-3 text-sm', tone === 'error' ? 'border-destructive/40 bg-destructive/5 text-destructive' : tone === 'warning' ? 'border-amber-500/50 bg-amber-500/10' : 'border-border bg-muted/40', className)}>
    <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0" /><div className="min-w-0 break-words">{children}</div>
  </div>
}

/** Measured data (counts, progress, due dates) is visually separate from anything written or suggested. */
export function MeasuredTag({ children = 'Measured' }: { children?: ReactNode }) {
  return <span className="inline-flex items-center rounded-full border border-border bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{children}</span>
}

export function UnavailableNote({ reason, testId, label = 'Not available yet' }: { reason: string; testId?: string; label?: string }) {
  return <p data-testid={testId} className="flex items-start gap-2 text-sm text-muted-foreground"><Lock aria-hidden="true" className="mt-0.5 size-4 shrink-0" /><span><span className="font-semibold text-foreground">{label}.</span> {reason}</span></p>
}

export function LoadingBlock({ label = 'Loading' }: { label?: string }) {
  return <div role="status" aria-live="polite" className="space-y-3 rounded-xl border border-border p-5">
    <span className="sr-only">{label}</span>
    {[0, 1, 2].map(index => <div key={index} aria-hidden="true" className="h-4 animate-pulse rounded bg-muted motion-reduce:animate-none" style={{ width: `${90 - index * 20}%` }} />)}
  </div>
}
