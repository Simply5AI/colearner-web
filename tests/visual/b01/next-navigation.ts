import { useSyncExternalStore } from 'react'

let pathname = new URLSearchParams(window.location.search).get('path') || '/dashboard'
const listeners = new Set<() => void>()
export function usePathname() {
  return useSyncExternalStore((listener) => { listeners.add(listener); return () => { listeners.delete(listener) } }, () => pathname)
}
export function navigateFixture(href: string) { pathname = href; listeners.forEach((listener) => listener()) }
