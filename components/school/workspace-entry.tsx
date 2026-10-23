'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  BrandMark,
  Button,
  Card,
  Input,
  EmptyState,
} from '@/components/design-system'
import {
  type CursorList,
  type Workspace,
} from '@/lib/api/school'
import { schoolBrowserRequest } from '@/lib/api/school-browser'
import { selectSchoolWorkspace } from '@/app/workspaces/actions'
import { QueryState, ActionFeedback } from './school-common'
import { SignedInAs } from '@/components/family/signed-in-as'

export function WorkspaceEntry({ personalHref, denied = false }: { personalHref: string; denied?: boolean }) {
  const { data: session } = useSession()
  const router = useRouter()
  const client = useQueryClient()
  const [code, setCode] = useState('')
  const [cursor, setCursor] = useState('')
  const [history, setHistory] = useState<string[]>([])
  const token = session?.accessToken ?? ''
  const workspaces = useQuery({
    queryKey: ['school-workspaces', session?.user?.id, cursor],
    queryFn: () =>
      schoolBrowserRequest<CursorList<Workspace>>(
        `/school-identity/workspaces${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`,
      ),
    enabled: !!token,
    retry: false,
  })
  const profile = useQuery({
    queryKey: ['school-identity-profile', session?.user?.id],
    queryFn: () =>
      schoolBrowserRequest<{ email: string; emailVerified: boolean }>(
        '/school-identity/profile',
      ),
    enabled: !!token,
    retry: false,
  })
  const select = useMutation({
    mutationFn: selectSchoolWorkspace,
    retry: false,
    onSuccess: (result) => {
      if (result.href) {
        router.push(result.href)
        router.refresh()
      }
    },
  })
  const verification = useMutation({
    mutationFn: ({ confirm }: { confirm: boolean }) =>
      schoolBrowserRequest(
        `/school-identity/email-verification/${confirm ? 'confirmation' : 'request'}`,
        'POST',
        confirm ? { token: code } : {},
      ),
    retry: false,
    onSuccess: () =>
      client.invalidateQueries({ queryKey: ['school-identity-profile'] }),
  })
  return (
    <div
      data-age-band="adults"
      className="mx-auto max-w-5xl space-y-8 px-4 py-8 sm:px-6"
    >
      <Link href="/" className="inline-flex min-h-11 items-center">
        <BrandMark />
      </Link>
      <SignedInAs />
      {denied && <p role="alert" data-testid="access-denied" className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">That area is not available to your account in the selected workspace. Choose a workspace below that matches your role.</p>}
      <div className="space-y-3">
        <h1 className="font-[family-name:var(--font-display)] text-4xl font-extrabold">
          Choose your workspace
        </h1>
        <p className="text-muted-foreground">
          Your school and role come from verified memberships. Switching changes
          your workspace, not your account’s authority.
        </p>
      </div>
      <div className="flex flex-wrap gap-3"><Link href="/family" className="ds-button ds-button-secondary">My verified family</Link><Link href="/age" className="ds-button ds-button-ghost">Learner age check</Link><Link href="/profiles" className="ds-button ds-button-ghost">Shared device</Link></div>
      <QueryState
        pending={workspaces.isPending}
        error={workspaces.error}
        retry={() => void workspaces.refetch()}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          {workspaces.data?.items.map((workspace) => (
            <Card key={workspace.membershipId} className="space-y-4">
              <h2 className="break-words text-xl font-bold">
                {workspace.schoolName}
              </h2>
              <p>
                {workspace.role === 'SCHOOL_ADMIN'
                  ? 'School administrator'
                  : workspace.role === 'TEACHER'
                    ? 'School teacher'
                    : workspace.role === 'STUDENT'
                      ? 'School student'
                      : 'Parent / guardian'}
              </p>
              {['SCHOOL_ADMIN', 'TEACHER'].includes(workspace.role) ? (
                <Button
                  loading={select.isPending}
                  onClick={() => select.mutate(workspace.membershipId)}
                >
                  Open workspace
                </Button>
              ) : (
                <div className="space-y-3"><p className="text-sm text-muted-foreground">Membership recorded. This does not verify a guardian relationship or grant child access.</p><Link className="ds-button ds-button-secondary" href={workspace.role==='PARENT'?'/family':'/learner'}>{workspace.role==='PARENT'?'Review verified family access':'Open consent-checked learner entry'}</Link></div>
              )}
            </Card>
          ))}
        </div>
        {workspaces.data?.items.length === 0 && (
          <EmptyState
            band="adults"
            title="No active school membership"
            description="Ask your school administrator for a bound invitation. Creating a personal account does not grant a school role."
          />
        )}
        <div className="mt-4 flex flex-wrap gap-3">
          <Button
            variant="secondary"
            disabled={history.length === 0}
            onClick={() => {
              setCursor(history[history.length - 1] ?? '')
              setHistory((old) => old.slice(0, -1))
            }}
          >
            Previous workspaces
          </Button>
          <Button
            variant="secondary"
            disabled={!workspaces.data?.nextCursor}
            onClick={() => {
              setHistory((old) => [...old, cursor])
              setCursor(workspaces.data?.nextCursor ?? '')
            }}
          >
            Next workspaces
          </Button>
        </div>
      </QueryState>
      {(select.error || select.data?.error) && (
        <p role="alert" className="rounded-xl border p-4">
          {select.data?.error ?? 'Workspace selection failed. Try again.'}
        </p>
      )}
      <Card className="space-y-4">
        <h2 className="text-xl font-bold">Joining a school?</h2>
        <p>
          Use the invitation code your school administrator gave you.
          Invitations require the account’s verified email.
        </p>
        <Link href="/invite" className="ds-button ds-button-secondary">
          Accept school invitation
        </Link>
        {profile.isError && (
          <p role="alert">
            Email verification status unavailable.{' '}
            <button
              onClick={() => void profile.refetch()}
              className="underline"
            >
              Retry
            </button>
          </p>
        )}
        {profile.data && !profile.data.emailVerified && (
          <div className="space-y-4 border-t pt-4">
            <p>Verify your account email before accepting invitations.</p>
            <Button
              variant="secondary"
              loading={verification.isPending}
              onClick={() => verification.mutate({ confirm: false })}
            >
              Send verification code
            </Button>
            <form
              className="space-y-3"
              onSubmit={(event) => {
                event.preventDefault()
                verification.mutate({ confirm: true })
              }}
            >
              <Input
                label="Email verification code"
                value={code}
                onChange={(event) => setCode(event.target.value)}
                required
                autoComplete="one-time-code"
              />
              <Button
                type="submit"
                disabled={!code}
                loading={verification.isPending}
              >
                Verify email
              </Button>
            </form>
            <ActionFeedback
              pending={verification.isPending}
              error={verification.error}
            />
            {verification.isSuccess && (
              <p role="status">
                Request completed. If you requested a code, check your email.
              </p>
            )}
          </div>
        )}
      </Card>
      <div className="flex flex-wrap gap-3">
        <Link href={personalHref} className="ds-button ds-button-ghost">
          Open existing personal workspace
        </Link>
        <Link href="/login" className="ds-button ds-button-ghost">
          Account sign-in
        </Link>
      </div>
    </div>
  )
}
