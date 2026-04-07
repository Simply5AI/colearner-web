'use client'

import { Suspense } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SourceTab } from '@/components/practice/source-tab'
import { QueueTab } from '@/components/practice/queue-tab'

const tabs = [
  { key: 'sources', label: 'By Source' },
  { key: 'queue', label: 'Due for Review' },
] as const

type TabKey = (typeof tabs)[number]['key']

function PracticePageInner() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const activeTab = (searchParams.get('tab') as TabKey) || 'sources'

  function switchTab(tab: TabKey) {
    const params = new URLSearchParams(searchParams.toString())
    // Clear filters when switching tabs
    params.delete('topic')
    params.delete('source')
    params.delete('type')
    params.delete('failed')
    params.set('tab', tab)
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <div className="p-7">
      {/* Tab switcher */}
      <div className="mb-6 flex gap-1.5 rounded-lg border border-border bg-accent/30 p-1 w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => switchTab(tab.key)}
            className={cn(
              'rounded-md px-4 py-1.5 text-xs font-semibold transition-colors',
              activeTab === tab.key
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'sources' ? <SourceTab /> : <QueueTab />}
    </div>
  )
}

export function PracticePageClient() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading...
        </div>
      }
    >
      <PracticePageInner />
    </Suspense>
  )
}
