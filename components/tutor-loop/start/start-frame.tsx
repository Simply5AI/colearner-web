'use client'

import Link from 'next/link'
import { X } from 'lucide-react'
import { AgeBandScope } from '@/components/design-system/age-band-scope'
import { BrandMark } from '@/components/design-system/brand-mark'

export const primaryButton = 'ds-button ds-button-primary w-full min-h-[54px]'

export function TutorStartFrame({ children, adult, close, step }: {
  children: React.ReactNode; adult: boolean; close?: string; step?: number
}) {
  return (
    <AgeBandScope band={adult ? 'adults' : 'teens'} className="flex min-h-dvh flex-col bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex min-h-[66px] max-w-[1200px] items-center gap-4 px-5">
          <BrandMark className="me-auto text-[23px]" />
          {step && <div className="flex gap-1.5" aria-label={`Step ${step} of 5`}>
            {[1, 2, 3, 4, 5].map((index) => <span key={index} className={`h-2 rounded-full ${index === step ? 'w-7' : 'w-2'} ${index <= step ? 'bg-primary' : 'bg-border'}`} />)}
          </div>}
          {close && <Link aria-label="Close" href={close} className="grid size-11 place-items-center rounded-full border border-border"><X size={18} aria-hidden /></Link>}
        </div>
      </header>
      {children}
    </AgeBandScope>
  )
}

export type TutorArtState = 'idle' | 'speaking' | 'thinking' | 'celebrating' | 'resting' | 'concerned' | 'asking'

export function TutorArt({ icon, size, state = 'idle' }: { icon: string; size: number; state?: TutorArtState }) {
  return <img src={`/tutor-loop/${icon.toLowerCase()}-${state}.svg`} alt="" width={size} height={size} className="shrink-0" />
}
