import type { Metadata } from 'next'
import { Suspense } from 'react'
import Link from 'next/link'
import { LoginForm } from '@/components/auth/login-form'
import { isGoogleProviderConfigured } from '@/lib/auth/google-provider.server'
import { PublicSchoolEntry } from '@/components/school/public-school-entry'

export const metadata: Metadata = { title: 'Log in', description: 'Log in to your CoLearner account' }
export default function LoginPage() {
  const googleEnabled = isGoogleProviderConfigured()
  return (
    <div className="space-y-7">
      <div className="space-y-3"><p className="text-sm font-semibold text-primary">Hello again.</p><h1 className="font-[family-name:var(--font-display)] text-3xl font-extrabold tracking-tight sm:text-4xl">Let’s keep learning.</h1><p className="text-muted-foreground">Log in with your existing CoLearner account.</p></div>
      <Suspense fallback={<p role="status">Loading sign-in form…</p>}><LoginForm googleEnabled={googleEnabled} /></Suspense>
      <div className="border-t pt-5 text-sm text-muted-foreground"><PublicSchoolEntry /><p className="mt-3">Platform administrator? <Link href="/admin/login" className="font-semibold text-primary">Open admin sign-in</Link></p></div>
    </div>
  )
}
