'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { FileUp, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  bulkImportCsvClient,
  bulkImportQuestionsClient,
  type BulkImportResult,
} from '@/lib/api/teacher-questions-client'
import type { TeacherQuestionType } from '@/lib/types/teacher'

interface BulkImportModalProps {
  planId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function BulkImportModal({ planId, open, onOpenChange }: BulkImportModalProps) {
  const router = useRouter()
  const [file, setFile] = useState<File | null>(null)
  const [jsonText, setJsonText] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<BulkImportResult | null>(null)

  async function handleImport() {
    setLoading(true)
    setResult(null)
    try {
      let importResult: BulkImportResult

      if (file) {
        importResult = await bulkImportCsvClient(planId, file)
      } else if (jsonText.trim()) {
        const parsed = JSON.parse(jsonText) as
          | Array<{
              topicId: string
              type: TeacherQuestionType
              prompt: string
              explanation: string
              options?: unknown
              correctAnswer: unknown
            }>
          | {
              questions: Array<{
                topicId: string
                type: TeacherQuestionType
                prompt: string
                explanation: string
                options?: unknown
                correctAnswer: unknown
              }>
            }
        const questions = Array.isArray(parsed) ? parsed : parsed.questions
        importResult = await bulkImportQuestionsClient({ planId, questions })
      } else {
        toast.error('Upload a CSV file or paste a JSON array')
        return
      }

      setResult(importResult)
      toast.success(`Imported ${importResult.importedCount} questions`)
      if (importResult.errorCount === 0) {
        onOpenChange(false)
        router.refresh()
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Import failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileUp className="h-4 w-4" />
            Bulk import
          </DialogTitle>
          <DialogDescription>
            Import questions from CSV or JSON. CSV columns: topicId, type, prompt, explanation,
            correctAnswer (JSON), options (JSON, optional).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="import-file">CSV file</Label>
            <InputFile id="import-file" onFile={setFile} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="import-json">Or JSON array</Label>
            <textarea
              id="import-json"
              className="min-h-[120px] w-full rounded-md border bg-background px-3 py-2 text-sm"
              placeholder='{ "questions": [ { "topicId": "...", "type": "MCQ", ... } ] }'
              value={jsonText}
              onChange={(e) => setJsonText(e.target.value)}
            />
          </div>

          {result && result.errors.length > 0 && (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm">
              <p className="font-medium text-destructive">
                {result.errorCount} row(s) failed ({result.importedCount} imported)
              </p>
              <ul className="mt-2 max-h-32 space-y-1 overflow-y-auto text-muted-foreground">
                {result.errors.map((err) => (
                  <li key={err.row}>
                    Row {err.row}: {err.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleImport} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Import valid rows
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function InputFile({ id, onFile }: { id: string; onFile: (file: File | null) => void }) {
  return (
    <input
      id={id}
      type="file"
      accept=".csv,text/csv,application/json,.json"
      className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-2"
      onChange={(e) => onFile(e.target.files?.[0] ?? null)}
    />
  )
}