'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { User, CreditCard, Bell, Server, Brain } from 'lucide-react'
import { cn } from '@/lib/utils'
import { TopBar } from '@/components/shared/TopBar'

const settingsNav = [
  { href: '/settings/profile', label: 'Profile', icon: User },
  { href: '/settings/billing', label: 'Billing', icon: CreditCard },
  { href: '/settings/notifications', label: 'Notifications', icon: Bell },
  { href: '/settings/ai-processing', label: 'AI Processing', icon: Server },
  { href: '/settings/memory', label: 'Memory', icon: Brain },
]

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <>
      <TopBar title="Settings" subtitle="Manage your account settings and preferences." />
      <div className="mx-auto w-full max-w-3xl px-6 py-8">
        <nav className="flex gap-1 border-b border-border">
          {settingsNav.map((item) => {
            const active =
              pathname === item.href ||
              (item.href === '/settings/profile' && pathname === '/settings')
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors',
                  active
                    ? 'border-foreground text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="mt-6">{children}</div>
      </div>
    </>
  )
}
