'use client'

import { signIn } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { GoogleIcon } from '@/components/icons/google-icon'

interface SocialButtonsProps {
  isLoading?: boolean
}

export function SocialButtons({ isLoading }: SocialButtonsProps) {
  const handleGoogleSignIn = () => {
    signIn('google', { callbackUrl: '/dashboard' })
  }

  return (
    <Button
      variant="outline"
      size="lg"
      className="w-full h-11 gap-2.5 text-[13px] font-semibold"
      onClick={handleGoogleSignIn}
      disabled={isLoading}
    >
      <GoogleIcon className="size-[18px]" />
      Continue with Google
    </Button>
  )
}
