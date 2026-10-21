'use client'

import { useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm, useWatch } from 'react-hook-form'
import { z } from 'zod'
import { resetPassword } from '@/lib/api/auth'
import { getPasswordStrength } from '@/lib/utils/password-strength'
import { Button } from '@/components/ui/button'
import { CoCharacter } from '@/components/design-system'
import { PasswordField } from './password-field'
import { PasswordStrengthMeter } from './password-strength-meter'
import { useClientReady } from './use-client-ready'

const schema = z.object({ password: z.string().min(8, 'Use at least 8 characters.'), confirmPassword: z.string() }).refine((data) => data.password === data.confirmPassword, { message: 'Passwords do not match.', path: ['confirmPassword'] })
export function ResetPasswordForm() {
  const clientReady = useClientReady()
  const token = useSearchParams().get('token')
  const [complete, setComplete] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const alertRef = useRef<HTMLDivElement>(null)
  const submitting = useRef(false)
  const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), defaultValues: { password: '', confirmPassword: '' }, mode: 'onBlur' })
  const password = useWatch({ control: form.control, name: 'password' })
  const { isSubmitting, errors } = form.formState
  async function onSubmit(values: z.infer<typeof schema>) {
    if (!token || submitting.current) return
    submitting.current = true
    setError(null)
    try { await resetPassword({ token, newPassword: values.password }); setComplete(true); form.reset() }
    catch { setError('We could not reset your password. The link may be expired or already used. Request a new link to continue.'); }
    finally { submitting.current = false; requestAnimationFrame(() => alertRef.current?.focus()) }
  }
  return <div className="space-y-7">
    <Link href="/login" className="inline-flex min-h-11 items-center font-semibold text-primary">Back to log in</Link>
    <div className="space-y-3"><h1 className="font-[family-name:var(--font-display)] text-3xl font-extrabold">Set a new password.</h1><p className="text-muted-foreground">Use at least 8 characters. Choose a password you do not use elsewhere.</p></div>
    {complete ? <div ref={alertRef} tabIndex={-1} className="space-y-4 rounded-2xl border bg-muted p-5 focus:outline-2 focus:outline-ring"><CoCharacter band="kids" state="celebrating" size={88} decorative /><div role="status"><h2 className="text-xl font-bold">Password updated</h2><p className="mt-2">Log in again with your new password.</p></div><Link href="/login" className="inline-flex min-h-12 items-center rounded-xl bg-primary px-5 font-semibold text-primary-foreground">Go to log in</Link></div> : !token ? <div role="alert" className="space-y-4 rounded-2xl border border-destructive/30 p-5"><p>This reset link is incomplete. Request a new link to continue.</p><Link href="/forgot-password" className="inline-flex min-h-11 items-center font-semibold text-primary">Request a new reset link</Link></div> : <form method="post" onSubmit={form.handleSubmit(onSubmit)} className="space-y-5" aria-busy={isSubmitting} noValidate>
      {error && <div ref={alertRef} role="alert" tabIndex={-1} className="space-y-2 rounded-xl border border-destructive/30 p-4 text-sm focus:outline-2 focus:outline-ring"><p>{error}</p><Link href="/forgot-password" className="inline-flex min-h-11 items-center font-semibold text-primary">Request a new reset link</Link></div>}
      <PasswordField {...form.register('password')} id="new-password" label="New password" autoComplete="new-password" disabled={!clientReady || isSubmitting} error={errors.password?.message} />
      <PasswordStrengthMeter strength={getPasswordStrength(password)} />
      <PasswordField {...form.register('confirmPassword')} id="confirm-password" label="Confirm new password" autoComplete="new-password" disabled={!clientReady || isSubmitting} error={errors.confirmPassword?.message} />
      <Button type="submit" className="h-12 w-full" disabled={!clientReady || isSubmitting}>{isSubmitting ? 'Updating password…' : 'Update password'}</Button><p role="status" className="sr-only">{isSubmitting ? 'Updating password. Please wait.' : ''}</p>
    </form>}
  </div>
}
