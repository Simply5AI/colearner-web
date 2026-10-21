'use client'

import { useId, type ButtonHTMLAttributes, type HTMLAttributes, type InputHTMLAttributes, type SelectHTMLAttributes, type ReactNode } from 'react'
import { AlertCircle, CheckCircle2, Circle, CircleHelp, LockKeyhole, Sparkles, Timer } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CoCharacter } from './co-character'
import type { AgeBand } from './tokens'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> { variant?: 'primary' | 'secondary' | 'ghost'; loading?: boolean }
export const Button = ({ variant = 'primary', loading = false, disabled, children, className, type = 'button', ...props }: ButtonProps) => (
  <button {...props} type={type} disabled={disabled || loading} aria-busy={loading || undefined} className={cn('ds-button', `ds-button-${variant}`, className)}>{loading && <span aria-hidden="true" className="ds-spinner" />}{children}</button>
)
export const Card = ({ className, ...props }: HTMLAttributes<HTMLDivElement>) => <div {...props} className={cn('ds-card', className)} />

interface InputProps extends InputHTMLAttributes<HTMLInputElement> { label: string; hint?: string; error?: string }
export const Input = ({ label, hint, error, id, className, ...props }: InputProps) => {
  const generated = useId()
  const fieldId = id ?? generated
  const description = [hint ? `${fieldId}-hint` : undefined, error ? `${fieldId}-error` : undefined, props['aria-describedby']].filter(Boolean).join(' ') || undefined
  return <div className="ds-field"><label htmlFor={fieldId}>{label}</label><input {...props} id={fieldId} aria-invalid={error ? true : props['aria-invalid']} aria-describedby={description} className={cn('ds-input', className)} />{hint && <p id={`${fieldId}-hint`} className="ds-field-hint">{hint}</p>}{error && <p id={`${fieldId}-error`} className="ds-field-error"><AlertCircle aria-hidden="true" size={16} />{error}</p>}</div>
}
interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> { label: string }
export const Select = ({ label, id, className, ...props }: SelectProps) => {
  const generated = useId()
  const fieldId = id ?? generated
  return <div className="ds-field"><label htmlFor={fieldId}>{label}</label><select {...props} id={fieldId} className={cn('ds-input', className)} /></div>
}
interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> { label: ReactNode }
export const Checkbox = ({ label, id, className, ...props }: CheckboxProps) => {
  const generated = useId()
  return <label htmlFor={id ?? generated} className={cn('ds-choice', className)}><input {...props} id={id ?? generated} type="checkbox" /><span>{label}</span></label>
}
interface ToggleProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onChange' | 'role'> { checked: boolean; onCheckedChange: (checked: boolean) => void; label: string }
export const Toggle = ({ checked, onCheckedChange, label, className, ...props }: ToggleProps) => {
  const toggle = () => onCheckedChange(!checked)
  return <button {...props} type="button" role="switch" aria-checked={checked} aria-label={label} onClick={toggle} className={cn('ds-toggle-control', className)}><span>{label}</span><span className="ds-toggle-track" aria-hidden="true"><span /></span></button>
}
interface ProgressBarProps { value: number; max?: number; label: string; className?: string }
export const ProgressBar = ({ value, max = 100, label, className }: ProgressBarProps) => {
  const limit = Number.isFinite(max) && max > 0 ? max : 100
  const current = Number.isFinite(value) ? Math.min(limit, Math.max(0, value)) : 0
  return <div className={cn('ds-progress', className)}><div className="ds-progress-label"><span>{label}</span><span>{Math.round(current)} of {limit}</span></div><div role="progressbar" aria-label={label} aria-valuenow={current} aria-valuemin={0} aria-valuemax={limit} className="ds-progress-track"><span style={{ width: `${current / limit * 100}%` }} /></div></div>
}
const mastery = { new: { label: 'New', icon: Circle }, learning: { label: 'Learning', icon: CircleHelp }, review: { label: 'Review', icon: Timer }, mastered: { label: 'Mastered', icon: CheckCircle2 }, excel: { label: 'Excel', icon: Sparkles } } as const
interface MasteryPillProps { state: keyof typeof mastery; className?: string }
export const MasteryPill = ({ state, className }: MasteryPillProps) => {
  const { label, icon: Icon } = mastery[state]
  return <span className={cn('ds-pill', `ds-mastery-${state}`, className)}><Icon size={16} aria-hidden="true" />{label}</span>
}
export const ParentLockBadge = () => <span className="ds-pill"><LockKeyhole size={16} aria-hidden="true" />Parent</span>

interface StateProps { title: string; description?: ReactNode; action?: ReactNode; band?: AgeBand; className?: string }
export const EmptyState = ({ title, description, action, band = 'teens', className }: StateProps) => <div className={cn('ds-state', className)}><CoCharacter band={band} state="curious" decorative /><h2>{title}</h2>{description && <p>{description}</p>}{action}</div>
export const ErrorState = ({ title, description, action, band = 'teens', className }: StateProps) => <div role="alert" className={cn('ds-state ds-error-state', className)}><CoCharacter band={band} state="encouraging" decorative /><h2>{title}</h2>{description && <p>{description}</p>}{action}</div>
interface LoadingStateProps { label?: string; className?: string }
export const LoadingState = ({ label = 'Loading…', className }: LoadingStateProps) => <div role="status" aria-live="polite" className={cn('ds-loading', className)}><span aria-hidden="true" className="ds-spinner" /><span>{label}</span></div>
export const Skeleton = ({ className, ...props }: HTMLAttributes<HTMLDivElement>) => <div {...props} aria-hidden="true" className={cn('ds-skeleton', className)} />
