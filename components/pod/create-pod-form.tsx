'use client'

import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useCreatePod } from '@/lib/hooks/use-pods'
import type { PodVisibility } from '@/lib/types/pods'

interface FormData {
  name: string
  description: string
  visibility: PodVisibility
  maxMembers: number
}

export function CreatePodForm() {
  const router = useRouter()
  const createPod = useCreatePod()

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
  } = useForm<FormData>({
    defaultValues: { name: '', description: '', visibility: 'PUBLIC', maxMembers: 10 },
  })

  const onSubmit = (data: FormData) => {
    createPod.mutate(
      {
        name: data.name,
        description: data.description || undefined,
        visibility: data.visibility,
        maxMembers: data.maxMembers,
      },
      {
        onSuccess: (pod) => {
          router.push(`/pods/${pod.id}`)
        },
      }
    )
  }

  const visibility = watch('visibility')

  return (
    <Card className="max-w-lg mx-auto">
      <CardHeader>
        <CardTitle>Create a Study Group</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="text-sm font-medium">Group Name</label>
            <Input
              {...register('name', { required: 'Name is required', maxLength: { value: 50, message: 'Max 50 characters' } })}
              placeholder="e.g., ML Study Group"
              className="mt-1"
            />
            {errors.name && <p className="mt-1 text-xs text-destructive">{errors.name.message}</p>}
          </div>

          <div>
            <label className="text-sm font-medium">Description (optional)</label>
            <Input {...register('description')} placeholder="What's this group about?" className="mt-1" />
          </div>

          <div>
            <label className="text-sm font-medium">Visibility</label>
            <div className="mt-1.5 flex gap-2">
              <button
                type="button"
                onClick={() => setValue('visibility', 'PUBLIC')}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm text-left transition-colors ${
                  visibility === 'PUBLIC' ? 'border-primary bg-primary/5 text-primary' : 'hover:bg-accent'
                }`}
              >
                Public
                <p className="text-xs text-muted-foreground mt-0.5">Anyone with the code can join</p>
              </button>
              <button
                type="button"
                onClick={() => setValue('visibility', 'INVITE_ONLY')}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm text-left transition-colors ${
                  visibility === 'INVITE_ONLY' ? 'border-primary bg-primary/5 text-primary' : 'hover:bg-accent'
                }`}
              >
                Invite Only
                <p className="text-xs text-muted-foreground mt-0.5">Members need an invite</p>
              </button>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">Max Members</label>
            <Input
              {...register('maxMembers', { valueAsNumber: true, min: { value: 2, message: 'Min 2' }, max: { value: 25, message: 'Max 25' } })}
              type="number"
              min={2}
              max={25}
              className="mt-1 w-24"
            />
            {errors.maxMembers && (
              <p className="mt-1 text-xs text-destructive">{errors.maxMembers.message}</p>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={createPod.isPending}>
            {createPod.isPending ? 'Creating...' : 'Create Group'}
          </Button>

          {createPod.isError && (
            <p className="text-xs text-destructive">{createPod.error.message}</p>
          )}
        </form>
      </CardContent>
    </Card>
  )
}
