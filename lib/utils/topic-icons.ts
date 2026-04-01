/** Maps Lucide icon names (stored in DB) to emoji characters */
export const ICON_TO_EMOJI: Record<string, string> = {
  code: '\u{1F4BB}',
  brain: '\u{1F916}',
  'chart-bar': '\u{1F4CA}',
  palette: '\u{1F3A8}',
  briefcase: '\u{1F4C8}',
  flask: '\u{1F9EC}',
  'book-open': '\u{1F4D6}',
  landmark: '\u{1F30D}',
  calculator: '\u{1F9EE}',
  globe: '\u{1F5E3}\u{FE0F}',
  music: '\u{1F3B5}',
  'heart-pulse': '\u{1F3E5}',
}

/** Resolves an icon value to a displayable emoji */
export function resolveIcon(icon: string | null | undefined): string {
  if (!icon) return '\u{1F4DA}'
  // If it's already an emoji (starts with a high unicode char), use it directly
  if (icon.codePointAt(0)! > 255) return icon
  // Otherwise look up the Lucide name → emoji mapping
  return ICON_TO_EMOJI[icon] || '\u{1F4DA}'
}
