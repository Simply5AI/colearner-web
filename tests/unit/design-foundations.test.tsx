import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { useState } from 'react'
import { AgeBandScope, Button, CoCharacter, coStates, coVariants, Input, Select, Checkbox, Toggle, ProgressBar, MasteryPill, EmptyState, ErrorState, LoadingState, FoundationErrorBoundary } from '@/components/design-system'

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
  it('renders self-contained vectors without shared ids or raster images', () => {
    const { container } = render(<>{coVariants.map(variant => <CoCharacter key={variant} variant={variant} />)}</>)
    expect(container.querySelectorAll('svg')).toHaveLength(4)
    expect(container.querySelector('image, defs, [id]')).toBeNull()
  })

  it('keeps the complete silhouette at each band size, including compact adults', () => {
    render(<><CoCharacter band="kids" label="Full Co" /><CoCharacter band="tweens" label="Medium Co" /><CoCharacter band="teens" label="Co avatar" /><CoCharacter band="adults" label="Compact Co" /></>)
    for (const [label, size] of [['Full Co', '220'], ['Medium Co', '120'], ['Co avatar', '56'], ['Compact Co', '24']]) {
      const image = screen.getByRole('img', { name: label })
      expect(image).toHaveAttribute('width', size)
      expect(image).toHaveAttribute('viewBox', '0 0 200 200')
    }
  })

  it.each([
    ['idle', 'buddy'], ['listening', 'buddy'], ['hinting', 'spark'], ['thinking', 'spark'],
    ['encouraging', 'sprout'], ['celebrating', 'sprout'], ['reading', 'comet'], ['explaining', 'comet'],
  ] as const)('uses %s activity artwork from %s', (state, variant) => {
    render(<CoCharacter state={state} />)
    expect(screen.getByRole('img')).toHaveAttribute('data-co-variant', variant)
  })

  it('allows an explicit variant without losing state, size or accessible label', () => {
    render(<CoCharacter variant="comet" state="waving" size={80} label="Co says hello" />)
    expect(screen.getByRole('img', { name: 'Co says hello' })).toHaveAttribute('data-co-variant', 'comet')
    expect(screen.getByRole('img')).toHaveAttribute('width', '80')
    expect(screen.getByRole('img')).toHaveAttribute('data-co-state', 'waving')
  })

  it.each(coStates)('supports the %s pose without an interactive prototype control', (state) => {
    render(<CoCharacter band="kids" state={state} />)
    expect(screen.getByRole('img', { name: `Co, ${state}` })).toHaveAttribute('data-co-state', state)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
