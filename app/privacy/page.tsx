import type { Metadata } from 'next'
import { InformationPage } from '@/components/landing/information-page'
export const metadata: Metadata = { title: 'Privacy and consent direction' }
export default function PrivacyPage() {
  return <InformationPage title="Privacy and consent direction" introduction="The full school product is being redesigned. This is a product direction notice under review, not a finalized privacy policy.">
    <section className="rounded-2xl border bg-muted p-5"><h2 className="text-xl font-bold">Policy review is pending</h2><p className="mt-3">The operator’s identity, processor list, retention periods, regional hosting, deletion process and privacy contact must be confirmed before school rollout. This notice does not promise local AI processing, a specific retention period or regulatory certification.</p></section>
    <section><h2 className="text-xl font-bold">Planned school and family controls</h2><p className="mt-3">The plan calls for school-separated workspaces and guardian consent before protected child learning. When school and family settings differ, the stricter setting applies. Parents are planned to see full authorized chats under age 14, with summaries and safety alerts for teens.</p></section>
    <section><h2 className="text-xl font-bold">Before creating an account</h2><p className="mt-3">The existing adult account route asks for the account holder’s own name, email and password. Do not enter a child’s name, age, school details or learning material there. School invitations and guardian-approved learner setup will become available through the school rollout.</p></section>
    <section><h2 className="text-xl font-bold">Questions about an existing school account</h2><p className="mt-3">Contact your school administrator through your school’s usual support channel for the policies and access controls that apply to its current deployment.</p></section>
  </InformationPage>
}
