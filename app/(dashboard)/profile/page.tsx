'use client'

import { useState } from 'react'
import { GraduationCap, Award, Plus, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EducationCard } from '@/components/profile/education-card'
import { CertificationCard } from '@/components/profile/certification-card'
import { AddEducationDialog } from '@/components/profile/add-education-dialog'
import { AddCertificationDialog } from '@/components/profile/add-certification-dialog'
import { RegenerateButton } from '@/components/profile/regenerate-button'
import { useProfileSummary } from '@/lib/hooks/use-profile'
import type { UserEducation, UserCertification } from '@/lib/types'

export default function ProfileDashboardPage() {
  const { data: summary, isLoading } = useProfileSummary()

  const [eduDialogOpen, setEduDialogOpen] = useState(false)
  const [certDialogOpen, setCertDialogOpen] = useState(false)
  const [editingEducation, setEditingEducation] = useState<UserEducation | null>(null)
  const [editingCertification, setEditingCertification] = useState<UserCertification | null>(null)

  const handleEditEducation = (edu: UserEducation) => {
    setEditingEducation(edu)
    setEduDialogOpen(true)
  }

  const handleEditCertification = (cert: UserCertification) => {
    setEditingCertification(cert)
    setCertDialogOpen(true)
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-12 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading profile...
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-10 px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Educational Profile</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your education and certifications to get better AI-powered learning recommendations.
        </p>
      </div>

      {/* Education Section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GraduationCap className="size-5 text-brand-orange" />
            <h2 className="text-lg font-semibold">Education</h2>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setEditingEducation(null)
              setEduDialogOpen(true)
            }}
            className="gap-1.5"
          >
            <Plus className="size-3.5" /> Add
          </Button>
        </div>

        {summary?.educations && summary.educations.length > 0 ? (
          <div className="space-y-2">
            {summary.educations.map((edu) => (
              <EducationCard key={edu.id} education={edu} onEdit={handleEditEducation} />
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed p-6 text-center">
            <p className="text-sm text-muted-foreground">
              No education entries yet. Add your educational background to improve recommendations.
            </p>
          </div>
        )}
      </section>

      {/* Certifications Section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Award className="size-5 text-brand-orange" />
            <h2 className="text-lg font-semibold">Certifications</h2>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setEditingCertification(null)
              setCertDialogOpen(true)
            }}
            className="gap-1.5"
          >
            <Plus className="size-3.5" /> Add
          </Button>
        </div>

        {summary?.certifications && summary.certifications.length > 0 ? (
          <div className="space-y-2">
            {summary.certifications.map((cert) => (
              <CertificationCard
                key={cert.id}
                certification={cert}
                onEdit={handleEditCertification}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed p-6 text-center">
            <p className="text-sm text-muted-foreground">
              No certifications yet. Add certifications to get smarter learning recommendations.
            </p>
          </div>
        )}
      </section>

      {/* AI Suggestions Section */}
      <section className="space-y-4">
        <div className="border-t border-border pt-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">AI Suggestions</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {summary?.suggestedGoalsGenerated
                  ? 'Regenerate to get fresh recommendations based on your updated profile.'
                  : 'Add education data above, then generate personalized learning suggestions.'}
              </p>
            </div>
            <RegenerateButton />
          </div>
        </div>
      </section>

      {/* Dialogs */}
      <AddEducationDialog
        open={eduDialogOpen}
        onOpenChange={setEduDialogOpen}
        editData={editingEducation}
      />
      <AddCertificationDialog
        open={certDialogOpen}
        onOpenChange={setCertDialogOpen}
        editData={editingCertification}
      />
    </div>
  )
}
