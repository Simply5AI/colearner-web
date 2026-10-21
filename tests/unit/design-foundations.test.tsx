import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { useState } from 'react'
import { AgeBandScope, Button, CoCharacter, coStates, Input, Select, Checkbox, Toggle, ProgressBar, MasteryPill, EmptyState, ErrorState, LoadingState, FoundationErrorBoundary } from '@/components/design-system'

describe('accessible design foundations', () => {
  it('associates text input hints and errors without losing caller descriptions', () => {
    render(<><p id="policy">School password policy</p><Input label="Password" type="password" hint="Use at least eight characters" error="Password is too short" aria-describedby="policy" /></>)
    const input = screen.getByLabelText('Password')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAccessibleDescription('Use at least eight characters Password is too short School password policy')
  })

  it('keeps select and checkbox controls labelled and keyboard-operable', async () => {
    const user = userEvent.setup()
    render(<><Select label="Subject"><option>Science</option><option>English</option></Select><Checkbox label="Remember this device" /></>)
    await user.selectOptions(screen.getByLabelText('Subject'), 'English')
    expect(screen.getByLabelText('Subject')).toHaveValue('English')
    await user.tab()
    expect(screen.getByRole('checkbox')).toHaveFocus()
    await user.keyboard(' ')
    expect(screen.getByRole('checkbox')).toBeChecked()
  })

  it('announces loading and prevents duplicate button submissions', async () => {
    const action = vi.fn()
    const user = userEvent.setup()
    render(<Button loading onClick={action}>Save preferences</Button>)
    const button = screen.getByRole('button', { name: 'Save preferences' })
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('aria-busy', 'true')
    await user.click(button)
    expect(action).not.toHaveBeenCalled()
  })

  it('toggles using keyboard and exposes the actual checked state', async () => {
    const Example = () => { const [checked, setChecked] = useState(false); return <Toggle checked={checked} onCheckedChange={setChecked} label="Read aloud" /> }
    const user = userEvent.setup()
    render(<Example />)
    await user.tab()
    await user.keyboard(' ')
    expect(screen.getByRole('switch', { name: 'Read aloud' })).toBeChecked()
  })

  it.each([{ value: 150, max: 100, expected: 100 }, { value: -3, max: 10, expected: 0 }, { value: NaN, max: 0, expected: 0 }])('bounds non-finite and out-of-range progress $value', ({ value, max, expected }) => {
    render(<ProgressBar label="Course progress" value={value} max={max} />)
    expect(screen.getByRole('progressbar', { name: 'Course progress' })).toHaveAttribute('aria-valuenow', String(expected))
  })

  it('communicates mastery with a text label and icon, independent of colour', () => {
    render(<MasteryPill state="review" />)
    expect(screen.getByText('Review')).toBeVisible()
    expect(screen.getByText('Review').querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  })

  it('uses empty, error and loading semantics without extra mascot announcements', () => {
    render(<><EmptyState title="No material yet" description="Add your first source." /><ErrorState title="Upload did not finish" action={<Button>Try again</Button>} /><LoadingState label="Loading your library" /></>)
    expect(screen.getByRole('alert')).toHaveTextContent('Upload did not finish')
    expect(screen.getByRole('status')).toHaveTextContent('Loading your library')
    expect(screen.getByRole('button', { name: 'Try again' })).toBeEnabled()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('contains a component failure and allows recovery without showing raw errors', async () => {
    const onError = vi.fn()
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    let fail = true
    const Broken = () => { if (fail) throw new Error('internal sensitive detail'); return <p>Recovered view</p> }
    try {
      const user = userEvent.setup()
      render(<FoundationErrorBoundary onError={onError}><Broken /></FoundationErrorBoundary>)
      expect(screen.getByRole('alert')).toHaveTextContent('This view could not load')
      expect(screen.queryByText('internal sensitive detail')).not.toBeInTheDocument()
      expect(onError).toHaveBeenCalled()
      fail = false
      await user.click(screen.getByRole('button', { name: 'Try again' }))
      expect(screen.getByText('Recovered view')).toBeVisible()
    } finally { consoleError.mockRestore() }
  })

  it('passes direction and presentation band through without an age-switch control', () => {
    render(<AgeBandScope band="kids" dir="rtl"><p>Learning material</p></AgeBandScope>)
    const scope = screen.getByText('Learning material').parentElement
    expect(scope).toHaveAttribute('data-age-band', 'kids')
    expect(scope).toHaveAttribute('dir', 'rtl')
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})

describe('Co character', () => {
  it('has collision-free vector gradients when multiple characters render', () => {
    const { container } = render(<><CoCharacter band="kids" /><CoCharacter band="kids" state="thinking" /></>)
    const ids = Array.from(container.querySelectorAll('radialGradient'), (element) => element.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).toHaveLength(4)
  })

  it('provides source-driven band crops and a compact adult dot', () => {
    render(<><CoCharacter band="kids" label="Full Co" /><CoCharacter band="tweens" label="Half Co" /><CoCharacter band="teens" label="Co avatar" /><CoCharacter band="adults" label="Co dot" /></>)
    expect(screen.getByRole('img', { name: 'Full Co' })).toHaveAttribute('width', '220')
    expect(screen.getByRole('img', { name: 'Half Co' })).toHaveAttribute('viewBox', '8 20 184 148')
    expect(screen.getByRole('img', { name: 'Co avatar' })).toHaveAttribute('viewBox', '44 44 112 112')
    expect(screen.getByRole('img', { name: 'Co dot' })).toHaveClass('ds-co-dot')
  })

  it.each(coStates)('supports the %s pose without an interactive prototype control', (state) => {
    render(<CoCharacter band="kids" state={state} />)
    expect(screen.getByRole('img', { name: `Co, ${state}` })).toHaveAttribute('data-co-state', state)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
