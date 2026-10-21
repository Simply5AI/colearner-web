'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useMutation } from '@tanstack/react-query'
import { BrandMark, Card, Input, Button } from '@/components/design-system'
import { type Workspace } from '@/lib/api/school'
import { schoolBrowserRequest } from '@/lib/api/school-browser'
import { ActionFeedback } from './school-common'
export function InvitationEntry() {
  const [code, setCode] = useState('')
  const accept = useMutation({
    mutationFn: () =>
      schoolBrowserRequest<Workspace>(
        '/school-identity/invitations/accept',
        'POST',
        { token: code },
      ),
    retry: false,
  })
  return (
    <div
      data-age-band="adults"
      className="mx-auto max-w-2xl space-y-8 px-4 py-8"
    >
      <Link href="/" className="inline-flex min-h-11 items-center">
        <BrandMark />
      </Link>
      <Card className="space-y-5">
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-extrabold">
          Join your school
        </h1>
        <p>
          Sign in with the verified email named in your invitation, then paste
          the invitation code. Your school role is assigned by the school.
        </p>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault()
            accept.mutate()
          }}
        >
          <Input
            label="School invitation code"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            required
            autoComplete="off"
            disabled={accept.isPending || accept.isSuccess}
          />
          <Button
            type="submit"
            disabled={!code || accept.isSuccess}
            loading={accept.isPending}
          >
            Accept invitation
          </Button>
        </form>
        <ActionFeedback pending={accept.isPending} error={accept.error} />
        {accept.isSuccess && (
          <div role="status" className="space-y-3">
            <p>
              School membership activated. Guardian invitations record
              membership only; child relationships and consent remain
              unverified.
            </p>
            <Link href="/workspaces" className="ds-button ds-button-primary">
              Choose workspace
            </Link>
          </div>
        )}
        <Link href="/workspaces" className="ds-button ds-button-ghost">
          Verify email or return to workspaces
        </Link>
      </Card>
    </div>
  )
}
