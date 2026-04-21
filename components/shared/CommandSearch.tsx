'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Search,
  Home,
  Download,
  BookOpen,
  Clock,
  BarChart3,
  Users,
  Trophy,
  Settings,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog'

interface NavItem {
  href: string
  label: string
  icon: React.ElementType
}

const navItems: NavItem[] = [
  { href: '/dashboard', label: 'Home', icon: Home },
  { href: '/capture', label: 'Library', icon: Download },
  { href: '/roadmaps', label: 'Study Plans', icon: BookOpen },
  { href: '/practice', label: 'Practice', icon: Clock },
  { href: '/mastery', label: 'Progress', icon: BarChart3 },
  { href: '/pods', label: 'Study Groups', icon: Users },
  { href: '/trophies', label: 'Achievements', icon: Trophy },
  { href: '/settings', label: 'Settings', icon: Settings },
]

export function CommandSearch() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const router = useRouter()

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const filtered = useMemo(
    () =>
      navItems.filter((item) =>
        item.label.toLowerCase().includes(query.toLowerCase())
      ),
    [query]
  )

  const navigate = useCallback(
    (href: string) => {
      setOpen(false)
      setQuery('')
      router.push(href)
    },
    [router]
  )

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-lg border border-border bg-accent/50 px-3.5 py-1.5 text-xs text-muted-foreground transition-colors hover:border-muted-foreground"
      >
        <Search className="h-3.5 w-3.5" />
        <span>Search...</span>
        <kbd className="ml-1 rounded border border-border bg-card px-1 py-0.5 font-mono text-[9px]">
          ⌘K
        </kbd>
      </button>

      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen)
          if (!nextOpen) setQuery('')
        }}
      >
        <DialogContent
          showCloseButton={false}
          className="top-[35%] gap-0 overflow-hidden p-0 sm:max-w-md"
        >
          <div className="flex items-center gap-2 border-b border-border px-3">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search pages..."
              className="flex-1 bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <div className="max-h-64 overflow-y-auto p-1">
            {filtered.length === 0 ? (
              <p className="px-3 py-4 text-center text-sm text-muted-foreground">
                No results found.
              </p>
            ) : (
              filtered.map((item) => {
                const Icon = item.icon
                return (
                  <button
                    key={item.href}
                    onClick={() => navigate(item.href)}
                    className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm text-foreground transition-colors hover:bg-accent"
                  >
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    {item.label}
                  </button>
                )
              })
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
