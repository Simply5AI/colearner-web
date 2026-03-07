'use client'

interface TopBarProps {
  title?: string
}

/** Top navigation bar placeholder */
export function TopBar({ title }: TopBarProps) {
  return (
    <header className="flex h-14 items-center border-b px-6">
      {title && <h1 className="text-lg font-semibold">{title}</h1>}
      <div className="ml-auto flex items-center gap-4">
        {/* TODO: NCUBadge, StreakCounter, UserMenu */}
      </div>
    </header>
  )
}
