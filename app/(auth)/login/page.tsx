import type { Metadata } from 'next'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export const metadata: Metadata = {
  title: 'Sign In',
}

export default function LoginPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Sign In</CardTitle>
        <CardDescription>
          Sign in to your CoLearner account
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* TODO: Login form with Google OAuth + email/password */}
        <p className="text-sm text-muted-foreground">Login form coming soon</p>
      </CardContent>
    </Card>
  )
}
