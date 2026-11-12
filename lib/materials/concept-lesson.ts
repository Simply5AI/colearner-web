/** The lesson route of one key idea: the material's whole-material lesson route plus `conceptId` (pack 0.1.11). Pure. */
export function conceptLessonHref(lessonRoute: string | null | undefined, conceptId: string): string | null {
  if (!lessonRoute || !lessonRoute.startsWith('/learn/lesson/new?') || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(conceptId)) return null
  return `${lessonRoute}&conceptId=${encodeURIComponent(conceptId)}`
}
