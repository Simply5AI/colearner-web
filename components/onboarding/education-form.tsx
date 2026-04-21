'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'
import { useOnboardingStore } from '@/lib/stores/onboarding-store'

const EDUCATION_LEVELS = [
  { value: 'HIGH_SCHOOL', label: 'High School' },
  { value: 'DIPLOMA', label: 'Diploma' },
  { value: 'BACHELORS', label: "Bachelor's Degree" },
  { value: 'MASTERS', label: "Master's Degree" },
  { value: 'PHD', label: 'PhD' },
  { value: 'SELF_TAUGHT', label: 'Self-Taught' },
  { value: 'OTHER', label: 'Other' },
]

const COMMON_FIELDS = [
  'Computer Science', 'Software Engineering', 'Information Technology',
  'Data Science', 'Electrical Engineering', 'Mechanical Engineering',
  'Business Administration', 'Marketing', 'Finance', 'Accounting',
  'Graphic Design', 'UX/UI Design', 'Digital Marketing',
  'Nursing', 'Medicine', 'Psychology', 'Education',
  'Civil Engineering', 'Chemical Engineering', 'Physics',
  'Mathematics', 'Biology', 'Chemistry',
  'Law', 'Economics', 'Political Science',
  'Architecture', 'Environmental Science',
]

export function EducationForm() {
  const router = useRouter()
  const { educationLevel, fieldOfStudy, isCurrent, institution, graduationYear, setEducation } = useOnboardingStore()
  const [localLevel, setLocalLevel] = useState(educationLevel)
  const [localField, setLocalField] = useState(fieldOfStudy)
  const [localCurrent, setLocalCurrent] = useState(isCurrent)
  const [localInstitution, setLocalInstitution] = useState(institution)
  const [localGradYear, setLocalGradYear] = useState<number | null>(graduationYear)
  const [showSuggestions, setShowSuggestions] = useState(false)

  const filteredFields = COMMON_FIELDS.filter((f) =>
    localField && f.toLowerCase().includes(localField.toLowerCase()),
  ).slice(0, 5)

  const canContinue = localLevel && localField.trim().length > 0

  const handleContinue = () => {
    setEducation({
      educationLevel: localLevel,
      fieldOfStudy: localField.trim(),
      isCurrent: localCurrent,
      institution: localInstitution.trim(),
      graduationYear: localGradYear,
    })
    router.push('/onboarding/certifications')
  }

  const handleSkip = () => {
    router.push('/onboarding/certifications')
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Label className="text-sm font-semibold">Education Level</Label>
        <div className="grid grid-cols-2 gap-2">
          {EDUCATION_LEVELS.map((level) => (
            <button
              key={level.value}
              type="button"
              onClick={() => setLocalLevel(level.value)}
              className={cn(
                'rounded-lg border-2 px-3 py-2.5 text-left text-sm transition-all',
                localLevel === level.value
                  ? 'border-brand-orange bg-brand-orange/5 font-semibold'
                  : 'border-border bg-background hover:border-brand-orange/40'
              )}
            >
              {level.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2 relative">
        <Label className="text-sm font-semibold">Field of Study</Label>
        <Input
          value={localField}
          onChange={(e) => {
            setLocalField(e.target.value)
            setShowSuggestions(true)
          }}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
          placeholder="e.g., Computer Science, Business Administration"
          className="h-11"
        />
        {showSuggestions && localField && filteredFields.length > 0 && (
          <ul className="absolute top-full left-0 right-0 bg-white dark:bg-gray-900 border rounded-md shadow-lg z-10 mt-1">
            {filteredFields.map((field) => (
              <li
                key={field}
                className="px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer text-sm"
                onMouseDown={() => {
                  setLocalField(field)
                  setShowSuggestions(false)
                }}
              >
                {field}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-semibold">
          Institution <span className="font-normal text-muted-foreground">(optional)</span>
        </Label>
        <Input
          value={localInstitution}
          onChange={(e) => setLocalInstitution(e.target.value)}
          placeholder="e.g., MIT, Stanford University"
          className="h-11"
        />
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-semibold">
          Graduation year <span className="font-normal text-muted-foreground">(optional)</span>
        </Label>
        <Input
          type="number"
          value={localGradYear ?? ''}
          onChange={(e) => setLocalGradYear(e.target.value ? parseInt(e.target.value, 10) : null)}
          placeholder="e.g., 2024"
          min={1950}
          max={2040}
          className="h-11"
        />
      </div>

      <div className="flex items-center space-x-2">
        <Checkbox
          id="isCurrent"
          checked={localCurrent}
          onCheckedChange={(checked) => setLocalCurrent(checked === true)}
        />
        <Label htmlFor="isCurrent" className="text-sm font-normal cursor-pointer">
          I&apos;m currently studying
        </Label>
      </div>

      <div className="flex justify-between pt-4">
        <Button variant="ghost" onClick={handleSkip} className="text-sm">
          Skip
        </Button>
        <Button
          disabled={!canContinue}
          onClick={handleContinue}
          className="h-11 px-8 text-sm font-bold bg-brand-orange hover:bg-brand-orange-dark text-white"
        >
          Continue &rarr;
        </Button>
      </div>
    </div>
  )
}
