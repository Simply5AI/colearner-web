'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { motion } from 'framer-motion'

import { useOnboardingStore } from '@/lib/stores/onboarding-store'
import { useCompleteOnboarding } from '@/lib/hooks/use-onboarding'
import { useProfile } from '@/lib/hooks/use-profile'
import { cn } from '@/lib/utils'
import type { LearningGoal } from '@/lib/types'

const CONFETTI_COLORS = [
  'bg-brand-orange',
  'bg-brand-teal',
  'bg-brand-blue',
  'bg-brand-purple',
  'bg-[#2E6B3E]',
  'bg-brand-orange-hover',
]

const GOAL_TAGLINES: Record<LearningGoal, string> = {
  build_knowledge: 'YOUR LEARNING JOURNEY BEGINS',
  retain_more: 'YOUR RETENTION PATH IS READY',
  exam_prep: 'YOUR EXAM PREP IS READY',
  career_growth: 'YOUR CAREER PATH IS READY',
}

const GOAL_LABELS: Record<LearningGoal, string> = {
  build_knowledge: 'Build Knowledge',
  retain_more: 'Retain More',
  exam_prep: 'Exam Prep',
  career_growth: 'Career Growth',
}

const GOAL_CTA_HELPER: Record<LearningGoal, string> = {
  build_knowledge: 'Capture a YouTube video to start building knowledge',
  retain_more: 'Capture a YouTube video to start building knowledge',
  exam_prep: 'Add your first study resource to start preparing',
  career_growth: 'Explore recommended resources for your goal',
}

const PILL_STYLES = [
  'bg-brand-teal-bg text-brand-teal',
  'bg-brand-blue-bg text-brand-blue',
  'bg-brand-orange/15 text-brand-orange-hover',
  'bg-brand-purple/15 text-brand-purple',
]

function prettify(value: string | null | undefined): string {
  if (!value) return ''
  return value
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function buildSubtitle(goalTitle: string, fieldOfStudy: string): string {
  if (goalTitle && fieldOfStudy) {
    return `Your plan for "${goalTitle}" in ${fieldOfStudy} is ready. Let's dive in.`
  }
  if (goalTitle) {
    return `Your plan for "${goalTitle}" is ready. Let's dive in.`
  }
  if (fieldOfStudy) {
    return `Your personalized plan in ${fieldOfStudy} is ready. Let's dive in.`
  }
  return `Your personalized learning plan is ready. Let's dive in.`
}

export function WelcomeCelebration() {
  const router = useRouter()
  const { data: session, update } = useSession()
  const store = useOnboardingStore()
  const completeMutation = useCompleteOnboarding()
  const { data: profile } = useProfile()

  const displayName =
    store.displayName || profile?.name || session?.user?.name || 'Learner'

  const goal: LearningGoal | null =
    store.goal ?? (profile?.learningGoal?.toLowerCase() as LearningGoal | undefined) ?? null

  const goalTitle = store.goalTitle
  const fieldOfStudy =
    store.fieldOfStudy || profile?.educations?.[0]?.fieldOfStudy || ''
  const educationLevel =
    store.educationLevel || profile?.educations?.[0]?.educationLevel || ''
  const gradeLevel = store.gradeLevel || profile?.gradeLevel || ''

  const topicNames: string[] =
    profile?.topics?.map((t) => t.name).filter(Boolean) ??
    store.certifications.map((c) => c.name).filter(Boolean)

  const tagline = goal ? GOAL_TAGLINES[goal] : 'YOU’RE ALL SET'
  const subtitle = buildSubtitle(goalTitle, fieldOfStudy)
  const ctaHelper = goal
    ? GOAL_CTA_HELPER[goal]
    : 'Jump in and start building lasting knowledge'

  const stats: Array<{ value: string; label: string }> = []
  if (topicNames.length > 0) {
    stats.push({ value: String(topicNames.length), label: 'Interests' })
  }
  if (goal) {
    stats.push({ value: GOAL_LABELS[goal], label: 'Focus' })
  }
  const levelDisplay = prettify(gradeLevel) || prettify(educationLevel)
  if (levelDisplay) {
    stats.push({ value: levelDisplay, label: 'Level' })
  }

  const visibleTopics = topicNames.slice(0, 4)

  useEffect(() => {
    if (!store.goal && !store.displayName) {
      completeMutation.mutate({
        name: session?.user?.name || 'Learner',
        goals: ['build_knowledge'],
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
        className="relative z-10 flex w-full max-w-[480px] flex-col items-center"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        {/* Circle */}
        <motion.div
          className="mb-5 flex size-[104px] items-center justify-center"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', delay: 0.2, stiffness: 200 }}
        >
          <div className="flex size-full items-center justify-center rounded-full border-[3px] border-brand-orange/20 animate-[pulse-ring_2s_ease-in-out_infinite]">
            <div className="flex size-[76px] items-center justify-center rounded-full bg-gradient-to-br from-brand-orange to-brand-orange-hover shadow-[0_8px_24px_rgba(196,98,26,0.3)]">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="size-9"
                aria-hidden="true"
              >
                <path d="M5 12.5l4.5 4.5L19 7" />
              </svg>
            </div>
          </div>
        </motion.div>

        {/* Badge */}
        <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.12em] text-brand-orange-hover">
          {tagline}
        </p>

        {/* Title */}
        <h1 className="mb-2 text-[32px] font-black tracking-tight text-white">
          You&apos;re all set, {displayName}!
        </h1>
        <p className="mx-auto mb-9 max-w-[400px] text-sm leading-relaxed text-white/40">
          {subtitle}
        </p>

        {/* Stats */}
        {stats.length > 0 && (
          <div className="mb-9 flex justify-center gap-8">
            {stats.map((stat) => (
              <div key={stat.label}>
                <p className="font-mono text-2xl font-bold text-brand-orange-hover">
                  {stat.value}
                </p>
                <p className="mt-0.5 text-[10px] uppercase tracking-wider text-white/30">
                  {stat.label}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Topics / interests */}
        {visibleTopics.length > 0 && (
          <div className="mb-10 flex flex-wrap justify-center gap-2.5">
            {visibleTopics.map((name, i) => (
              <span
                key={name}
                className={cn(
                  'flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[11px] font-bold',
                  PILL_STYLES[i % PILL_STYLES.length]
                )}
              >
                {name}
              </span>
            ))}
          </div>
        )}

        {/* CTA */}
        <button
          onClick={handleStart}
          className="rounded-xl bg-gradient-to-r from-brand-orange to-brand-orange-hover px-12 py-4 text-[15px] font-extrabold text-white shadow-[0_4px_16px_rgba(196,98,26,0.3)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(196,98,26,0.4)]"
        >
          Start Learning &rarr;
        </button>
        <p className="mt-4 text-[11px] text-white/25">{ctaHelper}</p>
      </motion.div>
    </div>
  )
}
