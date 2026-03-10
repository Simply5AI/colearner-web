'use client'

import { useState } from 'react'
import Link from 'next/link'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import * as z from 'zod'
import { ArrowLeft, Loader2, Mail } from 'lucide-react'
import { useGoogleReCaptcha } from 'react-google-recaptcha-v3'

import { forgotPassword } from '@/lib/api/auth'
import { RecaptchaProvider } from '@/components/auth/recaptcha-provider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'

const formSchema = z.object({
  email: z.string().email('Please enter a valid email address.'),
})

function ForgotPasswordForm() {
  const [isSubmitSuccessful, setIsSubmitSuccessful] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { executeRecaptcha } = useGoogleReCaptcha()

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
    },
    mode: 'onBlur',
  })

  const { isSubmitting, errors } = form.formState

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setError(null)
    try {
      let recaptchaToken: string | undefined = undefined
      if (executeRecaptcha) {
        recaptchaToken = await executeRecaptcha('forgot_password')
      }
      await forgotPassword(values.email, recaptchaToken)
      setIsSubmitSuccessful(true)
    } catch (err: any) {
      console.error('Forgot password error:', err)
      setError(
        err?.message || 'Something went wrong. Please try again later.'
      )
    }
  }

  return (
    <div className="flex h-full items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8 animate-in fade-in zoom-in-95 duration-500">
        <div className="flex flex-col space-y-2 text-center">
          <Link
            href="/login"
            className="flex items-center text-sm font-medium text-muted-foreground hover:text-primary transition-colors mb-4 w-fit"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to login
          </Link>
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 mb-4">
            <Mail className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Forgot your password?
          </h1>
          <p className="text-sm text-muted-foreground">
            No worries, we'll send you reset instructions.
          </p>
        </div>

        {isSubmitSuccessful ? (
          <Alert className="bg-green-50 text-green-800 border-green-200 dark:bg-green-950/30 dark:text-green-400 dark:border-green-900">
            <AlertDescription className="flex items-start">
              <Mail className="h-5 w-5 mr-3 mt-0.5 shrink-0" />
              <span>
                <strong>Check your email!</strong> If there is an account associated with that email, we've sent you a password reset link. The link will expire in 1 hour.
              </span>
            </AlertDescription>
          </Alert>
        ) : (
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  placeholder="name@example.com"
                  type="email"
                  autoCapitalize="none"
                  autoComplete="email"
                  autoCorrect="off"
                  disabled={isSubmitting}
                  className="h-11"
                  {...form.register('email')}
                />
                {errors.email && (
                  <p className="text-sm text-destructive">{errors.email.message as string}</p>
                )}
              </div>

              <Button
                type="submit"
                className="w-full h-11 transition-all"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending link...
                  </>
                ) : (
                  'Reset password'
                )}
              </Button>
            </form>
        )}
      </div>
    </div>
  )
}

export default function ForgotPasswordPage() {
  return (
    <RecaptchaProvider>
      <ForgotPasswordForm />
    </RecaptchaProvider>
  )
}
