import {
  emptyConversations, harnessProfileId, schoolPolicySettings, teenGranted, teenSummaries, under14FirstPage, under14SecondPage,
} from './conversation-fixtures'

export const conversationScenarios = ['under14', 'teen', 'empty', 'teen-empty', 'denied', 'error', 'page-error', 'teen-leak', 'grant-denied'] as const
export type ConversationScenario = (typeof conversationScenarios)[number]
export interface MockReply { status: number; body: unknown }
export interface ConversationMockOptions { scenario: ConversationScenario; grantMinutes?: number; policy?: 'default' | 'set'; policyConflict?: boolean }

const envelope = (data: unknown, status = 200): MockReply => ({ status, body: status >= 400 ? data : { statusCode: status, data, timestamp: '2026-10-21T10:00:00.000Z' } })

/** Contract-faithful stand-in for the family conversations, safety-access and school learning-policy endpoints. */
export function createConversationMock(options: ConversationMockOptions) {
  const requests: { method: string; path: string; body?: unknown }[] = []
  let policyRevision = 3
  let policySettings: Record<string, unknown> = options.policy === 'set'
    ? { ...schoolPolicySettings, askCoAllowed: true, homeworkHelpAllowed: true, homeworkHintsMax: 2 }
    : { ...schoolPolicySettings }
  let grantIssued = false
  let secondPageFailures = options.scenario === 'page-error' ? 1 : 0
  function handle(method: string, pathWithQuery: string, body?: unknown): MockReply {
    const url = new URL(pathWithQuery, 'http://mock.test')
    const path = url.pathname.replace(/^\/api\/v1/, '')
    requests.push({ method, path: path + url.search, body })
    if (path === '/api/auth/session') return { status: 200, body: { user: { id: 'parent-a' }, accessToken: 'parent-token', expires: '2099-01-01T00:00:00.000Z' } }
    if (path === `/family/profiles/${harnessProfileId}/safety-access` && method === 'POST') {
      if (options.scenario === 'grant-denied') return { status: 403, body: { code: 'FORBIDDEN' } }
      grantIssued = true
      return envelope({ safetyGrantId: '11111111-1111-4111-8111-111111111111', expiresAt: new Date(Date.now() + (options.grantMinutes ?? 15) * 60_000).toISOString(), profileId: harnessProfileId })
    }
    if (path === `/family/profiles/${harnessProfileId}/conversations` && method === 'GET') {
      const grant = url.searchParams.get('safetyGrantId')
      const cursor = url.searchParams.get('cursor')
      switch (options.scenario) {
        case 'denied': return { status: 403, body: { code: 'FORBIDDEN' } }
        case 'error': return { status: 503, body: {} }
        case 'empty': return envelope(emptyConversations('FULL'))
        case 'teen-empty': return envelope(emptyConversations('SUMMARIES'))
        case 'grant-denied':
        case 'teen': return envelope(grant && grantIssued ? teenGranted : teenSummaries)
        case 'teen-leak': return envelope({ ...teenSummaries, items: teenSummaries.items.map(item => ({ ...item, turns: [{ ordinal: 1, role: 'learner', text: 'private message', disposition: null, beyondMaterial: false }] })) })
        case 'page-error':
          if (cursor && secondPageFailures > 0) { secondPageFailures--; return { status: 503, body: {} } }
          return envelope(cursor ? under14SecondPage : under14FirstPage)
        default: return envelope(cursor ? under14SecondPage : under14FirstPage)
      }
    }
    const policy = path.match(/^\/schools\/([^/]+)\/learning-policy$/)
    if (policy && method === 'GET') return envelope({ schoolId: policy[1], revision: policyRevision, settings: policySettings, availablePackVersions: ['edu-0.1.4'] })
    if (policy && method === 'PUT') {
      if (options.policyConflict) return { status: 409, body: { code: 'POLICY_REVISION_CONFLICT' } }
      const request = body as { expectedRevision: number; settings: Record<string, unknown> }
      policySettings = request.settings
      policyRevision += 1
      return envelope({ schoolId: policy[1], revision: policyRevision, settings: policySettings })
    }
    return { status: 404, body: { code: 'NOT_FOUND' } }
  }
  return { options, requests, handle }
}
export type ConversationMock = ReturnType<typeof createConversationMock>
