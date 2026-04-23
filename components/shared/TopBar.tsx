'use client'

import Link from 'next/link'
import { Bell } from 'lucide-react'
import { CommandSearch } from '@/components/shared/CommandSearch'
import { UserMenu } from '@/components/shared/UserMenu'

interface TopBarProps {
  title: string
  subtitle?: string
  children?: React.ReactNode
}

export function TopBar({ title, subtitle, children }: TopBarProps) {
  return (
    <header className="sticky top-0 z-10 border-b border-border/60 bg-card/95 px-5 py-4 backdrop-blur md:px-7">
      <div className="flex w-full items-center justify-between">
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
          <UserMenu />
        </div>
      </div>
    </header>
  )
}
