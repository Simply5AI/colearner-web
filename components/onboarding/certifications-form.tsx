'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useOnboardingStore } from '@/lib/stores/onboarding-store'

export function CertificationsForm() {
  const router = useRouter()
  const { certifications, addCertification, removeCertification } = useOnboardingStore()
  const [certName, setCertName] = useState('')
  const [certOrg, setCertOrg] = useState('')

  const handleAdd = () => {
    if (!certName.trim()) return
    addCertification({ name: certName.trim(), issuingOrg: certOrg.trim() })
    setCertName('')
    setCertOrg('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAdd()
    }
  }

  const handleContinue = () => {
    router.push('/onboarding/ai-suggestions')
  }

  const handleSkip = () => {
    router.push('/onboarding/ai-suggestions')
  }

  return (
    <div className="space-y-6">
      {/* Existing certifications list */}
      {certifications.length > 0 && (
        <div className="space-y-2">
          {certifications.map((cert, index) => (
            <div
              key={index}
              className="flex items-center justify-between rounded-lg border px-4 py-3"
            >
              <div>
                <p className="text-sm font-medium">{cert.name}</p>
                {cert.issuingOrg && (
                  <p className="text-xs text-muted-foreground">{cert.issuingOrg}</p>
                )}
              </div>
              <button
                onClick={() => removeCertification(index)}
                className="ml-3 text-muted-foreground hover:text-destructive transition-colors"
              >
                <X className="size-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add certification form */}
      <div className="space-y-3 rounded-lg border border-dashed p-4">
        <div className="space-y-2">
          <Label className="text-sm font-semibold">Certification name</Label>
          <Input
            value={certName}
            onChange={(e) => setCertName(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="e.g., AWS Solutions Architect, PMP"
            className="h-11"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-sm font-semibold">
            Issuing organization <span className="font-normal text-muted-foreground">(optional)</span>
          </Label>
          <Input
            value={certOrg}
            onChange={(e) => setCertOrg(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="e.g., Amazon Web Services, PMI"
            className="h-11"
          />
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={handleAdd}
          disabled={!certName.trim()}
          className="text-sm"
        >
          + Add Certification
        </Button>
      </div>

      <div className="flex justify-between pt-4">
        <Button variant="ghost" onClick={handleSkip} className="text-sm">
          Skip
        </Button>
        <Button
          onClick={handleContinue}
          className="h-11 px-8 text-sm font-bold bg-brand-orange hover:bg-brand-orange-dark text-white"
        >
          Continue &rarr;
        </Button>
      </div>
    </div>
  )
}
