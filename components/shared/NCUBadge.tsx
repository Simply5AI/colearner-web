'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { Badge } from '@/components/ui/badge'

interface NCUBadgeProps {
  balance: number
  previousBalance: number
}

/** NCU balance badge with animation on change */
export function NCUBadge({ balance, previousBalance }: NCUBadgeProps) {
  const gained = balance > previousBalance

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={balance}
        initial={gained ? { scale: 1.3, color: '#F59E0B' } : {}}
        animate={{ scale: 1, color: '#1A3C5E' }}
        transition={{ type: 'spring', stiffness: 300 }}
      >
        <Badge variant="outline" className="text-lg font-bold">
          {balance} NCU
        </Badge>
      </motion.div>
    </AnimatePresence>
  )
}
