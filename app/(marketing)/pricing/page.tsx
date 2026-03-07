import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Pricing',
}

export default function PricingPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center">
      <h1 className="text-3xl font-bold">Pricing</h1>
      <p className="mt-4 text-muted-foreground">Coming soon</p>
    </div>
  )
}
