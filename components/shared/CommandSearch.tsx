'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { useProfile } from '@/lib/hooks/use-profile'
import { ageBandFromDateOfBirth, studentNavigation } from '@/components/roles/role-config'

export function CommandSearch() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const router = useRouter()
  const { data: profile } = useProfile()
  const knownBand = ageBandFromDateOfBirth(profile?.dateOfBirth)
  const navItems = useMemo(
    () => studentNavigation(knownBand ?? 'teens', !!knownBand).flatMap((group) => group.items),
    [knownBand],
  )

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
    [navItems, query]
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
        type="button"
        aria-label="Search pages"
        onClick={() => setOpen(true)}
        className="flex min-h-[var(--ds-target,44px)] items-center gap-1.5 rounded-lg border border-border bg-accent/50 px-3.5 py-1.5 text-xs text-muted-foreground motion-safe:transition-colors hover:border-muted-foreground"
      >
        <Search aria-hidden="true" className="h-3.5 w-3.5" />
        <span>Search...</span>
        <kbd className="ms-1 hidden rounded border border-border bg-card px-1 py-0.5 font-mono text-[9px] sm:block">
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
          <DialogTitle className="sr-only">Search pages</DialogTitle>
          <DialogDescription className="sr-only">Find a page in your learning workspace.</DialogDescription>
          <div className="flex items-center gap-2 border-b border-border px-3">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              autoFocus
              aria-label="Search pages"
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
