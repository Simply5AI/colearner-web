'use client'

import { useState, type ComponentProps } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface PasswordFieldProps extends ComponentProps<typeof Input> { id: string; label: string; error?: string }

export function PasswordField({ id, label, error, className, ...props }: PasswordFieldProps) {
  const [visible, setVisible] = useState(false)
  function toggleVisibility() { setVisible((value) => !value) }
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input {...props} id={id} type={visible ? 'text' : 'password'} className={`h-12 pe-14 ${className ?? ''}`} aria-invalid={!!error} aria-describedby={error ? `${id}-error` : props['aria-describedby']} />
        <button type="button" onClick={toggleVisibility} disabled={props.disabled} aria-controls={id} aria-pressed={visible} aria-label={`${visible ? 'Hide' : 'Show'} ${label.toLowerCase()}`} className="absolute inset-y-0 end-0 flex w-12 items-center justify-center rounded-lg text-muted-foreground focus-visible:outline-2 focus-visible:outline-ring">
          {visible ? <EyeOff className="size-5" aria-hidden /> : <Eye className="size-5" aria-hidden />}
        </button>
      </div>
      {error && <p id={`${id}-error`} className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
