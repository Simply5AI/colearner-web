import { BookOpen, Target, Home, type LucideIcon } from 'lucide-react'

export interface TutorNavItem { href: string; label: string; icon: LucideIcon; match: (path: string) => boolean }

/** Today / Learn / Practice (design `NAV`). The Today and Learn sub-tabs are separate routes under the same item. */
export const tutorNavItems: TutorNavItem[] = [
  { href: '/learn/today', label: 'Today', icon: Home, match: (p) => p === '/learn/today' || p === '/learn/home' || p === '/learn/progress' },
  { href: '/learn', label: 'Learn', icon: BookOpen, match: (p) => p === '/learn' || p.startsWith('/learn/plans/') || p.startsWith('/learn/library') || p === '/learn/import' || p === '/learn/snap' || p.startsWith('/learn/notes') },
  { href: '/learn/practice', label: 'Practice', icon: Target, match: (p) => p === '/learn/practice' || p.startsWith('/learn/practice/') },
]

export interface TutorSubTab { id: string; label: string; href: string }

export function todaySubTabs(): TutorSubTab[] {
  return [
    { id: 'today', label: 'Today', href: '/learn/today' },
    { id: 'week', label: 'This week', href: '/learn/today?tab=week' },
    { id: 'progress', label: 'Progress', href: '/learn/today?tab=progress' },
  ]
}
export function learnSubTabs(): TutorSubTab[] {
  return [
    { id: 'plan', label: 'My plan', href: '/learn?tab=plan' },
    { id: 'library', label: 'Library', href: '/learn?tab=library' },
    { id: 'notes', label: 'Notes', href: '/learn?tab=notes' },
  ]
}
