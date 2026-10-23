'use client'

import { ShieldCheck } from 'lucide-react'
import styles from './auth.module.css'
import { useRef, useState } from 'react'
import { useForm, useWatch, Controller } from 'react-hook-form'
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema'
import { getSession, signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { isSafeCallbackUrl } from '@/lib/auth/post-login'
import Link from 'next/link'
import { RecaptchaUnavailableError, useOptionalRecaptcha } from './use-optional-recaptcha'
import { signupSchema, type SignupInput } from '@/lib/validators/auth'
import { getPasswordStrength } from '@/lib/utils/password-strength'
import { registerUser } from '@/lib/api/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SocialButtons } from './social-buttons'
import { AuthDivider } from './auth-divider'
import { useClientReady } from './use-client-ready'
import { PasswordField } from './password-field'
import { PasswordStrengthMeter } from './password-strength-meter'

export function SignupForm({ googleEnabled = false }: { googleEnabled?: boolean }) {
  const clientReady = useClientReady()
  const router = useRouter()
  const callbackUrl = useSearchParams().get('callbackUrl')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const submitting = useRef(false)
  const alertRef = useRef<HTMLDivElement>(null)
  const getRecaptchaToken = useOptionalRecaptcha()
  const { register, handleSubmit, control, formState: { errors } } = useForm<SignupInput>({ resolver: standardSchemaResolver(signupSchema), mode: 'onBlur', defaultValues: { acceptTerms: false as unknown as true } })
  const passwordValue = useWatch({ control, name: 'password', defaultValue: '' })
  const acceptedTerms = useWatch({ control, name: 'acceptTerms' })
  async function onSubmit(data: SignupInput) {
    if (submitting.current) return
    submitting.current = true
    setIsLoading(true)
    setError(null)
    try {
      const recaptchaToken = await getRecaptchaToken('register')
      await registerUser({ email: data.email, password: data.password, acceptedTerms: true, recaptchaToken })
      const result = await signIn('credentials', { email: data.email, password: data.password, redirect: false })
      const session = result && !result.error ? await getSession() : null
      router.push(session?.accessToken && session.user?.id ? isSafeCallbackUrl(callbackUrl) ? callbackUrl : '/age' : `/login?registered=true&callbackUrl=${encodeURIComponent(isSafeCallbackUrl(callbackUrl) ? callbackUrl : '/age')}`)
    } catch (error) { setError(error instanceof RecaptchaUnavailableError ? error.message : 'We could not create your account. Check your details or try again later. If you already registered, log in or reset your password.'); }
    finally { setIsLoading(false); submitting.current = false; requestAnimationFrame(() => alertRef.current?.focus()) }
  }
  return (
    <div className="space-y-6">
      <div className={styles.guardianNote}><ShieldCheck size={21} aria-hidden="true" /><div><p>A grown-up can help you get started.</p><span>We check your birthday next. Child names and school details wait until verified guardian consent. You’ll need a school invitation to link a learner profile.</span></div></div>
      {error && <div ref={alertRef} role="alert" tabIndex={-1} className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm focus:outline-2 focus:outline-ring">{error}</div>}
      <form method="post" onSubmit={handleSubmit(onSubmit)} className="space-y-5" aria-busy={isLoading} noValidate>
        {googleEnabled && <><SocialButtons isLoading={!clientReady || isLoading || !acceptedTerms} enabled callbackUrl={isSafeCallbackUrl(callbackUrl) ? callbackUrl : "/age"} /><p className="text-sm text-muted-foreground">Read and accept the notices below before continuing with Google.</p><AuthDivider /></>}
        <div className="space-y-2"><Label htmlFor="email">Email</Label><Input {...register('email')} id="email" type="email" placeholder="you@example.com" autoComplete="email" autoCapitalize="none" className="h-12" disabled={!clientReady || isLoading} aria-invalid={!!errors.email} aria-describedby={errors.email ? 'email-error' : undefined} />{errors.email && <p id="email-error" className="text-sm text-destructive">{errors.email.message}</p>}</div>
        <PasswordField {...register('password')} id="password" label="Password" autoComplete="new-password" disabled={!clientReady || isLoading} error={errors.password?.message} aria-describedby="password-requirements" />
        <p id="password-requirements" className="text-sm text-muted-foreground">At least 8 characters, with uppercase and lowercase letters and a number.</p>
        <PasswordStrengthMeter strength={getPasswordStrength(passwordValue)} />
        <PasswordField {...register('confirmPassword')} id="confirmPassword" label="Confirm password" autoComplete="new-password" disabled={!clientReady || isLoading} error={errors.confirmPassword?.message} />
        <div className="flex items-start gap-3"><Controller name="acceptTerms" control={control} render={({ field }) => <input id="acceptTerms" ref={field.ref} type="checkbox" checked={field.value === true} onChange={(event) => field.onChange(event.target.checked)} onBlur={field.onBlur} disabled={!clientReady || isLoading} aria-invalid={!!errors.acceptTerms} aria-describedby={errors.acceptTerms ? 'terms-error' : undefined} className="mt-1 size-5 shrink-0 accent-primary" />} /><label htmlFor="acceptTerms" className="text-sm leading-relaxed">I have read the current <Link href="/terms" className="font-semibold text-primary underline">terms notice</Link> and <Link href="/privacy" className="font-semibold text-primary underline">privacy notice</Link>. These notices remain under review.</label></div>
        {errors.acceptTerms && <p id="terms-error" className="text-sm text-destructive">{errors.acceptTerms.message}</p>}
        <Button type="submit" className="h-12 w-full text-base font-bold" disabled={!clientReady || isLoading}>{isLoading ? 'Creating account…' : error ? 'Try creating account again' : 'Create account'}</Button>
        <p role="status" className="sr-only">{isLoading ? 'Creating your account. Please wait.' : ''}</p>
      </form>
      <p className="text-center text-sm text-muted-foreground">Already have an account? <Link href="/login" className="font-semibold text-primary">Log in</Link></p>
    </div>
  )
}
