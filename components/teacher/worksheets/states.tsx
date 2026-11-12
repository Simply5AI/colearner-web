'use client'

import type { ReactNode } from 'react'
import { Loader2, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { InlineAlert } from '@/components/teacher/plans/fields'
import { TeachingApiError } from '@/lib/api/teaching/core'
import { isDenied, isUnavailable, teachingErrorInfo } from '@/lib/api/teaching/plans'
import { importErrorText } from '@/lib/api/teaching/question-imports'
import { worksheetErrorText } from '@/lib/api/teaching/worksheets'

/** The text for a failed call: the code's own reason when we have one, else the transport's safe message. */
export function failureText(error: unknown): string {
  const info = teachingErrorInfo(error)
  // A 400 VALIDATION carries the specific reason in `details[].code` (for example NOT_PUBLISHED).
  const detail = error instanceof TeachingApiError ? error.details.find(entry => worksheetErrorText[entry.code]) : undefined
  if (detail) return worksheetErrorText[detail.code]!
  if (info.code && (importErrorText[info.code] || worksheetErrorText[info.code])) return (importErrorText[info.code] ?? worksheetErrorText[info.code])!
  if (info.status === 410) return importErrorText.IMPORT_EXPIRED!
  return info.message
}

export function LoadingBlock({ label, testId }: { label: string; testId?: string }) {
  return <div role="status" aria-live="polite" data-testid={testId ?? 'b13-loading'} className="flex items-center gap-2 rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
    <Loader2 aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" />{label}
  </div>
}

/** Denied (403/404 share one honest message), unavailable (nothing changed) and retry, each with a visible next step. */
export function FailureBlock({ error, onRetry, testId, subject = 'this page' }: { error: unknown; onRetry?: () => void; testId?: string; subject?: string }) {
  if (isDenied(error)) {
    return <InlineAlert testId={testId ? `${testId}-denied` : 'b13-denied'}>You do not have access to {subject}, or it no longer exists. Check you are working in the right school and plan.</InlineAlert>
  }
  return <InlineAlert testId={testId ?? 'b13-error'}>
    <p>{isUnavailable(error) ? 'The teaching service is unavailable right now. Nothing was changed.' : failureText(error)}</p>
    {onRetry && <Button className="mt-2" variant="outline" size="lg" onClick={onRetry}><RefreshCw aria-hidden="true" />Retry</Button>}
  </InlineAlert>
}

export function EmptyBlock({ title, children, testId }: { title: string; children?: ReactNode; testId?: string }) {
  return <div data-testid={testId} className="rounded-xl border border-dashed border-border bg-card p-6 text-center">
    <h3 className="text-base font-bold">{title}</h3>{children && <div className="mx-auto mt-1 max-w-prose text-sm text-muted-foreground">{children}</div>}
  </div>
}
