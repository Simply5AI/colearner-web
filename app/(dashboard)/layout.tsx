import { AppSidebar } from '@/components/shared/AppSidebar'
import { GlobalGamificationEvents } from '@/components/shared/global-gamification-events'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen">
      <AppSidebar />
      <main className="flex-1 overflow-y-auto bg-background">{children}</main>
      <GlobalGamificationEvents />
    </div>
  )
}
