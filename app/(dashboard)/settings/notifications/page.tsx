import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Notifications',
}

export default function NotificationsPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold">Notification Preferences</h1>
      <p className="mt-2 text-muted-foreground">
        Configure push, email, and quiet hours settings.
      </p>
      {/* TODO: NotificationPrefs component */}
    </div>
  )
}
