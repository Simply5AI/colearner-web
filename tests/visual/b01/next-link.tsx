import type { AnchorHTMLAttributes, MouseEvent } from 'react'
import { navigateFixture } from './next-navigation'

export default function FixtureLink({ href, onClick, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  function navigate(event: MouseEvent<HTMLAnchorElement>) {
    onClick?.(event)
    if (!event.defaultPrevented && !event.metaKey && !event.ctrlKey) { event.preventDefault(); navigateFixture(href) }
  }
  return <a {...props} href={href} onClick={navigate} />
}
