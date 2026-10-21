import type { Metadata } from 'next'
import { requireOnboardingAccess } from '@/lib/auth/onboarding-access'
import { MeetCoIdentityProvider } from '@/components/onboarding/meet-co/identity'

export const metadata: Metadata = { title: { absolute: 'Meet Co | CoLearner' } }

/**
 * Own gate: the legacy (onboarding) group layout needs an adult Auth.js session and
 * cannot admit an opaque child cookie. Middleware does not cover group descendants.
 */
export default async function MeetCoLayout({ children }: { children: React.ReactNode }) {
  const access = await requireOnboardingAccess()
  return <MeetCoIdentityProvider value={{ scope: access.scope, learnerName: access.learnerName, kind: access.kind }}>{children}</MeetCoIdentityProvider>
}
