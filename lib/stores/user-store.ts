'use client'

import { create } from 'zustand'

interface UserState {
  ncuBalance: number
  previousBalance: number
  setNCUBalance: (balance: number) => void

  currentStreak: number
  setStreak: (streak: number) => void

  tier: 'free' | 'pro' | 'enterprise'
  setTier: (tier: 'free' | 'pro' | 'enterprise') => void
}

export const useUserStore = create<UserState>((set) => ({
  ncuBalance: 0,
  previousBalance: 0,
  setNCUBalance: (balance) =>
    set((state) => ({ ncuBalance: balance, previousBalance: state.ncuBalance })),

  currentStreak: 0,
  setStreak: (streak) => set({ currentStreak: streak }),

  tier: 'free',
  setTier: (tier) => set({ tier }),
}))
