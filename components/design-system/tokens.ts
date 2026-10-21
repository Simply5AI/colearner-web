/** Platform-neutral values from Design System.dc.html. Native clients can reuse this data. */
export const ageBands = ['kids', 'tweens', 'teens', 'adults'] as const
export type AgeBand = (typeof ageBands)[number]

export const ageTokens = {
  kids: { body: 22, small: 18, caption: 15, display: 64, h1: 46, h2: 30, h3: 24, radius: 28, target: 64, gap: 28, coSize: 220 },
  tweens: { body: 18, small: 15, caption: 13, display: 56, h1: 40, h2: 27, h3: 21, radius: 22, target: 48, gap: 24, coSize: 120 },
  teens: { body: 16, small: 14, caption: 12, display: 52, h1: 36, h2: 24, h3: 19, radius: 18, target: 44, gap: 22, coSize: 56 },
  adults: { body: 15, small: 13, caption: 12, display: 48, h1: 32, h2: 22, h3: 18, radius: 14, target: 44, gap: 20, coSize: 24 },
} as const satisfies Record<AgeBand, Record<string, number>>

export const designTokens = {
  color: { background: '#ffffff', surface: '#f5f5f9', text: '#1c1b29', muted: '#5b5d6b', orange: '#cf5d0b', action: '#b4500a', teal: '#1a7070', blue: '#1e4fa3', purple: '#6b3fa0', success: '#22693b', warning: '#854d0e', error: '#b42318' },
  spacing: [0, 4, 8, 12, 16, 20, 24, 28, 32, 40, 48, 64] as const,
} as const
