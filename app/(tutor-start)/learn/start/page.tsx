import { randomUUID } from 'node:crypto'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { TutorStartFrame, TutorStartScreen } from '@/components/tutor-loop/start/start-screen'
import { readTutorEntry, tutorCredential } from '@/lib/api/tutor-loop/entry'

export const metadata = { title: 'Start learning | CoLearner' }

export default async function TutorStartPage({ searchParams }: {
  searchParams: Promise<{ scope?: string; step?: string }>
}) {
  const { scope, step } = await searchParams
  const workspace = scope === 'personal' ? 'personal' : 'school'
  const credential = await tutorCredential(workspace)
  if (!credential) redirect(workspace === 'school' ? '/learner' : '/workspaces')
  const result = await readTutorEntry(credential, workspace)
  if (result.state === 'signed-out') redirect(workspace === 'school' ? '/learner' : '/login')
  if (result.state === 'disabled' && workspace === 'school') redirect('/learn/home')
  if (result.state !== 'ready') {
    const unavailable = result.state === 'unavailable'
    return (
      <TutorStartFrame adult={workspace === 'personal'}>
        <main className="grid flex-1 place-items-center px-5 pb-24 pt-10">
          <div className="w-full max-w-[440px] space-y-4 text-center">
            <h1>{unavailable ? 'Your learning space could not open' : 'This learning space is unavailable'}</h1>
            <p className="text-muted-foreground">{unavailable ? 'Try opening it again in a moment.' : 'Choose an available learning space to continue.'}</p>
            <Link className="ds-button ds-button-primary w-full" href={unavailable ? `/learn/start${workspace === 'personal' ? '?scope=personal' : ''}` : '/workspaces'}>
              {unavailable ? 'Try again' : 'Choose a workspace'}
            </Link>
          </div>
        </main>
      </TutorStartFrame>
    )
  }
  return <TutorStartScreen entry={result.entry} name={credential.name} requestId={randomUUID()} startGoal={step === 'goal'} />
}
