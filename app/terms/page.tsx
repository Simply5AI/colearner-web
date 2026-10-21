import type { Metadata } from 'next'
import { InformationPage } from '@/components/landing/information-page'
export const metadata: Metadata = { title: 'Terms notice' }
export default function TermsPage() {
  return <InformationPage title="Terms notice" introduction="School product terms are under review. This page explains the current development scope; final enterprise terms must be approved before school rollout.">
    <section className="rounded-2xl border bg-muted p-5"><h2 className="text-xl font-bold">Commercial terms are pending</h2><p className="mt-3">Enterprise pricing, service levels, contracting entity, jurisdiction, support commitments and cancellation terms have not been finalized. No free plan, purchase offer or guaranteed service level is presented here.</p></section>
    <section><h2 className="text-xl font-bold">Account and school access</h2><p className="mt-3">Use your own authorized account. Creating an adult account does not grant teacher status, establish a school membership or replace guardian consent. Follow your school’s access instructions.</p></section>
    <section><h2 className="text-xl font-bold">Learning direction</h2><p className="mt-3">The redesign prioritizes CBSE and ICSE Classes 1–10 in English. Overview previews describe planned experiences; your school administrator can confirm availability in its deployment. Use materials you are authorized to share.</p></section>
    <section><h2 className="text-xl font-bold">Before launch</h2><p className="mt-3">Final school agreements and user notices must be reviewed by the product owner before inviting schools and learners into the redesigned product.</p></section>
  </InformationPage>
}
