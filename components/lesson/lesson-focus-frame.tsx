'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AgeBandScope } from '@/components/design-system'
import type { LearnBand } from '@/lib/api/learn'

/**
 * Focused mode: the lesson fills the screen above the learner shell, so the navigation is not shown.
 * Everything else on the page is made inert while it is open, so keyboard and screen-reader users never land
 * in navigation they cannot see. Page scrolling is locked to the lesson and everything is restored on close.
 */
export function LessonFocusFrame({ band, label, children }: { band: LearnBand; label: string; children: ReactNode }) {
  const [host, setHost] = useState<HTMLElement | null>(null)
  useEffect(() => {
    const element = document.createElement('div')
    element.setAttribute('data-lesson-host', '')
    document.body.appendChild(element)
    const covered = [...document.body.children].filter(child => child !== element && child.tagName !== 'SCRIPT' && !child.hasAttribute('inert'))
    covered.forEach(child => child.setAttribute('inert', ''))
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    setHost(element)
    return () => {
      covered.forEach(child => child.removeAttribute('inert'))
      document.body.style.overflow = overflow
      element.remove()
    }
  }, [])
  if (!host) return null
  return createPortal(
    <AgeBandScope band={band} role="region" aria-label={label} data-lesson-frame="" className="fixed inset-0 z-[60] overflow-y-auto bg-background text-foreground [&_h1]:font-extrabold [&_h2]:font-bold [&_h3]:font-bold">{children}</AgeBandScope>,
    host,
  )
}
