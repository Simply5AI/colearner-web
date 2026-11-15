import { auth } from '@/lib/auth/config'
import { redirect } from 'next/navigation'
import { WorkspaceEntry } from '@/components/school/workspace-entry'
import { resolvePostLoginPath } from '@/lib/auth/post-login'
import { readTutorEntry, tutorCredential } from '@/lib/api/tutor-loop/entry'
export default async function WorkspacesPage({ searchParams }: { searchParams?: Promise<{ denied?: string }> }) {
  const denied = (await searchParams)?.denied === '1'
  const session = await auth()
  if (!session?.accessToken || !session.user?.id)
    redirect('/login?callbackUrl=/workspaces')
  const credential = await tutorCredential('personal')
  const personal = credential && await readTutorEntry(credential, 'personal')
  const personalHref = personal?.state === 'ready' ? '/learn/start?scope=personal' : resolvePostLoginPath(session)
  return <WorkspaceEntry personalHref={personalHref} denied={denied} />
}
