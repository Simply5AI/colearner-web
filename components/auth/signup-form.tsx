'use client'

import { useRef, useState } from 'react'
import { useForm, useWatch, Controller } from 'react-hook-form'
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { User, Mail, Lock, Eye, EyeOff, Check } from 'lucide-react'

import { signupSchema, type SignupInput } from '@/lib/validators/auth'
import { getPasswordStrength } from '@/lib/utils/password-strength'
import { registerUser } from '@/lib/api/auth'
import { ApiError } from '@/lib/api/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { SocialButtons } from '@/components/auth/social-buttons'
import { AuthDivider } from '@/components/auth/auth-divider'
import { PasswordStrengthMeter } from '@/components/auth/password-strength-meter'
import { cn } from '@/lib/utils'

export function SignupForm() {
  const router = useRouter()
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const isSubmittingRef = useRef(false)

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, dirtyFields, touchedFields, isSubmitting },
  } = useForm<SignupInput>({
    resolver: standardSchemaResolver(signupSchema),
    mode: 'onBlur',
    defaultValues: {
      acceptTerms: false as unknown as true,
    },
  })

  const passwordValue = useWatch({ control, name: 'password', defaultValue: '' })
  const passwordStrength = getPasswordStrength(passwordValue)

  const isFieldValid = (field: keyof SignupInput) =>
    touchedFields[field] && dirtyFields[field] && !errors[field]

  const onSubmit = async (data: SignupInput) => {
    // Prevent duplicate submissions before state updates disable the form.
    if (isSubmittingRef.current) return
    isSubmittingRef.current = true

    setIsLoading(true)
    setError(null)

    try {
      await registerUser({
        name: data.name,
        email: data.email,
        password: data.password,
        acceptedTerms: true,
      })

      // Auto-login after successful registration
      const result = await signIn('credentials', {
        email: data.email,
        password: data.password,
        redirect: false,
      })

      if (result?.error) {
        // Registration succeeded but auto-login failed
        router.push('/login?registered=true')
      } else {
        router.push('/onboarding/profile')
      }
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 400) {
          setError(err.message || 'Email is already registered.')
        } else if (err.status === 429) {
          setError('Too many requests. Please try again later.')
        } else {
          setError(err.message)
        }
      } else {
        setError('Something went wrong. Please try again.')
      }
    } finally {
      setIsLoading(false)
      isSubmittingRef.current = false
    }
  }

  return (
    <div className="space-y-6">
      <SocialButtons isLoading={isLoading} />

      <AuthDivider />

      {error && (
        <div className="flex items-center gap-3 p-3.5 bg-destructive/5 border border-destructive/15 rounded-lg">
          <span className="text-lg shrink-0">&#9888;&#65039;</span>
          <div>
            <p className="text-[13px] font-bold text-destructive">Registration failed</p>
            <p className="text-[11px] text-muted-foreground">{error}</p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {/* Full Name */}
        <div className="space-y-1.5">
          <Label htmlFor="name" className="text-xs font-semibold">
            Full Name
          </Label>
          <div className="relative">
            <User className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
            <Input
              {...register('name')}
              id="name"
              placeholder="Enter your full name"
              className={cn(
                'pl-11 h-11',
                isFieldValid('name') && 'border-success focus-visible:border-success'
              )}
              aria-invalid={!!errors.name}
              disabled={isLoading}
            />
            {isFieldValid('name') && (
              <Check className="absolute right-3.5 top-1/2 -translate-y-1/2 size-4 text-success" />
            )}
          </div>
          {errors.name && (
            <p className="text-[11px] text-destructive">{errors.name.message}</p>
          )}
        </div>

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
              className={cn(
                'pl-11 h-11',
                isFieldValid('email') && 'border-success focus-visible:border-success'
              )}
              aria-invalid={!!errors.email}
              disabled={isLoading}
            />
            {isFieldValid('email') && (
              <Check className="absolute right-3.5 top-1/2 -translate-y-1/2 size-4 text-success" />
            )}
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
              placeholder="Min. 8 characters"
              className={cn(
                'pl-11 pr-11 h-11',
                isFieldValid('password') && 'border-success focus-visible:border-success'
              )}
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
          <PasswordStrengthMeter strength={passwordStrength} />
          {errors.password && (
            <p className="text-[11px] text-destructive">{errors.password.message}</p>
          )}
        </div>

        {/* Confirm Password */}
        <div className="space-y-1.5">
          <Label htmlFor="confirmPassword" className="text-xs font-semibold">
            Confirm Password
          </Label>
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
            <Input
              {...register('confirmPassword')}
              id="confirmPassword"
              type={showConfirmPassword ? 'text' : 'password'}
              placeholder="Re-enter your password"
              className={cn(
                'pl-11 pr-11 h-11',
                isFieldValid('confirmPassword') && 'border-success focus-visible:border-success'
              )}
              aria-invalid={!!errors.confirmPassword}
              disabled={isLoading}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
              tabIndex={-1}
            >
              {showConfirmPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
          {errors.confirmPassword && (
            <p className="text-[11px] text-destructive">{errors.confirmPassword.message}</p>
          )}
        </div>

        {/* Terms */}
        <div className="flex items-start gap-2.5">
          <Controller
            name="acceptTerms"
            control={control}
            render={({ field }) => (
              <Checkbox
                checked={field.value === true}
                onCheckedChange={(checked) => field.onChange(checked === true ? true : false)}
                className="mt-0.5"
                aria-invalid={!!errors.acceptTerms}
              />
            )}
          />
          <span className="text-xs text-muted-foreground leading-relaxed">
            I agree to the{' '}
            <Link href="/terms" className="font-semibold text-brand-orange hover:underline">
              Terms of Service
            </Link>{' '}
            and{' '}
            <Link href="/privacy" className="font-semibold text-brand-orange hover:underline">
              Privacy Policy
            </Link>
          </span>
        </div>
        {errors.acceptTerms && (
          <p className="text-[11px] text-destructive -mt-3">{errors.acceptTerms.message}</p>
        )}

        {/* Submit */}
        <Button
          type="submit"
          className="w-full h-12 text-sm font-bold bg-brand-orange hover:bg-brand-orange-dark text-white shadow-[0_2px_8px_rgba(196,98,26,0.2)]"
          disabled={isLoading || isSubmitting}
        >
          {isLoading ? 'Creating account...' : 'Create Account'}
        </Button>
      </form>

      <p className="text-center text-[13px] text-muted-foreground">
        Already have an account?{' '}
        <Link href="/login" className="font-bold text-brand-orange hover:underline">
          Sign In
        </Link>
      </p>
    </div>
  )
}
