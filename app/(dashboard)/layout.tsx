import { auth } from '@/lib/auth/config'
import { AppSidebar } from '@/components/shared/AppSidebar'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  let userName = 'User'
  let userEmail = ''
  let userInitials = 'U'

  try {
    const session = await auth()
    if (session?.user) {
      userName = session.user.name || 'User'
      userEmail = session.user.email || ''
      userInitials = userName
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    }
  } catch {
    // Auth not available — use defaults
  }

  return (
    <div className="flex min-h-screen">
      <AppSidebar
        userName={userName}
        userEmail={userEmail}
        userInitials={userInitials}
      />
      <main className="flex-1 overflow-y-auto bg-background">{children}</main>
    </div>
  )
}
