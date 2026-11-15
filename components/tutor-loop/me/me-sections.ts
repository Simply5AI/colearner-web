export const ME_SECTIONS = [
  { id: 'goal', label: 'Goal and exam' },
  { id: 'time', label: 'Study time' },
  { id: 'tutor', label: 'My tutor' },
  { id: 'notes', label: 'Notes about you' },
  { id: 'progress', label: 'Progress' },
  { id: 'access', label: 'Accessibility' },
  { id: 'space', label: 'Switch space' },
  { id: 'out', label: 'Sign out' },
] as const
export type MeSectionId = (typeof ME_SECTIONS)[number]['id']
