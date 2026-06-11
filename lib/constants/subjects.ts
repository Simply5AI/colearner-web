import type { SubjectItem } from '@/lib/types'

export const CORE_SCHOOL_SUBJECTS: SubjectItem[] = [
  { id: 'mathematics', name: 'Mathematics', slug: 'mathematics', icon: 'calculator', sortOrder: 1 },
  { id: 'science', name: 'Science', slug: 'science', icon: 'flask', sortOrder: 2 },
  { id: 'english', name: 'English', slug: 'english', icon: 'book-open', sortOrder: 3 },
  { id: 'history', name: 'History', slug: 'history', icon: 'landmark', sortOrder: 4 },
  { id: 'geography', name: 'Geography', slug: 'geography', icon: 'map', sortOrder: 5 },
  { id: 'computer-science', name: 'Computer Science', slug: 'computer-science', icon: 'code', sortOrder: 6 },
  { id: 'languages', name: 'Languages', slug: 'languages', icon: 'globe', sortOrder: 7 },
  { id: 'business-studies', name: 'Business Studies', slug: 'business-studies', icon: 'briefcase', sortOrder: 8 },
  { id: 'economics', name: 'Economics', slug: 'economics', icon: 'chart-line', sortOrder: 9 },
  { id: 'art', name: 'Art', slug: 'art', icon: 'palette', sortOrder: 10 },
  { id: 'music', name: 'Music', slug: 'music', icon: 'music', sortOrder: 11 },
  { id: 'physical-education', name: 'Physical Education', slug: 'physical-education', icon: 'dumbbell', sortOrder: 12 },
]

export function getDisplaySubjects(subjects: SubjectItem[] | undefined | null): SubjectItem[] {
  return subjects && subjects.length > 0 ? subjects : CORE_SCHOOL_SUBJECTS
}
