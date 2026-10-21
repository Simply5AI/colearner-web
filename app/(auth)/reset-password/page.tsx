import { Suspense } from 'react'
import type { Metadata } from 'next'
import { ResetPasswordForm } from '@/components/auth/reset-password-form'
export const metadata: Metadata = { title: 'Set a new password', robots: { index: false, follow: false }, referrer: 'no-referrer' }
export default function ResetPasswordPage() { return <Suspense fallback={<p role="status">Loading password reset…</p>}><ResetPasswordForm /></Suspense> }
