'use client'

import { useRef, type ClipboardEvent, type KeyboardEvent } from 'react'
import { cn } from '@/lib/utils'

interface OtpInputProps {
  value: string
  onChange: (value: string) => void
  length?: number
  disabled?: boolean
  autoFocus?: boolean
  /** Fired when all cells are filled (e.g. to auto-submit). */
  onComplete?: (value: string) => void
}

/**
 * Reusable segmented numeric OTP input for the admin TOTP flows
 * (login challenge, first-time setup verify, sensitive-action re-auth).
 */
export function OtpInput({
  value,
  onChange,
  length = 6,
  disabled = false,
  autoFocus = true,
  onComplete,
}: OtpInputProps) {
  const refs = useRef<Array<HTMLInputElement | null>>([])

  const digits = Array.from({ length }, (_, i) => value[i] ?? '')

  const emit = (next: string) => {
    onChange(next)
    if (next.length === length && !next.includes(' ')) onComplete?.(next)
  }

  const setDigit = (index: number, digit: string) => {
    const chars = value.split('')
    chars[index] = digit
    const next = chars.join('').slice(0, length)
    emit(next)
    if (digit && index < length - 1) refs.current[index + 1]?.focus()
  }

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      refs.current[index - 1]?.focus()
    } else if (e.key === 'ArrowLeft' && index > 0) {
      refs.current[index - 1]?.focus()
    } else if (e.key === 'ArrowRight' && index < length - 1) {
      refs.current[index + 1]?.focus()
    }
  }

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length)
    if (!pasted) return
    emit(pasted)
    refs.current[Math.min(pasted.length, length - 1)]?.focus()
  }

  return (
    <div className="flex justify-center gap-2" role="group" aria-label="One-time code">
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(el) => {
            refs.current[index] = el
          }}
          type="text"
          inputMode="numeric"
          autoComplete={index === 0 ? 'one-time-code' : 'off'}
          maxLength={1}
          value={digit}
          disabled={disabled}
          autoFocus={autoFocus && index === 0}
          onChange={(e) => {
            const d = e.target.value.replace(/\D/g, '').slice(-1)
            setDigit(index, d)
          }}
          onKeyDown={(e) => handleKeyDown(index, e)}
          onPaste={handlePaste}
          className={cn(
            'h-12 w-11 rounded-lg border border-input bg-background text-center text-lg font-semibold tabular-nums shadow-sm outline-none transition',
            'focus:border-primary focus:ring-2 focus:ring-primary/30',
            'disabled:cursor-not-allowed disabled:opacity-50'
          )}
          aria-label={`Digit ${index + 1}`}
        />
      ))}
    </div>
  )
}
