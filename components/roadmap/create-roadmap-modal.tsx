'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useCreateRoadmap } from '@/lib/hooks/use-roadmap'
import type { RoadmapMode } from '@/lib/types'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CreateRoadmapModal({ open, onOpenChange }: Props) {
  const router = useRouter()
  const createRoadmap = useCreateRoadmap()

  const [mode, setMode] = useState<RoadmapMode>('TOPIC')
  const [topic, setTopic] = useState('')
  const [phases, setPhases] = useState('3')
  const [syllabusText, setSyllabusText] = useState('')
  const [examDate, setExamDate] = useState('')
  const [examTopics, setExamTopics] = useState('')

  const handleSubmit = async () => {
    const input = {
      mode,
      topic,
      phases: parseInt(phases, 10),
      ...(mode === 'SYLLABUS' && syllabusText ? { syllabusText } : {}),
      ...(mode === 'EXAM_PREP' && examDate ? { examDate } : {}),
      ...(mode === 'EXAM_PREP' && examTopics
        ? { examTopics: examTopics.split(',').map((t) => t.trim()).filter(Boolean) }
        : {}),
    }

    const result = await createRoadmap.mutateAsync(input)
    onOpenChange(false)
    router.push(`/roadmaps/${result.roadmap.id}`)
  }

  const canSubmit = topic.trim().length > 0 && !createRoadmap.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Learning Roadmap</DialogTitle>
          <DialogDescription>
            AI will generate the topics and milestones. Students choose which sources to capture.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={mode} onValueChange={(v) => setMode(v as RoadmapMode)} className="mt-2">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="TOPIC">Learn a Topic</TabsTrigger>
            <TabsTrigger value="SYLLABUS">Import Syllabus</TabsTrigger>
            <TabsTrigger value="EXAM_PREP">Exam Prep</TabsTrigger>
          </TabsList>

          <div className="mt-4 space-y-4">
            <div>
              <Label htmlFor="topic">
                {mode === 'SYLLABUS' ? 'Course Name' : mode === 'EXAM_PREP' ? 'Subject' : 'What do you want to learn?'}
              </Label>
              <Input
                id="topic"
                placeholder={
                  mode === 'SYLLABUS'
                    ? 'e.g., CS101 Introduction to Computer Science'
                    : mode === 'EXAM_PREP'
                    ? 'e.g., Data Structures and Algorithms'
                    : 'e.g., I want to learn REST APIs'
                }
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="phases">Number of phases</Label>
              <Select value={phases} onValueChange={(v) => { if (v) setPhases(v) }}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 8 }, (_, i) => i + 1).map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n} {n === 1 ? 'phase' : 'phases'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <TabsContent value="SYLLABUS" className="mt-0 space-y-4">
              <div>
                <Label htmlFor="syllabus">Paste your syllabus</Label>
                <Textarea
                  id="syllabus"
                  placeholder="Paste your course syllabus or topic list here..."
                  value={syllabusText}
                  onChange={(e) => setSyllabusText(e.target.value)}
                  className="mt-1 min-h-[120px]"
                />
              </div>
            </TabsContent>

            <TabsContent value="EXAM_PREP" className="mt-0 space-y-4">
              <div>
                <Label htmlFor="examDate">Exam Date</Label>
                <Input
                  id="examDate"
                  type="date"
                  value={examDate}
                  onChange={(e) => setExamDate(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="examTopics">Key Topics (comma-separated)</Label>
                <Input
                  id="examTopics"
                  placeholder="e.g., trees, graphs, sorting, dynamic programming"
                  value={examTopics}
                  onChange={(e) => setExamTopics(e.target.value)}
                  className="mt-1"
                />
              </div>
            </TabsContent>
          </div>
        </Tabs>

        <div className="flex justify-end gap-3 mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {createRoadmap.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Generate Roadmap
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
