'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { RecaptchaUnavailableError, useOptionalRecaptcha } from './use-optional-recaptcha'
import { forgotPassword } from '@/lib/api/auth'
import { RecaptchaProvider } from './recaptcha-provider'
import { CoCharacter } from '@/components/design-system'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useClientReady } from './use-client-ready'

const schema = z.object({ email: z.string().email('Please enter a valid email address.') })
export function maskEmail(email: string): string {
  const [local, domain] = email.trim().split('@')
  return `${local?.slice(0, 1) ?? ''}•••@${domain ?? ''}`
}
export function ForgotPasswordForm() {
  const clientReady = useClientReady()
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const alertRef = useRef<HTMLDivElement>(null)
  const submitting = useRef(false)
  const getRecaptchaToken = useOptionalRecaptcha()
  const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), defaultValues: { email: '' }, mode: 'onBlur' })
  const { isSubmitting, errors } = form.formState
  async function onSubmit(values: z.infer<typeof schema>) {
    if (submitting.current) return
    submitting.current = true
    setError(null)
    try {
      const recaptchaToken = await getRecaptchaToken('forgot_password')
      await forgotPassword(values.email, recaptchaToken)
      setSentTo(maskEmail(values.email))
    } catch (error) { setError(error instanceof RecaptchaUnavailableError ? error.message : 'Reset instructions are unavailable right now. Please try again later.'); }
    finally { submitting.current = false; requestAnimationFrame(() => alertRef.current?.focus()) }
  }
  function tryAnotherEmail() { setSentTo(null); setError(null) }
  return <div className="space-y-7">
    <Link href="/login" className="inline-flex min-h-11 items-center font-semibold text-primary">Back to log in</Link>
    <div className="space-y-3"><h1 className="font-[family-name:var(--font-display)] text-3xl font-extrabold">Forgot your password?</h1><p className="text-muted-foreground">Enter your email to request reset instructions.</p></div>
    {sentTo ? <div ref={alertRef} tabIndex={-1} className="space-y-4 rounded-2xl border bg-muted p-5 focus:outline-2 focus:outline-ring"><CoCharacter band="kids" state="celebrating" size={88} decorative /><div role="status"><h2 className="text-xl font-bold">Check your email</h2><p className="mt-2 break-words">If an account exists for {sentTo}, reset instructions will be sent. Check your inbox and spam folder.</p></div><Button type="button" variant="outline" className="h-12" onClick={tryAnotherEmail}>Try another email</Button></div> : <form method="post" onSubmit={form.handleSubmit(onSubmit)} className="space-y-5" aria-busy={isSubmitting} noValidate>
      {error && <div ref={alertRef} tabIndex={-1} role="alert" className="rounded-xl border border-destructive/30 p-4 text-sm focus:outline-2 focus:outline-ring">{error}</div>}
      <div className="space-y-2"><Label htmlFor="reset-email">Email</Label><Input {...form.register('email')} id="reset-email" type="email" autoComplete="email" autoCapitalize="none" disabled={!clientReady || isSubmitting} className="h-12" aria-invalid={!!errors.email} aria-describedby={errors.email ? 'reset-email-error' : undefined} />{errors.email && <p id="reset-email-error" className="text-sm text-destructive">{errors.email.message}</p>}</div>
      <Button type="submit" className="h-12 w-full" disabled={!clientReady || isSubmitting}>{isSubmitting ? 'Requesting instructions…' : error ? 'Try again' : 'Send reset instructions'}</Button><p role="status" className="sr-only">{isSubmitting ? 'Requesting reset instructions. Please wait.' : ''}</p>
    </form>}
  </div>
}
export function ForgotPasswordContent() { return <RecaptchaProvider><ForgotPasswordForm /></RecaptchaProvider> }
