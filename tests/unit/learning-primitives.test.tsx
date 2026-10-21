import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { AnswerFeedback, CoDock, HintLadder, QuestionOptionTile, ReadAloudText, RewardBadge, SpeechBubble } from '@/components/design-system'

describe('question option presentation', () => {
  it('uses native radio grouping, labels and keyboard selection with caller state', async () => {
    const onSelect = vi.fn()
    const Example = () => {
      const [value, setValue] = useState('plant')
      const select = (next: string) => { setValue(next); onSelect(next) }
      return <fieldset><legend>Which grows leaves?</legend><QuestionOptionTile name="question-one" value="plant" label="Plant" checked={value === 'plant'} onSelect={select} picture={{ src: '/co/co-original.svg', alt: 'Illustrative plant picture' }} /><QuestionOptionTile name="question-one" value="stone" label="Stone" checked={value === 'stone'} onSelect={select} /></fieldset>
    }
    const user = userEvent.setup()
    render(<Example />)
    expect(screen.getByRole('radio', { name: 'Plant' })).toBeChecked()
    expect(screen.getByRole('img', { name: 'Illustrative plant picture' })).toBeVisible()
    await user.tab()
    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('radio', { name: 'Stone' })).toBeChecked()
    expect(onSelect).toHaveBeenLastCalledWith('stone')
  })

  it('never changes controlled selection until the caller supplies new state', async () => {
    const select = vi.fn()
    const user = userEvent.setup()
    render(<QuestionOptionTile name="choice" value="one" label="First option" checked={false} onSelect={select} />)
    await user.click(screen.getByRole('radio'))
    expect(select).toHaveBeenCalledWith('one')
    expect(screen.getByRole('radio')).not.toBeChecked()
  })

  it('disables unavailable or locked answer actions', () => {
    render(<><QuestionOptionTile name="choice" value="one" label="Preview" checked={false} /><QuestionOptionTile name="choice" value="two" label="Locked" checked={false} onSelect={vi.fn()} disabled /></>)
    for (const radio of screen.getAllByRole('radio')) expect(radio).toBeDisabled()
  })
})

describe('sequential controlled hints', () => {
  const hints = ['Look at the leaves.', 'Compare the two shapes.', 'Imagine a different garden.'] as const
  it('reveals only the next supplied rung and stops at three', async () => {
    const Example = () => { const [count, setCount] = useState(0); return <HintLadder hints={hints} revealedCount={count} onReveal={setCount} /> }
    const user = userEvent.setup()
    render(<Example />)
    expect(screen.queryByText(hints[0])).not.toBeInTheDocument()
    await user.tab()
    await user.keyboard('{Enter}')
    expect(screen.getByText(hints[0])).toBeVisible()
    expect(screen.queryByText(hints[1])).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Show next hint' }))
    expect(screen.getByText(hints[1])).toBeVisible()
    expect(screen.queryByText(hints[2])).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Show next hint' }))
    expect(screen.getByText(hints[2])).toBeVisible()
    expect(screen.getByRole('status')).toHaveTextContent('3 of 3 hints shown')
    expect(screen.getByRole('button', { name: 'All hints shown' })).toBeDisabled()
  })

  it.each([{ value: -3, count: 0 }, { value: NaN, count: 0 }, { value: 1.9, count: 1 }, { value: 200, count: 3 }])('bounds caller reveal count $value to $count', ({ value, count }) => {
    render(<HintLadder hints={hints} revealedCount={value} onReveal={vi.fn()} />)
    expect(screen.queryAllByRole('listitem')).toHaveLength(count)
  })

  it('does not pretend hint retrieval is available without a callback', () => {
    render(<HintLadder hints={hints} revealedCount={0} />)
    expect(screen.getByRole('button', { name: 'Need help?' })).toBeDisabled()
  })
})

describe('feedback and reward presentation', () => {
  it.each(['correct', 'incorrect', 'partial'] as const)('renders caller feedback %s without inventing a score or answer', (kind) => {
    render(<AnswerFeedback kind={kind} message="Caller supplied teaching feedback." band="kids" />)
    expect(screen.getByRole('status')).toHaveTextContent('Caller supplied teaching feedback.')
    expect(screen.getByRole('status')).toHaveAttribute('data-feedback-kind', kind)
    expect(screen.queryByText(/correct answer:|next review:|score:/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('communicates an unavailable reward with a lock label and no unlock action', () => {
    render(<RewardBadge kind="sticker" label="Explorer sticker" locked />)
    expect(screen.getByText('Locked:')).toBeInTheDocument()
    expect(screen.getByText('Explorer sticker')).toBeVisible()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})

describe('Co dock and read-aloud presentation', () => {
  it('hides and shows adult Co using only controlled preference callbacks', async () => {
    const onHidden = vi.fn()
    const ask = vi.fn()
    const Example = () => {
      const [hidden, setHidden] = useState(false)
      const change = (next: boolean) => { setHidden(next); onHidden(next) }
      return <CoDock band="adults" hidden={hidden} onHiddenChange={change} onAsk={ask}>Caller supplied explanation.</CoDock>
    }
    const user = userEvent.setup()
    render(<Example />)
    await user.click(screen.getByRole('button', { name: 'Ask Co' }))
    expect(ask).toHaveBeenCalledOnce()
    await user.click(screen.getByRole('button', { name: 'Hide Co' }))
    expect(onHidden).toHaveBeenLastCalledWith(true)
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Show Co' }))
    expect(onHidden).toHaveBeenLastCalledWith(false)
    expect(screen.getByRole('complementary', { name: 'Co helper' })).toBeVisible()
  })

  it('keeps child Co visible and disables unavailable Ask Co', () => {
    render(<CoDock band="kids" hidden onHiddenChange={vi.fn()} />)
    expect(screen.getByRole('complementary', { name: 'Co helper' })).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Hide Co' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ask Co' })).toBeDisabled()
  })

  it.each([{ capability: false, callback: true }, { capability: true, callback: false }])('disables speech without both capability $capability and callback $callback', ({ capability, callback }) => {
    render(<SpeechBubble canReadAloud={capability} onReadAloud={callback ? vi.fn() : undefined}>A supplied sentence.</SpeechBubble>)
    expect(screen.getByRole('button', { name: 'Read aloud' })).toBeDisabled()
  })

  it('highlights only the supplied word index and delegates reading on keyboard action', async () => {
    const read = vi.fn()
    const user = userEvent.setup()
    const { container, rerender } = render(<ReadAloudText words={['Roots', 'drink', 'water.']} activeWordIndex={1} canReadAloud onReadAloud={read} />)
    expect(container.querySelector('mark')).toHaveTextContent('drink')
    await user.tab()
    await user.keyboard('{Enter}')
    expect(read).toHaveBeenCalledOnce()
    rerender(<ReadAloudText words={['Roots', 'drink', 'water.']} activeWordIndex={99} />)
    expect(container.querySelector('mark')).toBeNull()
    expect(screen.getByRole('button', { name: 'Read aloud' })).toBeDisabled()
  })
})
