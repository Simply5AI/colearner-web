'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { motion } from 'framer-motion'

import { useOnboardingStore } from '@/lib/stores/onboarding-store'
import { useCompleteOnboarding } from '@/lib/hooks/use-onboarding'
import { cn } from '@/lib/utils'

const CONFETTI_COLORS = [
  'bg-brand-orange',
  'bg-brand-teal',
  'bg-brand-blue',
  'bg-brand-purple',
  'bg-[#2E6B3E]',
  'bg-brand-orange-hover',
]

const LEARNING_STATES = [
  { label: 'Explore', emoji: '\u{1F9ED}', active: true, colorClass: 'bg-brand-teal-bg text-brand-teal' },
  { label: 'Learn', emoji: '\u{1F682}', active: true, colorClass: 'bg-brand-blue-bg text-brand-blue' },
  { label: 'Locked', emoji: '\u{1F331}', active: false, colorClass: 'bg-white/5 text-white/20' },
  { label: 'Locked', emoji: '\u{1F3C6}', active: false, colorClass: 'bg-white/5 text-white/20' },
]

export function WelcomeCelebration() {
  const router = useRouter()
  const { data: session, update } = useSession()
  const store = useOnboardingStore()
  const completeMutation = useCompleteOnboarding()

  const displayName = store.displayName || session?.user?.name || 'Learner'
  const topicCount = store.selectedSkills.length
  const dailyGoal = store.dailyGoalMinutes

  // If user skipped all steps (no data in store), submit defaults
  useEffect(() => {
    if (!store.goal && !store.displayName && store.selectedSkills.length === 0) {
      completeMutation.mutate({
        name: session?.user?.name || 'Learner',
        goals: ['build_knowledge'],
        dailyGoalMinutes: 15,
        skillsInterests: [],
      })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleStart = async () => {
    // Refresh session so middleware sees onboardingCompleted: true
    await update({ onboardingCompleted: true })
    store.reset()
    router.push('/dashboard')
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-[#1C1410] via-[#0F0D0B] to-[#1A120E] px-6 text-center">
      {/* Animated rings */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        {[300, 460, 620].map((size, i) => (
          <div
            key={size}
            className={cn(
              'absolute rounded-full border border-brand-orange/8',
              i === 0 && 'animate-pulse-ring-1 border-brand-orange/12',
              i === 1 && 'animate-pulse-ring-2',
              i === 2 && 'animate-pulse-ring-3'
            )}
            style={{ width: size, height: size }}
          />
        ))}
      </div>

      {/* Confetti */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {Array.from({ length: 18 }, (_, i) => (
          <motion.div
            key={i}
            className={cn(
              'absolute rounded-sm',
              CONFETTI_COLORS[i % CONFETTI_COLORS.length],
              i % 3 === 0 ? 'h-2 w-2' : i % 3 === 1 ? 'h-1.5 w-2.5' : 'h-2.5 w-1.5'
            )}
            initial={{
              top: '-5%',
              left: `${5 + (i * 90) / 18}%`,
              rotate: 0,
              opacity: 1,
            }}
            animate={{
              top: '105%',
              rotate: 540 + Math.random() * 360,
              opacity: 0,
            }}
            transition={{
              duration: 3 + Math.random() * 2,
              delay: i * 0.15,
              ease: 'easeOut',
              repeat: Infinity,
              repeatDelay: 1,
            }}
          />
        ))}
      </div>

      {/* Content */}
      <motion.div
        className="relative z-10 max-w-[480px]"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        {/* Badge */}
        <p className="mb-6 text-[10px] font-bold uppercase tracking-[0.12em] text-brand-orange-hover">
          Source 1 Unlocked
        </p>

        {/* Circle */}
        <motion.div
          className="mx-auto mb-7 size-[120px]"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', delay: 0.2, stiffness: 200 }}
        >
          <div className="flex size-full items-center justify-center rounded-full border-[3px] border-brand-orange/20 animate-[pulse-ring_2s_ease-in-out_infinite]">
            <div className="flex size-[88px] items-center justify-center rounded-full bg-gradient-to-br from-brand-orange to-brand-orange-hover shadow-[0_8px_24px_rgba(196,98,26,0.3)]">
              <span className="text-4xl font-black text-white">1</span>
            </div>
          </div>
        </motion.div>

        {/* Title */}
        <h1 className="mb-2 text-[32px] font-black tracking-tight text-white">
          You&apos;re all set, {displayName}!
        </h1>
        <p className="mx-auto mb-9 max-w-[360px] text-sm leading-relaxed text-white/40">
          Welcome to Source 1 — Beginner. Capture your first YouTube video and start building
          lasting knowledge.
        </p>

        {/* Stats */}
        <div className="mb-9 flex justify-center gap-8">
          <div>
            <p className="font-mono text-2xl font-bold text-brand-orange-hover">
              {topicCount || 0}
            </p>
            <p className="mt-0.5 text-[10px] uppercase tracking-wider text-white/30">Topics</p>
          </div>
          <div>
            <p className="font-mono text-2xl font-bold text-brand-orange-hover">
              {dailyGoal}m
            </p>
            <p className="mt-0.5 text-[10px] uppercase tracking-wider text-white/30">Daily Goal</p>
          </div>
          <div>
            <p className="font-mono text-2xl font-bold text-brand-orange-hover">0</p>
            <p className="mt-0.5 text-[10px] uppercase tracking-wider text-white/30">Streak</p>
          </div>
        </div>

        {/* Learning states */}
        <div className="mb-10 flex flex-wrap justify-center gap-2.5">
          {LEARNING_STATES.map((state, i) => (
            <span
              key={i}
              className={cn(
                'flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[11px] font-bold',
                state.colorClass
              )}
            >
              {state.emoji} {state.label}
            </span>
          ))}
        </div>

        {/* CTA */}
        <button
          onClick={handleStart}
          className="rounded-xl bg-gradient-to-r from-brand-orange to-brand-orange-hover px-12 py-4 text-[15px] font-extrabold text-white shadow-[0_4px_16px_rgba(196,98,26,0.3)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(196,98,26,0.4)]"
        >
          Start Learning &rarr;
        </button>
        <p className="mt-4 text-[11px] text-white/25">
          Paste a YouTube URL to capture your first video
        </p>
      </motion.div>
    </div>
  )
}
