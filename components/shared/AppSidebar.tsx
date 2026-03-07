'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/dashboard/mastery', label: 'Mastery' },
  { href: '/dashboard/analytics', label: 'Analytics' },
  { href: '/dashboard/history', label: 'History' },
  { href: '/extract', label: 'Extract' },
  { href: '/settings', label: 'Settings' },
]

/** Dashboard sidebar navigation */
export function AppSidebar() {
  const pathname = usePathname()

  return (
    <nav className="flex flex-col gap-1 p-4">
      <h2 className="mb-4 text-lg font-bold text-primary">CoLearner</h2>
      {navItems.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={cn(
            'rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent',
            pathname === item.href
              ? 'bg-accent font-medium text-accent-foreground'
              : 'text-muted-foreground'
          )}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  )
}
