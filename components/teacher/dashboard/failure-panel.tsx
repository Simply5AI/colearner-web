'use client'

import Link from 'next/link'
import { Button, ErrorState } from '@/components/design-system'
import type { TeachingFailure } from '@/lib/api/teaching/core'

const COPY: Record<TeachingFailure, { title: string; hint: string }> = {
  denied: {
    title: 'Teaching access denied',
    hint: 'Pick a school workspace where you are an active teacher.',
  },
  unavailable: {
    title: 'The teaching workspace is unavailable',
    hint: 'Nothing you typed is lost. Try again in a moment.',
  },
  retry: {
    title: 'This did not load',
    hint: 'Nothing was changed. Try again.',
  },
}

/** Denied, unavailable and retry in one place so every T1/T8 request renders the same honest states. */
export function TeachingFailurePanel({
  kind,
  message,
  onRetry,
  testId = 'teaching-failure',
}: {
  kind: TeachingFailure
  message: string
  onRetry?: () => void
  testId?: string
}) {
  const copy = COPY[kind]
  return (
    <div data-testid={testId} data-failure={kind}>
      <ErrorState
        band="adults"
        title={copy.title}
        description={`${message} ${copy.hint}`}
        action={
          kind === 'denied' ? (
            <Link href="/workspaces" className="font-semibold text-primary underline">
              Choose a school workspace
            </Link>
          ) : onRetry ? (
            <Button onClick={onRetry}>Try again</Button>
          ) : undefined
        }
      />
    </div>
  )
}
