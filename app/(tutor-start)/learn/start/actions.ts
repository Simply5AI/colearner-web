'use server'

import { redirect } from 'next/navigation'
import { grantTutorLearningConsent, tutorCredential } from '@/lib/api/tutor-loop/entry'

export type StartActionState = { error?: string }

export async function grantConsent(_: StartActionState, form: FormData): Promise<StartActionState> {
  const clientRequestId = form.get('requestId')
  const credential = await tutorCredential('personal')
  if (!credential || typeof clientRequestId !== 'string' || form.get('accept') !== 'yes') {
    return { error: 'Confirm that you agree to save your learning progress.' }
  }
  const granted = await grantTutorLearningConsent(credential, clientRequestId).catch(() => false)
  if (granted) redirect('/learn/start?scope=personal&step=goal')
  return { error: 'We could not save your choice. Try again.' }
}
