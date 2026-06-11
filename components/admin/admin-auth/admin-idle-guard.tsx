'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { adminLogout, adminMe } from '@/lib/api/admin-auth-client'

const IDLE_MS = 30 * 60 * 1000 // 30 minutes
const WARN_MS = 2 * 60 * 1000 // warn 2 minutes before logout
const SLIDE_INTERVAL_MS = 5 * 60 * 1000 // refresh the session at most every 5 min
const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart'] as const

/**
 * Enforces a 30-minute idle timeout on the admin surface: warns at 28 minutes
 * with a live countdown, then signs the operator out. Activity slides both the
 * web cookie and the backend Redis session via the `/me` probe.
 */
export function AdminIdleGuard() {
  const router = useRouter()
  const lastActivity = useRef(Date.now())
  const lastSlide = useRef(Date.now())
  const [remaining, setRemaining] = useState<number | null>(null)
  const loggingOut = useRef(false)

  const signOut = useCallback(async () => {
    if (loggingOut.current) return
    loggingOut.current = true
    await adminLogout().catch(() => undefined)
    router.replace('/admin/login')
  }, [router])

  const registerActivity = useCallback(() => {
    lastActivity.current = Date.now()
    if (Date.now() - lastSlide.current >= SLIDE_INTERVAL_MS) {
      lastSlide.current = Date.now()
      adminMe().catch(() => undefined)
    }
  }, [])

  useEffect(() => {
    const onActivity = () => {
      if (remaining === null) registerActivity()
    }
    ACTIVITY_EVENTS.forEach((evt) => window.addEventListener(evt, onActivity, { passive: true }))
    return () => {
      ACTIVITY_EVENTS.forEach((evt) => window.removeEventListener(evt, onActivity))
    }
  }, [registerActivity, remaining])

  useEffect(() => {
    const tick = setInterval(() => {
      const elapsed = Date.now() - lastActivity.current
      if (elapsed >= IDLE_MS) {
        setRemaining(0)
        void signOut()
      } else if (elapsed >= IDLE_MS - WARN_MS) {
        setRemaining(Math.ceil((IDLE_MS - elapsed) / 1000))
      } else {
        setRemaining(null)
      }
    }, 1000)
    return () => clearInterval(tick)
  }, [signOut])

  const staySignedIn = async () => {
    lastActivity.current = Date.now()
    lastSlide.current = Date.now()
    setRemaining(null)
    await adminMe().catch(() => undefined)
  }

  const open = remaining !== null && remaining > 0
  const mm = open ? Math.floor((remaining as number) / 60) : 0
  const ss = open ? (remaining as number) % 60 : 0

  return (
    <Dialog open={open}>
      <DialogContent className="sm:max-w-sm" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-amber-500" />
            Still there?
          </DialogTitle>
          <DialogDescription>
            You&apos;ll be signed out in{' '}
            <span className="font-semibold tabular-nums text-foreground">
              {mm}:{ss.toString().padStart(2, '0')}
            </span>{' '}
            due to inactivity.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => void signOut()}>
            Sign out
          </Button>
          <Button onClick={() => void staySignedIn()}>Stay signed in</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
