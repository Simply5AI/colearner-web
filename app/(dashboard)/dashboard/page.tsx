import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Dashboard',
}

export default function DashboardPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <p className="mt-2 text-muted-foreground">
        Welcome back! Your learning overview will appear here.
      </p>
      {/* TODO: DashboardOverview, DueItemsList, StreakCounter */}
    </div>
  )
}
