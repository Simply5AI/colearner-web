import { AppSidebar } from '@/components/shared/AppSidebar'
import { GlobalGamificationEvents } from '@/components/shared/global-gamification-events'
import { TeacherModeBanner } from '@/components/shared/teacher-mode-banner'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen">
      <AppSidebar />
      <div className="flex min-h-screen flex-1 flex-col overflow-hidden">
        <TeacherModeBanner />
        <main className="flex-1 overflow-y-auto bg-background">{children}</main>
      </div>
      <GlobalGamificationEvents />
    </div>
  )
}
