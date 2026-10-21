import Link from 'next/link'
import { linkHelpHref } from '@/lib/api/learn-link'

/** Offered beside CHILD_PROFILE_REQUIRED / CONSENT_REQUIRED denials. A link only: never an automatic redirect (avoids loops). */
export function SeeWhatsNeededLink({ className = 'ds-button ds-button-primary' }: { className?: string }) {
  return <Link href={linkHelpHref} className={className}>See what&rsquo;s needed</Link>
}
