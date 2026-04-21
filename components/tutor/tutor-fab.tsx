'use client'

import { motion } from 'framer-motion'
import { Sparkles } from 'lucide-react'
import { useTutorStore } from '@/lib/stores/tutor-store'
import { cn } from '@/lib/utils'

interface TutorFABProps {
  className?: string
}

export function TutorFAB({ className }: TutorFABProps) {
  const toggle = useTutorStore((s) => s.toggle)
  const isOpen = useTutorStore((s) => s.isOpen)

  return (
    <motion.button
      type="button"
      onClick={toggle}
      aria-label={isOpen ? 'Close AI tutor' : 'Ask AI tutor'}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      className={cn(
        'fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full bg-brand-purple px-4 py-3 text-sm font-medium text-white shadow-lg shadow-brand-purple/30 hover:bg-brand-purple/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple/50',
        className,
      )}
    >
      <Sparkles className="h-4 w-4" />
      <span className="hidden sm:inline">Ask Tutor</span>
    </motion.button>
  )
}
