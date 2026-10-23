'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import styles from './landing.module.css'

/** Content stays visible without JavaScript or IntersectionObserver. Motion is decoration only. */
export function LandingMotion({ children }: { children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (typeof window.matchMedia !== 'function' || !('IntersectionObserver' in window)) return
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (preference.matches) return
    const sections = Array.from(root.current?.querySelectorAll<HTMLElement>('[data-reveal]') ?? [])
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) if (entry.isIntersecting) {
        (entry.target as HTMLElement).dataset.reveal = 'visible'
        observer.unobserve(entry.target)
      }
    }, { threshold: 0, rootMargin: '0px 0px -30px 0px' })
    for (const section of sections) {
      if (section.getBoundingClientRect().top > window.innerHeight) section.dataset.reveal = 'pending'
      observer.observe(section)
    }
    const revealAll = () => { sections.forEach(section => { section.dataset.reveal = 'visible' }); observer.disconnect() }
    preference.addEventListener('change', revealAll)
    return () => { revealAll(); preference.removeEventListener('change', revealAll) }
  }, [])
  return <div ref={root} className={styles.motion}>{children}</div>
}
