import { cookies } from 'next/headers'
import { readTutorEntry, tutorCredential } from '@/lib/api/tutor-loop/entry'
import { FAMILY_CHILD_COOKIE } from '@/lib/auth/family-cookies'
import { LearnerEntry } from '@/components/family/learner-entry'

export default async function LearnerPage() {
  const child = (await cookies()).get(FAMILY_CHILD_COOKIE)
  const credential = child?.value ? await tutorCredential('school') : null
  const entry = credential && await readTutorEntry(credential, 'school')
  return <LearnerEntry homeHref={entry?.state === 'ready' ? '/learn/start' : '/learn/home'} />
}
