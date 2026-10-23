import type { Metadata } from 'next'
import { Suspense } from 'react'
import Link from 'next/link'
import { CoAvatar } from '@/components/design-system'
import styles from '@/components/auth/auth.module.css'
import { LoginForm } from '@/components/auth/login-form'
import { isGoogleProviderConfigured } from '@/lib/auth/google-provider.server'
import { PublicSchoolEntry } from '@/components/school/public-school-entry'

export const metadata: Metadata = { title: 'Log in', description: 'Log in to your CoLearner account' }
export default function LoginPage() {
  const googleEnabled = isGoogleProviderConfigured()
  return (
    <div className="space-y-7">
      <div className={styles.formHeading}><CoAvatar band="kids" state="waving" size={54} /><p className={styles.eyebrow}>GOOD TO SEE YOU AGAIN</p><h1>Let’s keep learning.</h1><p>Your next little discovery is waiting.<br />Log in with your CoLearner account.</p></div>
      <Suspense fallback={<p role="status">Loading sign-in form…</p>}><LoginForm googleEnabled={googleEnabled} /></Suspense>
      {process.env.NODE_ENV === 'development' && <p className="text-sm text-muted-foreground">Testing locally? <Link href="/dev/demo" className="font-semibold text-primary">View demo accounts and starting points</Link></p>}
      <div className="border-t pt-5 text-sm text-muted-foreground"><details className={styles.schoolHelp}><summary>Joining through your school?</summary><PublicSchoolEntry /></details><p className="mt-3">Platform administrator? <Link href="/admin/login" className="font-semibold text-primary">Open admin sign-in</Link></p></div>
    </div>
  )
}
