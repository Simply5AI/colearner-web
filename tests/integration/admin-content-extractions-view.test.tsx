import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AdminContentExtractionsView } from '@/components/admin/admin-content-extractions-view'

describe('AdminContentExtractionsView', () => {
  it('renders extraction rows and total count', () => {
    render(
      <AdminContentExtractionsView
        data={{
          total: 1,
          nextCursor: null,
          items: [
            {
              id: 'ext-1',
              sourceUrl: 'https://youtube.com/watch?v=abc',
              title: 'Intro to biology',
              status: 'COMPLETED',
              sourceType: 'YOUTUBE',
              owner: { id: 'u1', email: 'teacher@example.com' },
              org: { id: 'org-1', name: 'Acme School' },
              processingTimeMs: 4200,
              conceptCount: 3,
              questionCount: 9,
              isStuck: false,
              createdAt: '2026-06-01T10:00:00.000Z',
              updatedAt: '2026-06-01T10:01:00.000Z',
              completedAt: '2026-06-01T10:01:00.000Z',
            },
          ],
        }}
        query={{ sort: 'created_desc', limit: 25 }}
      />,
    )

    expect(screen.getByText('Extractions')).toBeInTheDocument()
    expect(screen.getByText('Intro to biology')).toBeInTheDocument()
    expect(screen.getByText('teacher@example.com')).toBeInTheDocument()
    expect(screen.getByText('COMPLETED')).toBeInTheDocument()
  })
})