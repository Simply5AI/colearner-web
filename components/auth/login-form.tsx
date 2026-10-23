'use client'

import { useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema'
import { getSession, signIn, signOut } from 'next-auth/react'
import { clearWorkspaceSelection } from '@/app/workspaces/actions'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { loginSchema, type LoginInput } from '@/lib/validators/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CoCharacter } from '@/components/design-system'
import { SocialButtons } from './social-buttons'
import { AuthDivider } from './auth-divider'
import { useClientReady } from './use-client-ready'
import { PasswordField } from './password-field'
import { resolvePostLoginPath, isSafeCallbackUrl } from '@/lib/auth/post-login'

export function LoginForm({ googleEnabled = false }: { googleEnabled?: boolean }) {
  const clientReady = useClientReady()
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get('callbackUrl')
  const providerError = searchParams.has('error')
  const registered = searchParams.get('registered') === 'true'
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const submitting = useRef(false)
  const alertRef = useRef<HTMLDivElement>(null)
  const { register, handleSubmit, formState: { errors } } = useForm<LoginInput>({ resolver: standardSchemaResolver(loginSchema), mode: 'onBlur', defaultValues: { rememberMe: false } })

  async function onSubmit(data: LoginInput) {
    if (submitting.current) return
    submitting.current = true
    setIsLoading(true)
    setError(null)
    try {
      await clearWorkspaceSelection().catch(() => undefined)
      // A failed or throttled attempt must never leave the previous account signed in behind the error message.
      try { if ((await getSession())?.user) await signOut({ redirect: false }) } catch { /* nothing to sign out */ }
      const result = await signIn('credentials', { email: data.email, password: data.password, rememberMe: data.rememberMe ? 'true' : 'false', redirect: false })
      if (result?.code?.startsWith('rate_limited')) {
        const minutes = Number(result.code.split(':')[1])
        setError(`Too many sign-in attempts. Please try again in ${minutes > 0 ? `${minutes} ${minutes === 1 ? 'minute' : 'minutes'}` : 'a few minutes'}. You are not signed in.`)
      }
      else if (!result || result.error) setError('We could not sign you in. Check your email and password, or try again in a moment.')
      else {
        const session = await getSession()
        if (!session?.accessToken || !session.user.id) setError('Your session could not be established. Please try again.')
        else { router.refresh(); window.location.assign(isSafeCallbackUrl(callbackUrl) ? resolvePostLoginPath(session, callbackUrl) : '/') }
      }
    } catch { setError('Sign-in is unavailable right now. Your details are still here; please try again.') }
    finally { submitting.current = false; setIsLoading(false); requestAnimationFrame(() => alertRef.current?.focus()) }
  }

  return (
    <div className="space-y-6">
      {providerError && <p role="alert" className="rounded-xl border border-destructive/30 p-4 text-sm">Sign-in could not be completed. Try again or use your email and password.</p>}
      {registered && <p role="status" className="rounded-xl border bg-muted p-4 text-sm">Your account was created. Log in to continue.</p>}
      {googleEnabled && <><SocialButtons isLoading={!clientReady || isLoading} enabled callbackUrl={callbackUrl} /><AuthDivider /></>}
      {error && <div ref={alertRef} role="alert" tabIndex={-1} className="flex items-center gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-4 focus:outline-2 focus:outline-ring"><CoCharacter state="encouraging" band="kids" size={56} decorative /><p className="text-sm">{error}</p></div>}
      <form method="post" onSubmit={handleSubmit(onSubmit)} className="space-y-5" aria-busy={isLoading} noValidate>
        <div className="space-y-2"><Label htmlFor="email">Email</Label><Input {...register('email')} id="email" type="email" autoComplete="email" autoCapitalize="none" className="h-12" placeholder="you@example.com" aria-invalid={!!errors.email} aria-describedby={errors.email ? 'email-error' : undefined} disabled={!clientReady || isLoading} />{errors.email && <p id="email-error" className="text-sm text-destructive">{errors.email.message}</p>}</div>
        <PasswordField {...register('password')} id="password" label="Password" autoComplete="current-password" error={errors.password?.message} disabled={!clientReady || isLoading} />
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm"><label className="flex min-h-11 cursor-pointer items-center gap-2"><input {...register('rememberMe')} type="checkbox" disabled={!clientReady || isLoading} className="size-5 accent-primary" />Remember me</label><Link href="/forgot-password" className="py-3 font-semibold text-primary">Forgot password?</Link></div>
        <Button type="submit" className="h-12 w-full text-base font-bold" disabled={!clientReady || isLoading}>{isLoading ? 'Signing in…' : error ? 'Try signing in again' : 'Log in'}</Button>
        <p role="status" className="sr-only">{isLoading ? 'Signing in. Please wait.' : ''}</p>
      </form>
      <p className="text-center text-sm text-muted-foreground">New to CoLearner? <Link href={`/signup?callbackUrl=${encodeURIComponent(isSafeCallbackUrl(callbackUrl) ? callbackUrl : "/age")}`} className="font-semibold text-primary">Create an account</Link></p>
    </div>
  )
}
