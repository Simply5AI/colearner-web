'use client'

import { create } from 'zustand'

interface TutorState {
  isOpen: boolean
  pinnedConceptId: string | null
  open: () => void
  close: () => void
  toggle: () => void
  setPinned: (conceptId: string | null) => void
}

export const useTutorStore = create<TutorState>((set) => ({
  isOpen: false,
  pinnedConceptId: null,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
  toggle: () => set((s) => ({ isOpen: !s.isOpen })),
  setPinned: (conceptId) => set({ pinnedConceptId: conceptId }),
}))
