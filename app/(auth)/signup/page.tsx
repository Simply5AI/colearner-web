import type { Metadata } from 'next'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export const metadata: Metadata = {
  title: 'Sign Up',
}

export default function SignupPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Create Account</CardTitle>
        <CardDescription>
          Start your learning journey with CoLearner
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* TODO: Signup form */}
        <p className="text-sm text-muted-foreground">Signup form coming soon</p>
      </CardContent>
    </Card>
  )
}
