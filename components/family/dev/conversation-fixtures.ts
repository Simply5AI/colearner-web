import type { FamilyConversations } from '@/lib/api/family-conversations'

/** Synthetic B10 fixtures (fictional children, invented chats). Used by the dev harness, the Playwright review and tests. */
export const harnessProfileId = 'profile-bluebird'
export const harnessSchoolId = 'school-a'
type Full = Extract<FamilyConversations, { access: 'FULL' }>
type Summaries = Extract<FamilyConversations, { access: 'SUMMARIES' }>

const day = (offset: number, hour = 16) => new Date(Date.UTC(2026, 9, 21 - offset, hour, 5, 0)).toISOString()

export const askCoPlants: Full['items'][number] = {
  id: 'conv-plants', kind: 'CHAT', title: 'Ask Co · Plants and sunlight', startedAt: day(0), turnCount: 4,
  turns: [
    { ordinal: 1, role: 'learner', text: 'Why do leaves need sunlight?', disposition: null, beyondMaterial: false, safety: null },
    { ordinal: 2, role: 'co', text: 'Leaves use sunlight to make food for the plant. This is called photosynthesis.', disposition: 'LEARNING', beyondMaterial: false, safety: null },
    { ordinal: 3, role: 'learner', text: 'Do plants in space grow too?', disposition: null, beyondMaterial: false, safety: null },
    { ordinal: 4, role: 'co', text: 'Your lesson does not talk about space, but scientists have grown some plants on space stations.', disposition: 'LEARNING', beyondMaterial: true, safety: null },
  ],
}
export const homeworkFractions: Full['items'][number] = {
  id: 'conv-fractions', kind: 'HOMEWORK', title: 'Homework help · Adding fractions', startedAt: day(1), turnCount: 3, homework: { phase: 'STEPS', hintsUsed: 2 },
  turns: [
    { ordinal: 1, role: 'learner', text: 'What is 1/2 + 1/4?', disposition: null, beyondMaterial: false, safety: null },
    { ordinal: 2, role: 'co', text: 'Let us start small. What do both fractions need to have in common before you can add them?', disposition: 'CLARIFY', beyondMaterial: false, safety: null },
    { ordinal: 3, role: 'learner', text: 'the bottom number?\nI think it is the denominator', disposition: null, beyondMaterial: false, safety: null },
  ],
}
export const safetyChat: Full['items'][number] = {
  id: 'conv-safety', kind: 'CHAT', title: 'Ask Co · Feeling left out', startedAt: day(2), turnCount: 2, safetyFlagCount: 1,
  turns: [
    { ordinal: 1, role: 'learner', text: 'Nobody wants to play with me at school.', disposition: null, beyondMaterial: false, safety: { redirected: true, reasonCodes: ['DISTRESS'] } },
    { ordinal: 2, role: 'co', text: 'That sounds hard.', disposition: 'TRUSTED_ADULT', beyondMaterial: false, safety: { redirected: true, reasonCodes: ['DISTRESS'], guidance: 'Please tell a grown-up you trust how you feel. They can help.' } },
  ],
}
export const oldChat: Full['items'][number] = {
  id: 'conv-old', kind: 'CHAT', title: 'Ask Co · The water cycle', startedAt: day(9), turnCount: 2,
  turns: [
    { ordinal: 1, role: 'learner', text: 'Where does rain come from?', disposition: null, beyondMaterial: false, safety: null },
    { ordinal: 2, role: 'co', text: 'Water rises as vapour, cools into clouds and falls as rain.', disposition: 'LEARNING', beyondMaterial: false, safety: null },
  ],
}
export const alerts: FamilyConversations['safetyAlerts'] = [
  { id: 'alert-2', createdAt: day(2), classification: 'distress', reasonCodes: ['DISTRESS'], conversationId: 'conv-safety' },
]
export const under14FirstPage: Full = { profileId: harnessProfileId, access: 'FULL', items: [askCoPlants, homeworkFractions, safetyChat], safetyAlerts: alerts, nextCursor: 'cursor-2' }
export const under14SecondPage: Full = { profileId: harnessProfileId, access: 'FULL', items: [oldChat], safetyAlerts: [], nextCursor: null }

export const teenSummaryItems: Summaries['items'] = [
  { id: 'conv-t1', kind: 'CHAT', title: 'Ask Co · Quadratic equations', startedAt: day(0), turnCount: 6, safetyFlagCount: 0 },
  { id: 'conv-t2', kind: 'HOMEWORK', title: 'Homework help · Balancing equations', startedAt: day(1), turnCount: 9, homework: { phase: 'CHECKED', hintsUsed: 1 }, safetyFlagCount: 0 },
  { id: 'conv-t3', kind: 'CHAT', title: 'Ask Co · Exam stress', startedAt: day(3), turnCount: 4, safetyFlagCount: 2 },
]
export const teenSummaries: Summaries = {
  profileId: harnessProfileId, access: 'SUMMARIES', items: teenSummaryItems, nextCursor: null,
  safetyAlerts: [
    { id: 'alert-t2', createdAt: day(3, 20), classification: 'distress', reasonCodes: ['DISTRESS'], conversationId: 'conv-t3' },
    { id: 'alert-t1', createdAt: day(3, 19), classification: 'human_review', reasonCodes: ['OTHER'], conversationId: 'conv-t3' },
  ],
}
export const teenGranted: Full = {
  profileId: harnessProfileId, access: 'FULL', nextCursor: null, safetyAlerts: teenSummaries.safetyAlerts,
  items: [{
    id: 'conv-t3', kind: 'CHAT', title: 'Ask Co · Exam stress', startedAt: day(3), turnCount: 4, safetyFlagCount: 2,
    turns: [
      { ordinal: 1, role: 'learner', text: 'I am so stressed about the exam that I cannot sleep.', disposition: null, beyondMaterial: false, safety: { redirected: true, reasonCodes: ['DISTRESS'] } },
      { ordinal: 2, role: 'co', text: 'That sounds really stressful.', disposition: 'TRUSTED_ADULT', beyondMaterial: false, safety: { redirected: true, reasonCodes: ['DISTRESS'], guidance: 'Talking to a trusted adult, such as a parent or a teacher, can help.' } },
    ],
  }],
}
export const emptyConversations = (access: 'FULL' | 'SUMMARIES'): FamilyConversations => ({ profileId: harnessProfileId, access, items: [], safetyAlerts: [], nextCursor: null, reason: 'NO_SCHOOL_SCOPED_CONVERSATIONS' }) as FamilyConversations

export const schoolPolicySettings = {
  timezone: 'Asia/Kolkata', dailyMinutes: 45, quietHours: [{ start: '21:00', end: '07:00' }], sources: ['school', 'class'], mediaSources: ['SNAP'], voiceAllowed: false, groupsAllowed: false, educationPackVersion: null,
}
