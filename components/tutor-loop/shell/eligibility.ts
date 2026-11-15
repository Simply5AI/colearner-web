import 'server-only'

import { cookies } from 'next/headers'
import { readTutorEntry, tutorCredential, type TutorWorkspace } from '@/lib/api/tutor-loop/entry'
import type { TutorEntrySeed } from './tutor-shell-context'

/**
 * Server read of the entry for the shell. `disabled` for every failure (flag off, kids, tweens, API down), so the
 * legacy shell renders from the first paint and no header switch happens.
 */
export async function readTutorEntrySeed(): Promise<TutorEntrySeed> {
  try {
    const jar = await cookies()
    const workspace: TutorWorkspace = jar.get('colearner-tutor-workspace')?.value === 'personal' ? 'personal' : 'school'
    const credential = await tutorCredential(workspace)
    if (!credential) return { disabled: true }
    const result = await readTutorEntry(credential, workspace)
    if (result.state === 'ready' && !result.entry.needsConsent) return { entry: result.entry }
    return { disabled: true }
  } catch {
    return { disabled: true }
  }
}

/** True only when Tutor Loop is on and ready for this learner (flag on, eligible band, consent done). */
export async function tutorLoopReady(): Promise<boolean> {
  return 'entry' in (await readTutorEntrySeed())
}
