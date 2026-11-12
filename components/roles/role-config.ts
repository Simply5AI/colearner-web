import type { LucideIcon } from 'lucide-react'
import { Activity, BarChart3, BookOpen, Building2, Camera, Clock, CreditCard, Gauge, GraduationCap, History, Home, Library, ListChecks, NotebookPen, Settings, Shield, Sparkles, Trophy, Users } from 'lucide-react'
import type { AgeBand } from '@/components/design-system'

export type WorkspaceRole = 'student' | 'parent' | 'teacher' | 'school-admin' | 'platform-admin' | 'researcher'

export interface RoleNavItem {
  href: string
  label: string
  icon: LucideIcon
  match?: (pathname: string) => boolean
  badge?: number
}

export interface RoleNavGroup {
  title: string
  items: RoleNavItem[]
}

export const workspaceLabels: Record<WorkspaceRole, string> = {
  student: 'Learning workspace', parent: 'Parent workspace', teacher: 'Teacher workspace',
  'school-admin': 'School workspace', 'platform-admin': 'Platform workspace', researcher: 'Research workspace',
}

export function matchesNavItem(pathname: string, item: RoleNavItem): boolean {
  if (item.match) return item.match(pathname)
  return pathname === item.href || pathname.startsWith(`${item.href}/`)
}

/** Presentation only. Consent and resource permissions belong to backend policy. */
export function ageBandFromDateOfBirth(dateOfBirth?: string | null, today = new Date()): AgeBand | undefined {
  if (!dateOfBirth || !/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(dateOfBirth)) return undefined
  const year = Number(dateOfBirth.slice(0, 4))
  const month = Number(dateOfBirth.slice(5, 7))
  const day = Number(dateOfBirth.slice(8, 10))
  const birth = new Date(Date.UTC(year, month - 1, day))
  if (birth.getUTCFullYear() !== year || birth.getUTCMonth() !== month - 1 || birth.getUTCDate() !== day) return undefined
  let age = today.getUTCFullYear() - year
  if (today.getUTCMonth() < month - 1 || (today.getUTCMonth() === month - 1 && today.getUTCDate() < day)) age--
  if (age < 6 || age > 120) return undefined
  return age < 10 ? 'kids' : age < 14 ? 'tweens' : age < 18 ? 'teens' : 'adults'
}

/** Home keeps highlighting on the retained legacy dashboard; Learn covers plans, never the library tools. */
const isHomePath = (path: string) => path === '/learn/home' || path === '/dashboard'
const isLearnPath = (path: string) => path === '/learn' || path.startsWith('/learn/plans/') || path === '/roadmaps' || path.startsWith('/roadmaps/')

/**
 * `profileSession` = an account that entered through its school learner profile (/learner). That session only works on the
 * (learn)/(materials) screens, so entries that live in the account-only dashboard group are hidden instead of bouncing.
 */
