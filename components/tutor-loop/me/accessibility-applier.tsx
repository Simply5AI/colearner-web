'use client'

import { useQuery } from '@tanstack/react-query'
import { getTutorProfile, applyAccessibilityToDocument, type TutorAccessibility } from '@/lib/api/tutor-loop/profile'
import { getTutorWorkspaceScope } from '@/lib/api/tutor-loop/client'

/**
 * The profile helper sets attributes on the document root. Age-band scopes redefine the type variables below it,
 * so these rules make the attributes take effect inside every band scope.
 */
export const ACCESSIBILITY_CSS = `
html[data-tutor-text-scale='large'] [data-age-band='teens'] { --ds-body: 18px; --ds-small: 16px; --ds-caption: 14px; }
html[data-tutor-text-scale='large'] [data-age-band='adults'] { --ds-body: 17px; --ds-small: 15px; --ds-caption: 14px; }
html[data-tutor-text-scale='extra-large'] [data-age-band='teens'] { --ds-body: 21px; --ds-small: 18px; --ds-caption: 16px; }
html[data-tutor-text-scale='extra-large'] [data-age-band='adults'] { --ds-body: 20px; --ds-small: 17px; --ds-caption: 16px; }
html[data-tutor-easy-read='true'] [data-age-band] { --ds-body-font: 'Atkinson Hyperlegible', Verdana, system-ui, sans-serif; letter-spacing: .02em; line-height: 1.7; }
html[data-tutor-reduced-motion='true'] *, html[data-tutor-reduced-motion='true'] *::before, html[data-tutor-reduced-motion='true'] *::after { animation-duration: .001ms !important; animation-iteration-count: 1 !important; transition-duration: .001ms !important; scroll-behavior: auto !important; }
`

export function applyTutorAccessibility(accessibility: TutorAccessibility) {
  applyAccessibilityToDocument(accessibility)
}

/** Mount once in the learner shell (and on Me): loads the saved preferences and applies them to the page. */
export function TutorAccessibilityApplier() {
  const workspace = getTutorWorkspaceScope()
  useQuery({
    queryKey: ['tutor-profile', workspace],
    queryFn: async () => {
      const profile = await getTutorProfile({ workspace })
      applyTutorAccessibility(profile.accessibility)
      return profile
    },
    retry: false,
    staleTime: 60_000,
  })
  return <style>{ACCESSIBILITY_CSS}</style>
}
