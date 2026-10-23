import type { Metadata } from 'next'
import { Suspense } from 'react'
import styles from '@/components/auth/auth.module.css'
import { CoAvatar, LoadingState } from '@/components/design-system'
import { SignupForm } from '@/components/auth/signup-form'
import { RecaptchaProvider } from '@/components/auth/recaptcha-provider'
import { isGoogleProviderConfigured } from '@/lib/auth/google-provider.server'

export const metadata: Metadata = { title: 'Create an account', description: 'Minimal account registration for CoLearner' }
export default function SignupPage() {
  const googleEnabled = isGoogleProviderConfigured()
  return (
    <div className="space-y-7">
      <div className={styles.formHeading}><CoAvatar band="kids" state="encouraging" size={54} /><p className={styles.eyebrow}>HELLO, NEW ADVENTURE</p><h1>Let’s grow your curiosity.</h1><p>Start with an account. We’ll check your age next and guide you through learner setup.</p></div>
      <Suspense fallback={<LoadingState label="Loading account form…" />}><RecaptchaProvider><SignupForm googleEnabled={googleEnabled} /></RecaptchaProvider></Suspense>
    </div>
  )
}
