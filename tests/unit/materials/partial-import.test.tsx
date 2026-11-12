import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MaterialPartialNotice, PartialTag } from '@/components/materials/material-partial'
import { parsePageRange } from '@/lib/materials/page-range'
import { materialSchema } from '@/lib/api/materials'

describe('partial import notice', () => {
  it('says only the first part was imported, with the reason', () => {
    render(<MaterialPartialNotice material={{ partial: true, partialReason: 'This page is longer than CoLearner can read at once.' }} />)
    expect(screen.getByTestId('material-partial').textContent).toMatch(/Only the first part of this was imported\. This page is longer than CoLearner can read at once\./)
  })
  it('renders nothing for a complete import', () => {
    const { container } = render(<><MaterialPartialNotice material={{ partial: false, partialReason: null }} /><MaterialPartialNotice material={{}} /><PartialTag material={{ partial: false }} /></>)
    expect(container.textContent).toBe('')
  })
  it('shows a small Partial tag on a library card', () => {
    render(<PartialTag material={{ partial: true }} />)
    expect(screen.getByTestId('partial-tag').textContent).toBe('Partial')
  })
})

describe('page range control', () => {
  it('accepts blank, and a valid range', () => {
    expect(parsePageRange('', '')).toEqual({ range: null, error: null })
    expect(parsePageRange('12', '30')).toEqual({ range: { pageFrom: 12, pageTo: 30 }, error: null })
  })
  it.each([['12', ''], ['', '5'], ['0', '3'], ['2.5', '4'], ['9', '3'], ['1', '51']])('refuses %s to %s', (from, to) => {
    expect(parsePageRange(from, to).error).toBeTruthy()
  })
  it('limits the span to the allowed number of pages', () => {
    expect(parsePageRange('1', '4', 3).error).toMatch(/at most 3/)
  })
})

describe('material contract', () => {
  const base = { id: 'a', title: 'T', sourceType: 'web', subjectId: null, subjectName: 'S', planId: null, planTitle: null, createdAt: '', updatedAt: '', status: 'ready', stage: 'ready', progress: 100, jobId: 'j', sourceVersionRef: null, concepts: [], error: null, links: { reader: null, lesson: null, practice: null, original: null }, actions: { retry: false, cancel: false, delete: true, addToPlan: true } }
  it('reads partial and its reason, defaulting to complete', () => {
    expect(materialSchema.parse({ ...base, partial: true, partialReason: 'Long.' })).toMatchObject({ partial: true, partialReason: 'Long.' })
    expect(materialSchema.parse(base)).toMatchObject({ partial: false, partialReason: null })
  })
})
