import { describe, expect, it } from 'vitest'
import { coThemes, firstImportOptions, hello, kidsLines, themeOf, wordCount } from '@/components/onboarding/meet-co/copy'
import { initialDraft, nextStep, patchFor, previousStep, validateStep } from '@/components/onboarding/meet-co/flow-logic'
import { emptyDraft, onboardingFixture } from '@/components/onboarding/meet-co/fixtures'

describe('kids copy', () => {
  it('keeps every spoken line at eight words or fewer, with and without a name or grade', () => {
    const lines = [...kidsLines.hello('Aarav'), ...kidsLines.hello(null), ...kidsLines.context(2), ...kidsLines.context(null), ...kidsLines.subjects, ...kidsLines.noSubjects, ...kidsLines.personalise, ...kidsLines.firstImport, ...kidsLines.done]
    for (const line of lines) expect(wordCount(line), line).toBeLessThanOrEqual(8)
  })
  it('has band-specific hello lines and four recoloured themes', () => {
    expect(hello('tweens', 'Mariam')).toContain('Mariam')
    expect(hello('teens', null)).not.toContain('null')
    expect(coThemes).toHaveLength(4)
    expect(themeOf('unknown-theme').key).toBe('sunrise')
  })
  it('offers first-import routes only to the existing B06 pages', () => {
    for (const options of Object.values(firstImportOptions)) for (const option of options) expect(['/learn/import', '/learn/snap']).toContain(option.href)
    expect(firstImportOptions.kids).toHaveLength(1)
  })
})

describe('step logic', () => {
  it('walks the five steps in order', () => {
    expect(nextStep('HELLO')).toBe('CONTEXT'); expect(nextStep('PERSONALISE')).toBe('FIRST_IMPORT'); expect(nextStep('FIRST_IMPORT')).toBeNull()
    expect(previousStep('HELLO')).toBeNull(); expect(previousStep('SUBJECTS')).toBe('CONTEXT')
  })
  it('seeds the draft from the school roster and fixes kids to SCHOOL', () => {
    const kids = onboardingFixture({ band: 'kids' })
    expect(initialDraft(kids)).toMatchObject({ board: 'CBSE', grade: 2, contexts: ['SCHOOL'] })
    const teens = onboardingFixture({ band: 'teens' })
    expect(initialDraft(teens)).toMatchObject({ board: null, grade: null })
  })
  it('never sends server-set board or grade back, nor kids free text', () => {
    const kids = onboardingFixture({ band: 'kids' })
    const patch = patchFor('SUBJECTS', 'kids', { ...initialDraft(kids), customSubjects: ['Hidden'], subjectIds: ['00000000-0000-4000-8000-000000000005'] }, kids)
    expect(patch).toEqual({ subjectIds: ['00000000-0000-4000-8000-000000000005'], customSubjects: [] })
    const preloaded = onboardingFixture({ band: 'teens', scenario: 'preload' })
    expect(patchFor('SUBJECTS', 'teens', initialDraft(preloaded), preloaded)).not.toHaveProperty('board')
    const open = onboardingFixture({ band: 'teens' })
    expect(patchFor('SUBJECTS', 'teens', { ...emptyDraft, board: 'ICSE', grade: 9 }, open)).toMatchObject({ board: 'ICSE', grade: 9, goal: null, examDate: null })
  })
  it('drops stale subject ids and trims free text', () => {
    const state = onboardingFixture({ band: 'tweens', scenario: 'preload' })
    const patch = patchFor('SUBJECTS', 'tweens', { ...initialDraft(state), subjectIds: ['gone', '00000000-0000-4000-8000-000000000002'], customSubjects: [' Robotics '] }, state)
    expect(patch.subjectIds).toEqual(['00000000-0000-4000-8000-000000000002']); expect(patch.customSubjects).toEqual(['Robotics'])
  })
  it('saves band-specific personalisation only', () => {
    const state = onboardingFixture({ band: 'teens' })
    expect(patchFor('PERSONALISE', 'teens', { ...emptyDraft, coPresence: 'MINIMAL', voiceEnabled: false, coTheme: 'leaf' }, state)).toEqual({ coPresence: 'MINIMAL', voiceEnabled: false })
    expect(patchFor('PERSONALISE', 'kids', { ...emptyDraft, coTheme: 'leaf', coNickname: ' Kiki ', coPresence: 'HIDDEN' }, state)).toEqual({ coTheme: 'leaf', coNickname: 'Kiki' })
    expect(patchFor('PERSONALISE', 'tweens', emptyDraft, state)).toEqual({ coNickname: null })
  })
  it('validates only what the server would reject', () => {
    expect(validateStep('SUBJECTS', 'teens', { ...emptyDraft, examDate: '2020-01-01' }, '2026-10-19')).toHaveProperty('examDate')
    expect(validateStep('SUBJECTS', 'teens', { ...emptyDraft, examDate: '2027-03-01' }, '2026-10-19')).toEqual({})
    expect(validateStep('SUBJECTS', 'teens', { ...emptyDraft, examDate: '2029-10-19' }, '2026-10-19')).toEqual({})
    expect(validateStep('SUBJECTS', 'teens', { ...emptyDraft, examDate: '2029-10-20' }, '2026-10-19')).toHaveProperty('examDate')
    expect(validateStep('SUBJECTS', 'tweens', { ...emptyDraft, customSubjects: ['One', 'Two', 'Three', 'Four', 'Five', 'Six'] })).toHaveProperty('customSubjects')
    expect(validateStep('SUBJECTS', 'teens', { ...emptyDraft, goal: 'x'.repeat(141) })).toHaveProperty('goal')
    expect(validateStep('SUBJECTS', 'tweens', { ...emptyDraft, customSubjects: ['x'] })).toHaveProperty('customSubjects')
    expect(validateStep('PERSONALISE', 'kids', { ...emptyDraft, coNickname: '<img>' })).toHaveProperty('coNickname')
    expect(validateStep('PERSONALISE', 'kids', { ...emptyDraft, coNickname: 'Kiki' })).toEqual({})
    expect(validateStep('HELLO', 'kids', emptyDraft)).toEqual({})
  })
})
