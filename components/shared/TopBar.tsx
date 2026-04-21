'use client'

import Link from 'next/link'
import { Bell, Settings } from 'lucide-react'
import { CommandSearch } from '@/components/shared/CommandSearch'

interface TopBarProps {
  title: string
  subtitle?: string
  children?: React.ReactNode
}

export function TopBar({ title, subtitle, children }: TopBarProps) {
  return (
    <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border/50 bg-card px-7 py-4">
      <div>
        <h1 className="text-lg font-extrabold tracking-tight text-foreground">
          {title}
        </h1>
        {subtitle && (
          <p className="text-[11px] text-muted-foreground">{subtitle}</p>
        )}
      </div>
      <div className="flex items-center gap-2.5">
        {children}
        <CommandSearch />
        <Link
          href="/settings/notifications"
          className="relative flex h-[34px] w-[34px] items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:border-muted-foreground hover:text-foreground"
        >
          <Bell className="h-4 w-4" />
          <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-destructive" />
        </Link>
        <Link
          href="/settings"
          className="flex h-[34px] w-[34px] items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:border-muted-foreground hover:text-foreground"
        >
          <Settings className="h-4 w-4" />
        </Link>
      </div>
    </header>
  )
}
