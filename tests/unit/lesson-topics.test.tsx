import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { lessonDetailSchema, lessonListSchema, type LessonBlock } from '@/lib/api/lesson'
import { lessonDetailFixture } from '@/components/lesson/dev/lesson-fixtures'
import { WorkedExampleCard, SourceChips } from '@/components/lesson/lesson-parts'
import { TopicTabs } from '@/components/lesson/lesson-tabs'
import { lessonOfTopic, topicsOf } from '@/components/lesson/lesson-workspace'
import { buildScript, blockText } from '@/components/lesson/lesson-model'
import { conceptLessonHref } from '@/lib/materials/concept-lesson'

const example: Extract<LessonBlock, { type: 'WORKED_EXAMPLE' }> = { type: 'WORKED_EXAMPLE', origin: 'CO', problem: 'What is 4 x 3?', workSteps: ['4 x 3 means 4 + 4 + 4.', '4 + 4 + 4 = 12.'], answer: '12' }
const CONCEPT = '70000000-0000-4000-8000-00000000000a'

describe('WORKED_EXAMPLE blocks (schema revision 4)', () => {
  it('parse inside a lesson, and old lessons without them still parse', () => {
    const detail = JSON.parse(JSON.stringify(lessonDetailFixture('teens')))
    expect(lessonDetailSchema.safeParse(detail).success).toBe(true)
    detail.content.steps[3].blocks.push(example)
    expect(lessonDetailSchema.safeParse(detail).success).toBe(true)
    detail.content.steps[3].blocks.push({ ...example, origin: 'TEACHER' })
    expect(lessonDetailSchema.safeParse(detail).success).toBe(false)
  })
  it('read aloud covers the problem and the steps; the answer has no spoken segment', () => {
    const script = buildScript({ coLine: 'Look.', blocks: [example], check: null })
    expect(script.text).toContain('What is 4 x 3')
    expect(Object.keys(script.starts)).toEqual(['coLine', 'b0p', 'b0w0', 'b0w1'])  // no segment for the answer
    expect(blockText(example)).toContain('12')
  })
  it('shows the problem and numbered steps, and keeps the answer behind a toggle button', async () => {
    const user = userEvent.setup()
    render(<WorkedExampleCard block={example} band="tweens" id="b0" />)
    expect(screen.getByText("Co's own example")).toBeVisible()
    expect(screen.getByRole('list', { name: 'Steps' }).tagName).toBe('OL')
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
    const button = screen.getByRole('button', { name: 'Show answer' })
    expect(button).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByTestId('worked-example-answer')).not.toBeVisible()
    await user.click(button)
    expect(screen.getByRole('button', { name: 'Hide answer' })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByTestId('worked-example-answer')).toBeVisible()
  })
  it('labels a source example "From your material"', () => {
    render(<WorkedExampleCard block={{ ...example, origin: 'SOURCE' }} band="teens" id="b1" />)
    expect(screen.getByText('From your material')).toBeVisible()
    expect(screen.queryByText("Co's own example")).toBeNull()
  })
})

describe('video citation chips', () => {
  const sources = [{ label: '0:06', anchorRef: 'a1', quote: 'x', startMs: 6000 }, { label: 'page 2', anchorRef: 'a2', quote: 'y', startMs: null }]
  it('link a YouTube moment in a new tab and keep the in-app chip', () => {
    render(<SourceChips sources={sources} materialHref="/learn/library/m1" band="teens" sourceUrl="https://www.youtube.com/watch?v=IwW0GJWKH98" />)
    const watch = screen.getAllByTestId('source-moment')
    expect(watch).toHaveLength(1)
    expect(watch[0]).toHaveAttribute('href', 'https://www.youtube.com/watch?v=IwW0GJWKH98&t=6s')
    expect(watch[0]).toHaveAttribute('target', '_blank')
    expect(watch[0]).toHaveAttribute('rel', expect.stringContaining('noopener'))
    expect(screen.getByRole('link', { name: /From 0:06/ })).toHaveAttribute('href', '/learn/library/m1')
  })
  it('add nothing without a YouTube address', () => {
    render(<SourceChips sources={sources} materialHref="/learn/library/m1" band="teens" sourceUrl="https://example.com/a" />)
    expect(screen.queryByTestId('source-moment')).toBeNull()
  })
})

describe('topic tabs', () => {
  const concepts = [{ id: CONCEPT, label: 'Repeated addition' }, { id: 'c2', label: 'Commutative property' }]
  it('are Overview then the key ideas in order, with a one-line summary from the analysis', () => {
    const topics = topicsOf(concepts, { concepts: [{ name: 'Repeated addition', description: 'Adding the same number again. It is how times works.' }] })
    expect(topics.map(topic => topic.key)).toEqual(['overview', CONCEPT, 'c2'])
    expect(topics[1]!.summary).toBe('Adding the same number again.')
    expect(topics[2]!.summary).toBeNull()
  })
  it('finds a topic lesson by concept, the overview by a null concept', () => {
    const topics = topicsOf(concepts, null)
    const lessons = [{ id: 'l0', conceptId: null }, { id: 'l1', conceptId: CONCEPT }] as never
    expect(lessonOfTopic(lessons, topics[0]!)?.id).toBe('l0')
    expect(lessonOfTopic(lessons, topics[1]!)?.id).toBe('l1')
    expect(lessonOfTopic(lessons, topics[2]!)).toBeNull()
  })
  it('is a roving tablist: arrows, Home and End move and select, only the selected tab is tabbable', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    const tabs = [{ key: 'overview', label: 'Overview', state: 'ready' as const }, { key: 'a', label: 'A', state: 'none' as const }, { key: 'b', label: 'B', state: 'making' as const }]
    render(<TopicTabs scope="t" tabs={tabs} selected="overview" onSelect={onSelect} />)
    expect(screen.getByRole('tablist', { name: 'Topics in this lesson' })).toBeVisible()
    expect(screen.getAllByRole('tab').map(tab => tab.getAttribute('tabindex'))).toEqual(['0', '-1', '-1'])
    expect(screen.getByRole('tab', { name: /Overview/ })).toHaveAttribute('aria-selected', 'true')
    screen.getByRole('tab', { name: /Overview/ }).focus()
    await user.keyboard('{ArrowRight}')
    expect(onSelect).toHaveBeenLastCalledWith('a')
    await user.keyboard('{End}')
    expect(onSelect).toHaveBeenLastCalledWith('b')
  })
})

describe('lesson list and key-idea links', () => {
  it('parses the topic list and a lesson summary with or without a concept', () => {
    const base = { id: 'l', materialId: 'm', title: null, status: 'QUEUED', version: 1, band: '10-13', createdAt: 'now', readyAt: null, failure: null }
    expect(lessonListSchema.safeParse({ lessons: [base, { ...base, id: 'l2', conceptId: CONCEPT }] }).success).toBe(true)
  })
  it('builds the "Learn this" route only from a lesson route and a concept uuid', () => {
    expect(conceptLessonHref('/learn/lesson/new?materialId=m1', CONCEPT)).toBe(`/learn/lesson/new?materialId=m1&conceptId=${CONCEPT}`)
    expect(conceptLessonHref(null, CONCEPT)).toBeNull()
    expect(conceptLessonHref('/learn/lesson/new?materialId=m1', 'not-a-uuid')).toBeNull()
    expect(conceptLessonHref('https://evil.test/x?', CONCEPT)).toBeNull()
  })
})
