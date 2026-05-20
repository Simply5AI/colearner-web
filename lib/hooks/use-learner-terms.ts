'use client'

import { useProfile } from './use-profile'

export function useLearnerTerms() {
  const { data: profile } = useProfile()
  const isStudent = profile?.learnerType === 'STUDENT'

  return {
    isStudent,
    planLabel: isStudent ? 'Subject' : 'Study Plan',
    plansLabel: isStudent ? 'Subjects' : 'Study Plans',
    goalLabel: 'Goal',
    goalsLabel: 'Goals',
    newPlanLabel: isStudent ? 'Add Subject' : 'New Study Plan',
    phaseLabel: isStudent ? 'Learning Step' : 'Phase',
    phasesLabel: isStudent ? 'Learning Steps' : 'Phases',
    pageSubtitle: isStudent
      ? 'Organize captures by the subjects and interests you study.'
      : 'AI-generated learning paths, syllabus imports, and exam prep plans',
  }
}
