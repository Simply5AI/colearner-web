'use client'

import { useProfile } from './use-profile'

export function useLearnerTerms() {
  const { data: profile } = useProfile()
  const isStudent = profile?.learnerType === 'STUDENT'

  return {
    isStudent,
    planLabel: isStudent ? 'Subject' : 'Study Plan',
    plansLabel: isStudent ? 'Subjects' : 'Study Plans',
    goalLabel: isStudent ? 'Subject' : 'Goal',
    goalsLabel: isStudent ? 'Subjects' : 'Goals',
    newPlanLabel: isStudent ? 'New Subject' : 'New Study Plan',
    phaseLabel: isStudent ? 'Level' : 'Phase',
    phasesLabel: isStudent ? 'Levels' : 'Phases',
    pageSubtitle: isStudent
      ? 'Your academic subjects and learning progress'
      : 'AI-generated learning paths, syllabus imports, and exam prep plans',
  }
}
