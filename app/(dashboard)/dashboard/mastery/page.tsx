import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Mastery Ledger',
}

export default function MasteryPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold">Mastery Ledger</h1>
      <p className="mt-2 text-muted-foreground">
        Track your concept mastery and SM-2 states.
      </p>
      {/* TODO: MasteryLedger component */}
    </div>
  )
}
