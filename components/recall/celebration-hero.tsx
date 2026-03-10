'use client'

import { motion } from 'framer-motion'
import { Trophy, CheckCircle2, ThumbsUp, Heart } from 'lucide-react'

interface CelebrationHeroProps {
  passRate: number
  avgScore: number
}

function getCelebration(passRate: number) {
  if (passRate >= 1)
    return { message: 'Perfect Session!', icon: <Trophy className="h-8 w-8 text-yellow-500" />, color: 'text-yellow-500' }
  if (passRate >= 0.8)
    return { message: 'Great Session!', icon: <CheckCircle2 className="h-8 w-8 text-green-500" />, color: 'text-green-500' }
  if (passRate >= 0.6)
    return { message: 'Good Effort!', icon: <ThumbsUp className="h-8 w-8 text-blue-500" />, color: 'text-blue-500' }
  return { message: 'Keep Practicing!', icon: <Heart className="h-8 w-8 text-brand-orange" />, color: 'text-brand-orange' }
}

export function CelebrationHero({ passRate, avgScore }: CelebrationHeroProps) {
  const celebration = getCelebration(passRate)
  const percentage = Math.round(passRate * 100)

  // SVG ring parameters
  const size = 120
  const strokeWidth = 8
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (passRate * circumference)

  return (
    <motion.div
      className="flex flex-col items-center py-6"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="relative mb-4">
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            className="text-muted/30"
          />
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeLinecap="round"
            className={celebration.color}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1, ease: 'easeOut', delay: 0.3 }}
          />
        </svg>
        <motion.div
          className="absolute inset-0 flex flex-col items-center justify-center"
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.8 }}
        >
          <span className="text-2xl font-bold">{percentage}%</span>
        </motion.div>
      </div>

      <motion.div
        className="flex items-center gap-2 mb-1"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 1 }}
      >
        {celebration.icon}
        <h1 className="text-2xl font-bold">{celebration.message}</h1>
      </motion.div>

      <motion.p
        className="text-sm text-muted-foreground"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, delay: 1.2 }}
      >
        Average score: {avgScore.toFixed(1)}/10
      </motion.p>
    </motion.div>
  )
}
