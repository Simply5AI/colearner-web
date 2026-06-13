import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { QuestionRenderer } from '@/components/questions/QuestionRenderer'
import {
  mockCodeQuestion,
  mockFillBlankQuestion,
  mockLongAnswerQuestion,
  mockMcqQuestion,
  mockMultiSelectQuestion,
  mockShortAnswerQuestion,
  mockTrueFalseQuestion,
} from '@/lib/fixtures/teacher-ui'

describe('QuestionRenderer', () => {
  it('emits MCQ answer on selection', async () => {
    const user = userEvent.setup()
    const onAnswer = vi.fn()

    render(
      <QuestionRenderer
        question={mockMcqQuestion}
        mode="attempt"
        onAnswer={onAnswer}
      />,
    )

    await user.click(screen.getByRole('button', { name: /Merge Sort/i }))
    expect(onAnswer).toHaveBeenCalledWith({ type: 'MCQ', optionId: 'b' })
  })

  it('emits multi-select answers', async () => {
    const user = userEvent.setup()
    const onAnswer = vi.fn()

    render(
      <QuestionRenderer
        question={mockMultiSelectQuestion}
        mode="attempt"
        onAnswer={onAnswer}
      />,
    )

    await user.click(screen.getByRole('button', { name: /^GET$/i }))
    expect(onAnswer).toHaveBeenCalledWith({ type: 'MULTI_SELECT', optionIds: ['get'] })
  })

  it('emits true/false answer', async () => {
    const user = userEvent.setup()
    const onAnswer = vi.fn()

    render(
      <QuestionRenderer
        question={mockTrueFalseQuestion}
        mode="attempt"
        onAnswer={onAnswer}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'True' }))
    expect(onAnswer).toHaveBeenCalledWith({ type: 'TRUE_FALSE', value: true })
  })

  it('emits short answer text', async () => {
    const user = userEvent.setup()
    const onAnswer = vi.fn()

    render(
      <QuestionRenderer
        question={mockShortAnswerQuestion}
        mode="attempt"
        onAnswer={onAnswer}
      />,
    )

    const input = screen.getByPlaceholderText('Type your answer...')
    await user.type(input, 'Domain Name System')
    expect(onAnswer).toHaveBeenLastCalledWith({
      type: 'SHORT_ANSWER',
      text: 'Domain Name System',
    })
  })

  it('emits long answer text', async () => {
    const user = userEvent.setup()
    const onAnswer = vi.fn()

    render(
      <QuestionRenderer
        question={mockLongAnswerQuestion}
        mode="attempt"
        onAnswer={onAnswer}
      />,
    )

    const input = screen.getByPlaceholderText('Write your detailed answer...')
    await user.type(input, 'Uses key pairs')
    expect(onAnswer).toHaveBeenLastCalledWith({
      type: 'LONG_ANSWER',
      text: 'Uses key pairs',
    })
  })

  it('emits fill-blank text', async () => {
    const user = userEvent.setup()
    const onAnswer = vi.fn()

    render(
      <QuestionRenderer
        question={mockFillBlankQuestion}
        mode="attempt"
        onAnswer={onAnswer}
      />,
    )

    const input = screen.getByPlaceholderText('Fill in the blank...')
    await user.type(input, 'log n')
    expect(onAnswer).toHaveBeenLastCalledWith({
      type: 'FILL_BLANK',
      text: 'log n',
    })
  })

  it('emits code answer', () => {
    const onAnswer = vi.fn()

    render(
      <QuestionRenderer
        question={mockCodeQuestion}
        mode="attempt"
        onAnswer={onAnswer}
      />,
    )

    const input = screen.getByLabelText('code-editor')
    fireEvent.change(input, {
      target: { value: 'function sum(a,b){return a+b}' },
    })
    expect(onAnswer).toHaveBeenLastCalledWith({
      type: 'CODE',
      code: 'function sum(a,b){return a+b}',
    })
  })
})