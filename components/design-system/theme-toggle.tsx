'use client'

import { useSyncExternalStore } from 'react'
import { Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import { Button } from './primitives'

const subscribe = () => () => {}
const clientSnapshot = () => true
const serverSnapshot = () => false

export const ThemeToggle = () => {
  const mounted = useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot)
  const { resolvedTheme, setTheme } = useTheme()
  const dark = mounted && resolvedTheme === 'dark'
  const toggle = () => setTheme(dark ? 'light' : 'dark')
  return <Button variant="ghost" onClick={toggle} disabled={!mounted} aria-label={dark ? 'Use light theme' : 'Use dark theme'} title={dark ? 'Use light theme' : 'Use dark theme'}>{dark ? <Sun size={20} aria-hidden="true" /> : <Moon size={20} aria-hidden="true" />}</Button>
}
