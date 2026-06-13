import { mockTreeNodes } from '@/lib/fixtures/teacher-ui'
import type { TeacherStudyPlan } from '@/lib/types/teacher'

export const seedTeacherPlans: TeacherStudyPlan[] = [
  {
    id: 'plan-algorithms-101',
    title: 'Algorithms 101',
    description: 'Foundations of sorting, searching, and complexity analysis for CS undergraduates.',
    status: 'PUBLISHED',
    enrollmentCount: 12,
    topicCount: 5,
    questionCount: 20,
    subjectTags: ['Computer Science', 'Mathematics'],
    updatedAt: '2026-06-10T14:30:00.000Z',
    publishedAt: '2026-06-01T09:00:00.000Z',
    tree: mockTreeNodes,
  },
  {
    id: 'plan-biology-intro',
    title: 'Intro to Biology',
    description: 'Cell structure, genetics, and ecology for high-school learners.',
    status: 'DRAFT',
    enrollmentCount: 0,
    topicCount: 0,
    questionCount: 0,
    subjectTags: ['Science'],
    updatedAt: '2026-06-11T11:15:00.000Z',
    publishedAt: null,
    tree: [
      {
        id: 'mod-bio-1',
        kind: 'module',
        title: 'Cell Biology',
        description: 'Organelles, membranes, and cellular processes.',
        children: [
          {
            id: 'topic-bio-1',
            kind: 'topic',
            title: 'Cell Structure',
            description: 'Identify major organelles and their functions.',
            children: [],
          },
        ],
      },
    ],
  },
]