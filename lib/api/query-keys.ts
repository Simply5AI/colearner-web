/** React Query key factory — consistent keys for cache invalidation */
export const queryKeys = {
  mastery: {
    all: ['mastery'] as const,
    concepts: () => [...queryKeys.mastery.all, 'concepts'] as const,
    concept: (id: string) => [...queryKeys.mastery.all, 'concept', id] as const,
    due: () => [...queryKeys.mastery.all, 'due'] as const,
    analytics: () => [...queryKeys.mastery.all, 'analytics'] as const,
    topics: () => [...queryKeys.mastery.all, 'topics'] as const,
  },

  recall: {
    all: ['recall'] as const,
    session: (id: string) => [...queryKeys.recall.all, 'session', id] as const,
    history: () => [...queryKeys.recall.all, 'history'] as const,
    summary: (id: string) => [...queryKeys.recall.all, 'summary', id] as const,
  },

  extraction: {
    all: ['extraction'] as const,
    status: (id: string) => [...queryKeys.extraction.all, 'status', id] as const,
    result: (id: string) => [...queryKeys.extraction.all, 'result', id] as const,
    history: () => [...queryKeys.extraction.all, 'history'] as const,
  },

  user: {
    all: ['user'] as const,
    profile: () => [...queryKeys.user.all, 'profile'] as const,
    ncu: () => [...queryKeys.user.all, 'ncu'] as const,
    streak: () => [...queryKeys.user.all, 'streak'] as const,
    notifications: () => [...queryKeys.user.all, 'notifications'] as const,
  },

  billing: {
    all: ['billing'] as const,
    status: () => [...queryKeys.billing.all, 'status'] as const,
  },

  dashboard: {
    all: ['dashboard'] as const,
    stats: () => [...queryKeys.dashboard.all, 'stats'] as const,
    queue: (filters?: Record<string, string>) =>
      [...queryKeys.dashboard.all, 'queue', filters] as const,
    activity: (page?: number) =>
      [...queryKeys.dashboard.all, 'activity', page] as const,
    sourceProgress: () =>
      [...queryKeys.dashboard.all, 'source-progress'] as const,
    streak: () => [...queryKeys.dashboard.all, 'streak'] as const,
  },

  capture: {
    all: ['capture'] as const,
    stats: () => [...queryKeys.capture.all, 'stats'] as const,
    progress: (id: string) =>
      [...queryKeys.capture.all, 'progress', id] as const,
  },

  masteryAnalytics: {
    all: ['mastery-analytics'] as const,
    stats: (range: string) =>
      [...queryKeys.masteryAnalytics.all, 'stats', range] as const,
    daily: (range: string) =>
      [...queryKeys.masteryAnalytics.all, 'daily', range] as const,
    byType: () => [...queryKeys.masteryAnalytics.all, 'by-type'] as const,
    ledger: (params?: Record<string, string>) =>
      [...queryKeys.masteryAnalytics.all, 'ledger', params] as const,
  },
}
