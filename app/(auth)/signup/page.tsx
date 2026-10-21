import type { Metadata } from 'next'
import { Suspense } from 'react'
import { LoadingState } from '@/components/design-system'
import { SignupForm } from '@/components/auth/signup-form'
import { RecaptchaProvider } from '@/components/auth/recaptcha-provider'
import { isGoogleProviderConfigured } from '@/lib/auth/google-provider.server'

export const metadata: Metadata = { title: 'Create an account', description: 'Minimal account registration for CoLearner' }
export default function SignupPage() {
  const googleEnabled = isGoogleProviderConfigured()
  return (
    <div className="space-y-7">
      <div className="space-y-3"><p className="text-sm font-semibold text-primary">Welcome to CoLearner</p><h1 className="font-[family-name:var(--font-display)] text-3xl font-extrabold tracking-tight sm:text-4xl">A fresh start.</h1><p className="text-muted-foreground">Create your account. We’ll check your age before learner setup.</p></div>
      <Suspense fallback={<LoadingState label="Loading account form…" />}><RecaptchaProvider><SignupForm googleEnabled={googleEnabled} /></RecaptchaProvider></Suspense>
    </div>
  )
}
