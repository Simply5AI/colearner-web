import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CreateRoadmapModal } from '@/components/roadmap/create-roadmap-modal'

const pushMock = vi.hoisted(() => vi.fn())
const createRoadmapMock = vi.hoisted(() => vi.fn())
const profileState = vi.hoisted(() => ({
  learnerType: 'PROFESSIONAL' as 'STUDENT' | 'PROFESSIONAL',
  gradeLevel: 'CLASS_9' as const,
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}))

vi.mock('@/lib/hooks/use-roadmap', () => ({
  useCreateRoadmap: () => ({
    mutateAsync: createRoadmapMock,
    isPending: false,
  }),
}))

vi.mock('@/lib/hooks/use-profile', () => ({
  useProfile: () => ({
    data: profileState,
  }),
}))

vi.mock('@/lib/hooks/use-onboarding', () => ({
  useSubjects: () => ({
    data: [
      { id: 'subject-science', name: 'Science', slug: 'science', icon: 'flask', sortOrder: 2 },
      { id: 'subject-math', name: 'Mathematics', slug: 'mathematics', icon: 'calculator', sortOrder: 1 },
    ],
  }),
}))

describe('CreateRoadmapModal', () => {
  beforeEach(() => {
    pushMock.mockReset()
    createRoadmapMock.mockReset()
    createRoadmapMock.mockResolvedValue({ roadmap: { id: 'roadmap-1' } })
    profileState.learnerType = 'PROFESSIONAL'
    profileState.gradeLevel = 'CLASS_9'
  })

  it('keeps the professional wizard with phase count and certification language', async () => {
    render(<CreateRoadmapModal open onOpenChange={vi.fn()} />)

    expect(screen.getByText('Certification')).toBeInTheDocument()
    expect(screen.getByLabelText(/what do you want to learn/i)).toBeInTheDocument()

    await userEvent.type(screen.getByLabelText(/what do you want to learn/i), 'REST APIs')
    await userEvent.click(screen.getByRole('button', { name: /continue/i }))

    expect(screen.getByLabelText(/number of phases/i)).toBeInTheDocument()
  })
})
