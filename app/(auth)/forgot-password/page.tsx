import type { Metadata } from 'next'
import { ForgotPasswordContent } from '@/components/auth/forgot-password-form'
export const metadata: Metadata = { title: 'Reset instructions' }
export default function ForgotPasswordPage() { return <ForgotPasswordContent /> }
