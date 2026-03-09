'use client'

import { Search, Bell, Settings } from 'lucide-react'

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
        <button className="flex items-center gap-1.5 rounded-lg border border-border bg-accent/50 px-3.5 py-1.5 text-xs text-muted-foreground transition-colors hover:border-muted-foreground">
          <Search className="h-3.5 w-3.5" />
          <span>Search...</span>
          <kbd className="ml-1 rounded border border-border bg-card px-1 py-0.5 font-mono text-[9px]">
            ⌘K
          </kbd>
        </button>
        <button className="relative flex h-[34px] w-[34px] items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:border-muted-foreground hover:text-foreground">
          <Bell className="h-4 w-4" />
          <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-destructive" />
        </button>
        <button className="flex h-[34px] w-[34px] items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:border-muted-foreground hover:text-foreground">
          <Settings className="h-4 w-4" />
        </button>
      </div>
    </header>
  )
}
