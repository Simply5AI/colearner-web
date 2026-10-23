import { act, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LandingMotion } from '@/components/landing/landing-motion'

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

describe('Homepage motion preferences', () => {
  it('leaves all content visible when reduced motion is requested', () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })))
    const observe = vi.fn()
    vi.stubGlobal('IntersectionObserver', class { observe = observe })
    const { container } = render(<LandingMotion><section data-reveal="visible">Learning content</section></LandingMotion>)
    expect(container.querySelector('section')).toHaveAttribute('data-reveal', 'visible')
    expect(observe).not.toHaveBeenCalled()
  })
  it('reveals pending sections and stops observation if motion preferences change', () => {
    let onChange: () => void = () => undefined
    const disconnect = vi.fn()
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, addEventListener: (_: string, callback: () => void) => { onChange = callback }, removeEventListener: vi.fn() })))
    vi.stubGlobal('IntersectionObserver', class { observe = vi.fn(); disconnect = disconnect })
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ top: 5000 } as DOMRect)
    const { container } = render(<LandingMotion><section data-reveal="visible">Learning content</section></LandingMotion>)
    expect(container.querySelector('section')).toHaveAttribute('data-reveal', 'pending')
    act(() => onChange())
    expect(container.querySelector('section')).toHaveAttribute('data-reveal', 'visible')
    expect(disconnect).toHaveBeenCalled()
  })
})