export function studentNavigation(band: AgeBand, ageKnown: boolean, recallDueCount = 0, profileSession = false): RoleNavGroup[] {
  const kids = band === 'kids'
  const practice: RoleNavItem = {
    href: '/learn/practice', label: kids ? 'Play' : 'Practice', icon: Clock,
    // B09: the hub, start page, session player, summary and answer sheet; the retained legacy routes keep the item lit too.
    match: (path) => path === '/learn/practice' || path.startsWith('/learn/practice/') || path === '/practice' || path.startsWith('/practice/') || path === '/recall' || path.startsWith('/recall/') || /\/recall(?:\/|$)/.test(path),
    badge: !kids && recallDueCount > 0 ? recallDueCount : undefined,
  }
  return [
    { title: kids ? 'Your adventures' : 'Learn', items: kids ? [
      { href: '/learn', label: 'Adventures', icon: BookOpen, match: isLearnPath },
      { href: '/learn/library', label: 'My pages', icon: Camera, match: (path) => path.startsWith('/learn/library') || path === '/learn/import' || path === '/learn/snap' }, practice,
      ...(profileSession ? [] : [{ href: '/trophies', label: 'My World', icon: Trophy }]),
    ] : [
      { href: '/learn/home', label: 'Home', icon: Home, match: isHomePath },
      { href: '/learn', label: 'Learn', icon: BookOpen, match: isLearnPath },
      { href: '/learn/library', label: 'Library', icon: Library, match: (path) => path.startsWith('/learn/library') || path === '/learn/import' || path === '/learn/snap' }, practice,
      ...(profileSession ? [] : [{ href: '/settings', label: 'Me', icon: Settings }]),
    ] },
    { title: kids ? 'More' : 'Your learning', items: [
      ...(kids ? [{ href: '/learn/home', label: 'Home', icon: Home, match: isHomePath }] : []),
      ...(profileSession ? [] : [{ href: '/learn/enrolled', label: kids ? 'School lessons' : 'Assigned learning', icon: GraduationCap }]),
      ...(!kids ? [{ href: '/learn/notes', label: 'My pages', icon: NotebookPen, match: (path: string) => path === '/learn/notes' || path.startsWith('/learn/notes/') }] : []),
      { href: '/learn/progress', label: 'Progress', icon: BarChart3 },
      ...(!kids && !profileSession ? [{ href: '/trophies', label: 'Achievements', icon: Trophy }, { href: '/dashboard/history', label: 'History', icon: History }] : []),
      ...(!profileSession && ageKnown && (band === 'teens' || band === 'adults') ? [{ href: '/pods', label: 'Study Groups', icon: Users }] : []),
      ...(kids && !profileSession ? [{ href: '/settings', label: 'Settings', icon: Settings }] : []),
    ] },
  ]
}

export const teacherNavigation: RoleNavGroup[] = [{ title: 'Teach', items: [
  { href: '/teacher/dashboard', label: 'Dashboard', icon: Home },
  { href: '/teacher/plans', label: 'Classes & plans', icon: BookOpen },
  { href: '/teacher/questions', label: 'Question bank', icon: ListChecks },
  { href: '/teacher/students', label: 'Students', icon: Users },
  { href: '/teacher/analytics', label: 'Insights', icon: BarChart3 },
] }]

function isLearningPath(path: string) {
  return path === '/admin/learning' || /^\/admin\/users\/[^/]+\/learning(?:\/.*)?$/.test(path)
}

export const platformNavigation: RoleNavGroup[] = [
  { title: 'Overview', items: [{ href: '/admin', label: 'Dashboard', icon: Gauge, match: (path) => path === '/admin' }, { href: '/admin/health', label: 'System Health', icon: Activity }] },
  { title: 'People', items: [
    { href: '/admin/users', label: 'Users', icon: Users, match: (path) => (path === '/admin/users' || path.startsWith('/admin/users/')) && !isLearningPath(path) },
    { href: '/admin/orgs', label: 'Organizations', icon: Building2 }, { href: '/admin/schools', label: 'Schools', icon: Building2 }, { href: '/admin/roles', label: 'Roles', icon: Shield },
  ] },
  { title: 'Learning', items: [{ href: '/admin/learning', label: 'Learning', icon: BookOpen, match: isLearningPath }] },
  { title: 'Content', items: [{ href: '/admin/content/extractions', label: 'Extractions', icon: Library }, { href: '/admin/content/library', label: 'Library', icon: BookOpen }, { href: '/admin/content/pods', label: 'Pods', icon: Users }] },
  { title: 'Billing', items: [{ href: '/admin/billing', label: 'Billing', icon: CreditCard, match: (path) => path === '/admin/billing' }, { href: '/admin/billing/subscriptions', label: 'Subscriptions', icon: CreditCard }] },
  { title: 'AI & costs', items: [{ href: '/admin/ai-usage', label: 'AI Usage', icon: Sparkles }] },
]
