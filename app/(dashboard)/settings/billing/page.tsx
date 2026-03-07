import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Billing',
}

export default function BillingPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold">Billing</h1>
      <p className="mt-2 text-muted-foreground">
        Manage your subscription and payment method.
      </p>
      {/* TODO: BillingSection component */}
    </div>
  )
}
