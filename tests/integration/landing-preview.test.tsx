import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { LearningPreview } from '@/components/landing/learning-preview'

describe('public learning example', () => {
  it('labels the example and supports retrying a question without claiming real learner progress', async () => {
    const user = userEvent.setup()
    render(<LearningPreview />)
    expect(screen.getByText(/fixed content, no live AI/)).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Try a quick question' }))
    await user.click(screen.getByRole('button', { name: 'Soil' }))
    expect(screen.getByText(/Soil supplies nutrients/)).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Sunlight' }))
    expect(screen.getByText(/That’s it! Sunlight supplies/)).toBeVisible()
    expect(screen.getByRole('button', { name: 'Sunlight' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('shows a sample reply only after a question is chosen, and resets the example', async () => {
    const user = userEvent.setup()
    render(<LearningPreview />)
    await user.click(screen.getByRole('button', { name: 'Ask Co' }))
    const question = screen.getByRole('button', { name: 'Why do plants need sunlight?' })
    expect(question).toHaveAttribute('aria-expanded', 'false')
    await user.click(question)
    expect(screen.getByText(/Leaves capture light/)).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Start the example again' }))
    expect(screen.getByRole('button', { name: 'Learn' })).toHaveAttribute('aria-pressed', 'true')
    await user.click(screen.getByRole('button', { name: 'Ask Co' }))
    expect(screen.getByRole('button', { name: 'Why do plants need sunlight?' })).toHaveAttribute('aria-expanded', 'false')
  })
})
