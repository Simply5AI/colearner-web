'use client'
import { signOut, useSession } from 'next-auth/react'
import { useState } from 'react'
import { clearWorkspaceSelection } from '@/app/workspaces/actions'

/** Shows which account this browser is signed in as and signs out cleanly (workspace selection forgotten, then Auth.js sign-out). */
export function SignedInAs({ switchLabel = 'Sign out / switch account' }: { switchLabel?: string }) {
  const { data: session } = useSession()
  const [busy, setBusy] = useState(false)
  if (!session?.user) return null
  const who = session.user.email ?? session.user.name ?? 'your account'
  return <div data-testid="signed-in-as" className="flex flex-wrap items-center gap-3 rounded-2xl border bg-background/80 px-4 py-2 text-sm">
    <span>Signed in as <strong data-testid="signed-in-email">{who}</strong></span>
    <button type="button" disabled={busy} className="ds-button ds-button-ghost" onClick={async () => { setBusy(true); await clearWorkspaceSelection().catch(() => undefined); await signOut({ redirectTo: '/login' }) }}>{switchLabel}</button>
  </div>
}
