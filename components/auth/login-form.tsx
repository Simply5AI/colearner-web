'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema'
import { getSession, signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Mail, Lock, Eye, EyeOff, AlertCircle } from 'lucide-react'

import { loginSchema, type LoginInput } from '@/lib/validators/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import { SocialButtons } from '@/components/auth/social-buttons'
import { AuthDivider } from '@/components/auth/auth-divider'
import { resolvePostLoginPath } from '@/lib/auth/post-login'

export function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get('callbackUrl')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [attempts, setAttempts] = useState(0)
  const [isLoading, setIsLoading] = useState(false)

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: standardSchemaResolver(loginSchema),
    mode: 'onBlur',
    defaultValues: {
      rememberMe: false,
    },
  })

  const rememberMe = watch('rememberMe')

  const onSubmit = async (data: LoginInput) => {
    setIsLoading(true)
    setError(null)

    try {
      const result = await signIn('credentials', {
        email: data.email,
        password: data.password,
        rememberMe: data.rememberMe ? 'true' : 'false',
        redirect: false,
      })

      if (result?.error) {
        const newAttempts = attempts + 1
        setAttempts(newAttempts)
        if (newAttempts >= 5) {
          setError('Too many login attempts. Please try again in 15 minutes.')
        } else {
          setError(`The email or password you entered is incorrect. ${5 - newAttempts} attempt${5 - newAttempts === 1 ? '' : 's'} remaining.`)
        }
      } else {
        router.refresh()
        const session = await getSession()
        window.location.assign(resolvePostLoginPath(session, callbackUrl))
      }
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <SocialButtons isLoading={isLoading} />

      <AuthDivider />

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertTitle>Invalid credentials</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {/* Email */}
        <div className="space-y-1.5">
          <Label htmlFor="email" className="text-xs font-semibold">
            Email
          </Label>
          <div className="relative">
            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
            <Input
              {...register('email')}
              id="email"
              type="email"
              placeholder="you@example.com"
              className="pl-11 h-11"
              aria-invalid={!!errors.email}
              disabled={isLoading}
            />
          </div>
          {errors.email && (
            <p className="text-[11px] text-destructive">{errors.email.message}</p>
          )}
        </div>

        {/* Password */}
        <div className="space-y-1.5">
          <Label htmlFor="password" className="text-xs font-semibold">
            Password
          </Label>
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
            <Input
              {...register('password')}
              id="password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Enter your password"
              className="pl-11 pr-11 h-11"
              aria-invalid={!!errors.password}
              disabled={isLoading}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              tabIndex={-1}
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
          {errors.password && (
            <p className="text-[11px] text-destructive">{errors.password.message}</p>
          )}
        </div>

        {/* Remember me + Forgot password */}
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground cursor-pointer">
            <Checkbox
              checked={rememberMe ?? false}
              onCheckedChange={(checked) => setValue('rememberMe', !!checked)}
            />
            Remember me
          </label>
          <Link
            href="/forgot-password"
            className="text-xs font-semibold text-brand-orange hover:underline"
          >
            Forgot password?
          </Link>
        </div>

        {/* Submit */}
        <Button
          type="submit"
          className="w-full h-12 text-sm font-bold bg-brand-orange hover:bg-brand-orange-dark text-white shadow-[0_2px_8px_rgba(196,98,26,0.2)]"
          disabled={isLoading || attempts >= 5}
        >
          {isLoading ? 'Signing in...' : 'Sign In'}
        </Button>
      </form>

      <p className="text-center text-[13px] text-muted-foreground">
        Don&apos;t have an account?{' '}
        <Link href="/signup" className="font-bold text-brand-orange hover:underline">
          Sign Up
        </Link>
      </p>
    </div>
  )
}
