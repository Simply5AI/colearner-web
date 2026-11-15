import requestsJson from './requests.json'
import responsesJson from './responses.json'

export const tutorFixtureRequests = requestsJson.requests
export const tutorFixtureResponses = responsesJson.responses
export type TutorFixtureKey = keyof typeof tutorFixtureResponses
export type TutorFixtureResponses = typeof tutorFixtureResponses

export function getTutorFixture<K extends TutorFixtureKey>(key: K): TutorFixtureResponses[K] {
  return structuredClone(tutorFixtureResponses[key])
}

/**
 * Resolves a contract fixture response for a given HTTP method and `/tutor-loop` relative path
 * (e.g. `GET`, `/plans` -> `tutorFixtureResponses.plans`).
 */
export function resolveTutorLoopFixture(
  method: string,
  path: string,
): { status: number; body: unknown; fixtureKey: TutorFixtureKey } | null {
  const cleanPath = (path.split('?')[0] ?? path).replace(/^\/api\/(?:v1\/)?learn\/tutor-loop/, '').replace(/^\/tutor-loop/, '') || '/'
  const m = method.toUpperCase()

  if (m === 'GET' && cleanPath === '/entry') return { status: 200, body: getTutorFixture('entry'), fixtureKey: 'entry' }
  if (m === 'POST' && cleanPath === '/adult-consent') return { status: 200, body: getTutorFixture('adultConsent'), fixtureKey: 'adultConsent' }
  if (m === 'DELETE' && cleanPath === '/adult-consent') return { status: 200, body: getTutorFixture('revoked'), fixtureKey: 'revoked' }

  if (m === 'GET' && cleanPath === '/goals') return { status: 200, body: getTutorFixture('goals'), fixtureKey: 'goals' }
  if (m === 'POST' && cleanPath === '/goals') return { status: 201, body: getTutorFixture('goal'), fixtureKey: 'goal' }
  if (m === 'PUT' && cleanPath === '/goals/order') return { status: 200, body: getTutorFixture('goals'), fixtureKey: 'goals' }
  if (/^\/goals\/[^/]+$/.test(cleanPath)) {
    if (m === 'GET' || m === 'PATCH') return { status: 200, body: getTutorFixture('goal'), fixtureKey: 'goal' }
    if (m === 'DELETE') return { status: 200, body: getTutorFixture('archived'), fixtureKey: 'archived' }
  }

  if (m === 'GET' && cleanPath === '/exams') return { status: 200, body: getTutorFixture('exams'), fixtureKey: 'exams' }
  if (m === 'POST' && cleanPath === '/exams') return { status: 201, body: getTutorFixture('exam'), fixtureKey: 'exam' }
  if (/^\/exams\/[^/]+\/readiness$/.test(cleanPath) && m === 'GET') {
    return { status: 200, body: getTutorFixture('readiness'), fixtureKey: 'readiness' }
  }
  if (/^\/exams\/[^/]+$/.test(cleanPath)) {
    if (m === 'GET' || m === 'PATCH') return { status: 200, body: getTutorFixture('exam'), fixtureKey: 'exam' }
    if (m === 'DELETE') return { status: 200, body: getTutorFixture('archived'), fixtureKey: 'archived' }
  }

  if (m === 'GET' && cleanPath === '/plans') return { status: 200, body: getTutorFixture('plans'), fixtureKey: 'plans' }
  if (m === 'POST' && cleanPath === '/plans') return { status: 201, body: getTutorFixture('plan'), fixtureKey: 'plan' }
  if (/^\/plans\/[^/]+\/topics\/[^/]+\/materials\/[^/]+$/.test(cleanPath)) {
    if (m === 'PUT') return { status: 200, body: getTutorFixture('topicMaterial'), fixtureKey: 'topicMaterial' }
    if (m === 'DELETE') return { status: 200, body: getTutorFixture('removed'), fixtureKey: 'removed' }
  }
  if (/^\/plans\/[^/]+$/.test(cleanPath) && (m === 'GET' || m === 'PATCH')) {
    return { status: 200, body: getTutorFixture('plan'), fixtureKey: 'plan' }
  }

  if (m === 'POST' && cleanPath === '/plan-drafts') {
    return { status: 202, body: getTutorFixture('planDraftQueued'), fixtureKey: 'planDraftQueued' }
  }
  if (/^\/plan-drafts\/[^/]+\/cancel$/.test(cleanPath) && m === 'POST') {
    return { status: 200, body: getTutorFixture('planDraftCancelled'), fixtureKey: 'planDraftCancelled' }
  }
  if (/^\/plan-drafts\/[^/]+\/regenerate$/.test(cleanPath) && m === 'POST') {
    return { status: 202, body: getTutorFixture('planDraftQueued'), fixtureKey: 'planDraftQueued' }
  }
  if (/^\/plan-drafts\/[^/]+\/accept$/.test(cleanPath) && m === 'POST') {
    return { status: 200, body: getTutorFixture('plan'), fixtureKey: 'plan' }
  }
  if (/^\/plan-drafts\/[^/]+$/.test(cleanPath) && m === 'GET') {
    return { status: 200, body: getTutorFixture('planDraftReady'), fixtureKey: 'planDraftReady' }
  }

  if (cleanPath === '/profile' && (m === 'GET' || m === 'PATCH')) {
    return { status: 200, body: getTutorFixture('profile'), fixtureKey: 'profile' }
  }
  if (cleanPath === '/study-preferences' && m === 'GET') {
    return { status: 200, body: getTutorFixture('preferences'), fixtureKey: 'preferences' }
  }
  if (cleanPath === '/study-preferences/preview' && m === 'POST') {
    return { status: 200, body: getTutorFixture('schedulePreview'), fixtureKey: 'schedulePreview' }
  }
  if (cleanPath === '/today' && m === 'GET') {
    return { status: 200, body: getTutorFixture('today'), fixtureKey: 'today' }
  }
  if (cleanPath === '/schedule' && m === 'GET') {
    return { status: 200, body: getTutorFixture('schedule'), fixtureKey: 'schedule' }
  }
  if (cleanPath === '/schedule/calendar.ics' && m === 'GET') {
    return { status: 200, body: getTutorFixture('calendarIcs'), fixtureKey: 'calendarIcs' }
  }
  if (/^\/schedule\/(?:move-preview|replan-preview|day-off-preview)$/.test(cleanPath) && m === 'POST') {
    return { status: 200, body: getTutorFixture('schedulePreview'), fixtureKey: 'schedulePreview' }
  }
  if (/^\/schedule\/previews\/[^/]+\/apply$/.test(cleanPath) && m === 'POST') {
    return { status: 200, body: getTutorFixture('scheduleApplied'), fixtureKey: 'scheduleApplied' }
  }

  if (cleanPath === '/progress' && m === 'GET') {
    return { status: 200, body: getTutorFixture('progress'), fixtureKey: 'progress' }
  }
  if (cleanPath === '/progress/export.csv' && m === 'GET') {
    return { status: 200, body: getTutorFixture('progressCsv'), fixtureKey: 'progressCsv' }
  }
  if (cleanPath === '/progress/export.pdf' && m === 'GET') {
    return { status: 200, body: getTutorFixture('progressPdf'), fixtureKey: 'progressPdf' }
  }

  if (/^\/activities\/[^/]+\/[^/]+\/next$/.test(cleanPath) && m === 'GET') {
    return { status: 200, body: getTutorFixture('nextStep'), fixtureKey: 'nextStep' }
  }
  if (cleanPath === '/search' && m === 'GET') {
    return { status: 200, body: getTutorFixture('search'), fixtureKey: 'search' }
  }
  if (cleanPath === '/library' && m === 'GET') {
    return { status: 200, body: getTutorFixture('library'), fixtureKey: 'library' }
  }
  if (cleanPath === '/notes' && m === 'GET') {
    return { status: 200, body: getTutorFixture('notes'), fixtureKey: 'notes' }
  }

  if (cleanPath === '/practice' && m === 'GET') {
    return { status: 200, body: getTutorFixture('practice'), fixtureKey: 'practice' }
  }
  if (/^\/practice\/topics\/[^/]+$/.test(cleanPath) && m === 'GET') {
    return { status: 200, body: getTutorFixture('practiceTopic'), fixtureKey: 'practiceTopic' }
  }
  if (cleanPath === '/practice/question-sets' && m === 'POST') {
    return { status: 202, body: getTutorFixture('questionSet'), fixtureKey: 'questionSet' }
  }
  if (/^\/practice\/sessions\/[^/]+\/items\/\d+\/answer$/.test(cleanPath) && m === 'POST') {
    return { status: 200, body: getTutorFixture('practiceAnswer'), fixtureKey: 'practiceAnswer' }
  }

  if (cleanPath === '/lessons' && m === 'POST') {
    return { status: 202, body: getTutorFixture('shortLessonQueued'), fixtureKey: 'shortLessonQueued' }
  }
  if (/^\/lessons\/[^/]+$/.test(cleanPath) && m === 'GET') {
    return { status: 200, body: getTutorFixture('shortLessonReady'), fixtureKey: 'shortLessonReady' }
  }

  if (cleanPath === '/exam-prep' && m === 'GET') {
    return { status: 200, body: getTutorFixture('examPrep'), fixtureKey: 'examPrep' }
  }
  if (cleanPath === '/mock-builds' && m === 'POST') {
    return { status: 202, body: getTutorFixture('mockBuildQueued'), fixtureKey: 'mockBuildQueued' }
  }
  if (/^\/mock-builds\/[^/]+\/cancel$/.test(cleanPath) && m === 'POST') {
    return { status: 200, body: getTutorFixture('mockBuildCancelled'), fixtureKey: 'mockBuildCancelled' }
  }
  if (/^\/mock-builds\/[^/]+\/start$/.test(cleanPath) && m === 'POST') {
    return { status: 201, body: getTutorFixture('mockSitting'), fixtureKey: 'mockSitting' }
  }
  if (/^\/mock-builds\/[^/]+$/.test(cleanPath) && m === 'GET') {
    return { status: 200, body: getTutorFixture('mockBuildReady'), fixtureKey: 'mockBuildReady' }
  }

  if (/^\/mock-sittings\/[^/]+\/items\/\d+$/.test(cleanPath)) {
    if (m === 'GET') return { status: 200, body: getTutorFixture('mockItem'), fixtureKey: 'mockItem' }
    if (m === 'PUT') return { status: 200, body: getTutorFixture('mockSave'), fixtureKey: 'mockSave' }
  }
  if (/^\/mock-sittings\/[^/]+\/submit$/.test(cleanPath) && m === 'POST') {
    return { status: 200, body: getTutorFixture('mockResult'), fixtureKey: 'mockResult' }
  }
  if (/^\/mock-sittings\/[^/]+\/result$/.test(cleanPath) && m === 'GET') {
    return { status: 200, body: getTutorFixture('mockResult'), fixtureKey: 'mockResult' }
  }
  if (/^\/mock-sittings\/[^/]+\/review$/.test(cleanPath) && m === 'GET') {
    return { status: 200, body: getTutorFixture('mockReview'), fixtureKey: 'mockReview' }
  }
  if (/^\/mock-sittings\/[^/]+\/revision-preview$/.test(cleanPath) && m === 'POST') {
    return { status: 200, body: getTutorFixture('schedulePreview'), fixtureKey: 'schedulePreview' }
  }
  if (/^\/mock-sittings\/[^/]+$/.test(cleanPath) && m === 'GET') {
    return { status: 200, body: getTutorFixture('mockSitting'), fixtureKey: 'mockSitting' }
  }

  if (cleanPath === '/co/context' && m === 'GET') {
    return { status: 200, body: getTutorFixture('tutorContext'), fixtureKey: 'tutorContext' }
  }
  if (cleanPath === '/co/sessions' && m === 'GET') {
    return { status: 200, body: getTutorFixture('tutorSessions'), fixtureKey: 'tutorSessions' }
  }
  if (cleanPath === '/co/sessions' && m === 'POST') {
    return { status: 201, body: getTutorFixture('tutorSession'), fixtureKey: 'tutorSession' }
  }
  if (/^\/co\/sessions\/[^/]+\/close$/.test(cleanPath) && m === 'POST') {
    return { status: 200, body: getTutorFixture('tutorSessionClosed'), fixtureKey: 'tutorSessionClosed' }
  }
  if (/^\/co\/sessions\/[^/]+\/turns\/[^/]+\/retry$/.test(cleanPath) && m === 'POST') {
    return { status: 202, body: getTutorFixture('tutorTurnQueued'), fixtureKey: 'tutorTurnQueued' }
  }
  if (/^\/co\/sessions\/[^/]+\/turns\/[^/]+\/cancel$/.test(cleanPath) && m === 'POST') {
    return { status: 200, body: getTutorFixture('tutorTurnCancelled'), fixtureKey: 'tutorTurnCancelled' }
  }
  if (/^\/co\/sessions\/[^/]+\/turns\/[^/]+$/.test(cleanPath) && m === 'GET') {
    return { status: 200, body: getTutorFixture('tutorTurnReady'), fixtureKey: 'tutorTurnReady' }
  }
  if (/^\/co\/sessions\/[^/]+\/turns$/.test(cleanPath) && m === 'POST') {
    return { status: 202, body: getTutorFixture('tutorTurnQueued'), fixtureKey: 'tutorTurnQueued' }
  }
  if (/^\/co\/sessions\/[^/]+$/.test(cleanPath)) {
    if (m === 'GET') return { status: 200, body: getTutorFixture('tutorSession'), fixtureKey: 'tutorSession' }
    if (m === 'DELETE') return { status: 200, body: getTutorFixture('removed'), fixtureKey: 'removed' }
  }

  if (/^\/co\/proposals\/[^/]+\/accept$/.test(cleanPath) && m === 'POST') {
    return { status: 200, body: getTutorFixture('proposalAccepted'), fixtureKey: 'proposalAccepted' }
  }
  if (cleanPath === '/co/memory' && m === 'GET') {
    return { status: 200, body: getTutorFixture('memory'), fixtureKey: 'memory' }
  }
  if (cleanPath === '/co/memory/forget' && m === 'POST') {
    return { status: 200, body: getTutorFixture('forgotten'), fixtureKey: 'forgotten' }
  }
  if (/^\/co\/memory\/[^/]+$/.test(cleanPath)) {
    if (m === 'PATCH') return { status: 200, body: getTutorFixture('memoryFact'), fixtureKey: 'memoryFact' }
    if (m === 'DELETE') return { status: 200, body: getTutorFixture('removed'), fixtureKey: 'removed' }
  }

  if (cleanPath === '/co/nudges' && m === 'GET') {
    return { status: 200, body: getTutorFixture('nudges'), fixtureKey: 'nudges' }
  }
  if (/^\/co\/nudges\/[^/]+\/dismiss$/.test(cleanPath) && m === 'POST') {
    return { status: 200, body: getTutorFixture('dismissed'), fixtureKey: 'dismissed' }
  }
  if (/^\/co\/nudges\/mutes\/[^/]+$/.test(cleanPath) && m === 'PUT') {
    return { status: 200, body: getTutorFixture('nudgeMute'), fixtureKey: 'nudgeMute' }
  }

  if (cleanPath === '/co/find-material' && m === 'POST') {
    return { status: 200, body: getTutorFixture('materialProposals'), fixtureKey: 'materialProposals' }
  }
  if (/^\/co\/find-material\/[^/]+\/add$/.test(cleanPath) && m === 'POST') {
    return { status: 202, body: getTutorFixture('materialAdded'), fixtureKey: 'materialAdded' }
  }

  return null
}
