import type { Metadata } from 'next'
import Link from 'next/link'
import { InformationPage } from '@/components/landing/information-page'
export const metadata: Metadata = { title: 'School access and support' }
export default function ContactPage() {
  return <InformationPage title="School access and support" introduction="For an existing school deployment, your school administrator is the first point of contact.">
    <section><h2 className="text-xl font-bold">Existing account</h2><p className="mt-3">Use your school’s usual support channel for invitations, account access, curriculum availability and family controls. Do not share passwords or reset links with anyone.</p><Link href="/forgot-password" className="mt-4 inline-flex min-h-12 items-center rounded-xl bg-primary px-5 font-semibold text-primary-foreground">Request reset instructions</Link></section>
    <section className="rounded-2xl border bg-muted p-5"><h2 className="text-xl font-bold">New school enquiries</h2><p className="mt-3">A public enquiry channel and enterprise onboarding process have not been configured yet. School onboarding and commercial plans follow product development.</p></section>
    <section><h2 className="text-xl font-bold">Product scope</h2><p className="mt-3">See the overview for planned student, parent, teacher and school administrator experiences. No message is submitted from this page.</p><Link href="/#schools" className="inline-flex min-h-11 items-center font-semibold text-primary">Explore the school product</Link></section>
  </InformationPage>
}
