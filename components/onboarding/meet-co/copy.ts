import type { CoVariant } from '@/components/design-system/co-artwork'
import type { OnboardingBand, OnboardingStep } from '@/lib/api/onboarding'

/** Kids copy: one short line per sentence, never more than eight words (A6 brief). */
export const kidsLines = {
  hello: (name: string | null) => [name ? `Hi ${name}!` : 'Hi there!', 'I’m Co. Let’s learn together!'],
  context: (grade: number | null) => [grade ? `Your grown-up says you’re in Grade ${grade}!` : 'Your grown-up will set your grade.'],
  subjects: ['What do you like to learn?', 'Tap the pictures you like.'],
  noSubjects: ['No subjects yet.', 'Ask your grown-up to help!'],
  personalise: ['Pick my look!', 'What should I call myself?'],
  firstImport: ['Show me your book!'],
  done: ['All set!', 'Let’s start learning.'],
} as const

export const wordCount = (line: string) => line.trim().split(/\s+/).filter(Boolean).length

export const stepTitles: Record<OnboardingBand, Record<OnboardingStep, string>> = {
  kids: { HELLO: 'Meet Co', CONTEXT: 'Your grade', SUBJECTS: 'What you like to learn', PERSONALISE: 'Make Co yours', FIRST_IMPORT: 'Show Co your book' },
  tweens: { HELLO: 'Meet Co', CONTEXT: 'Why are you learning?', SUBJECTS: 'What do you like to learn?', PERSONALISE: 'Make Co yours', FIRST_IMPORT: 'What should we learn first?' },
  teens: { HELLO: 'Meet Co', CONTEXT: 'Why are you learning?', SUBJECTS: 'What are you studying?', PERSONALISE: 'How should Co show up?', FIRST_IMPORT: 'Let’s start with your notes' },
}

export const hello = (band: OnboardingBand, name: string | null) =>
  band === 'tweens'
    ? `${name ? `Hi ${name}!` : 'Hi!'} I’m Co — I learn alongside you.`
    : `${name ? `Hey ${name}.` : 'Hey there.'} I’m Co. I’ll help you prep smarter.`

// Keep the persisted theme keys compatible with existing onboarding profiles.
export const coThemes = [
  { key: 'sunrise', label: 'Sprout orange', variant: 'sprout', swatch: '#FFA059' },
  { key: 'ocean', label: 'Buddy orange', variant: 'buddy', swatch: '#F79A48' },
  { key: 'galaxy', label: 'Spark amber', variant: 'spark', swatch: '#FFAB61' },
  { key: 'leaf', label: 'Comet apricot', variant: 'comet', swatch: '#FFAD63' },
] as const satisfies readonly { key: string; label: string; variant: CoVariant; swatch: string }[]
export type CoThemeKey = (typeof coThemes)[number]['key']
export const themeOf = (key: string | null) => coThemes.find(theme => theme.key === key) ?? coThemes[0]

export const settingsNote = 'You can change this later in Settings.'

export const firstImportOptions: Record<OnboardingBand, readonly { key: string; label: string; href: '/learn/import' | '/learn/snap'; icon: 'camera' | 'upload' | 'link' }[]> = {
  kids: [{ key: 'snap', label: 'Snap a page from your book', href: '/learn/snap', icon: 'camera' }],
  tweens: [
    { key: 'snap', label: 'Snap a page', href: '/learn/snap', icon: 'camera' },
    { key: 'link', label: 'Paste a video link', href: '/learn/import', icon: 'link' },
  ],
  teens: [
    { key: 'upload', label: 'Upload your notes', href: '/learn/import', icon: 'upload' },
    { key: 'snap', label: 'Snap a page', href: '/learn/snap', icon: 'camera' },
    { key: 'link', label: 'Paste a link', href: '/learn/import', icon: 'link' },
  ],
}
