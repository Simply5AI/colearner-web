'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import {
  ArrowLeft,
  BookOpenCheck,
  Download,
  FileText,
  Loader2,
  MessageSquare,
  Paperclip,
  Plus,
  Reply,
  Send,
  Settings,
  UserPlus,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { listExtractions } from '@/lib/api/extraction'
import { getPodAttachmentDownload } from '@/lib/api/pods'
import { createRecallSession } from '@/lib/api/recall'
import { queryKeys } from '@/lib/api/query-keys'
import {
  useCreatePodCaptureComment,
  useCreatePodMessage,
  usePodCapturePreview,
  usePodCaptureComments,
  usePodCaptures,
  usePodDetail,
  usePodMessages,
  useSavePodCapture,
  useUnsavePodCapture,
  useUploadPodAttachment,
} from '@/lib/hooks/use-pods'
import { usePodWebSocket } from '@/lib/hooks/use-pod-websocket'
import type { PodAttachment, PodCapture, PodMessage } from '@/lib/types/pods'
import { PodLeaderboard } from './pod-leaderboard'
import { PodActivityFeed } from './pod-activity-feed'
import { PodMemberList } from './pod-member-list'
import { InviteMemberModal } from './invite-member-modal'
import { ShareCaptureModal } from './share-capture-modal'

interface PodDetailClientProps {
  podId: string
}

type PodTab = 'overview' | 'resources' | 'discussion' | 'members'

export function PodDetailClient({ podId }: PodDetailClientProps) {
  const router = useRouter()
  const { data: session } = useSession()
  const {
    data: pod,
    isLoading,
    isError,
    error,
  } = usePodDetail(podId)
  const { data: capturesData, isLoading: capturesLoading } = usePodCaptures(podId)
  const [activeTab, setActiveTab] = useState<PodTab>('overview')
  const [inviteOpen, setInviteOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)

  usePodWebSocket(podId, session?.accessToken)

  const authHeaders = session?.accessToken
    ? { Authorization: `Bearer ${session.accessToken}` }
    : null

  const { data: extractionData } = useQuery({
    queryKey: [...queryKeys.extraction.history(), 'pod-share-picker'],
    queryFn: () => listExtractions(authHeaders!, { status: 'COMPLETED', limit: 50 }),
    enabled: !!authHeaders,
  })

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading group...</p>
  }

  if (isError || !pod) {
    return (
      <div className="mx-auto max-w-xl rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-center">
        <h1 className="text-lg font-semibold">Failed to load Study Group</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {error instanceof Error ? error.message : "We couldn't load this study group."}
        </p>
        <Button className="mt-4" variant="outline" render={<Link href="/pods" />}>
          Back to Study Groups
        </Button>
      </div>
    )
  }

  const currentUserId = session?.user?.id ?? ''
  const currentMember = pod.members.find((m) => m.userId === currentUserId)
  const isOwner = currentMember?.role === 'OWNER'
  const captures = capturesData?.captures ?? []

  const tabs: Array<{ key: PodTab; label: string }> = [
    { key: 'overview', label: 'Overview' },
    { key: 'resources', label: `Resources (${capturesData?.total ?? 0})` },
    { key: 'discussion', label: 'Discussion' },
    { key: 'members', label: `Members (${pod.members.length})` },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <Link href="/pods" className="mt-1 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-2xl">{pod.icon || '👥'}</span>
              <h1 className="truncate text-2xl font-bold">{pod.name}</h1>
              <Badge variant={pod.visibility === 'PUBLIC' ? 'default' : 'secondary'}>
                {pod.visibility === 'PUBLIC' ? 'Public' : 'Invite Only'}
              </Badge>
            </div>
            {pod.description && (
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{pod.description}</p>
            )}
            <p className="mt-2 text-xs text-muted-foreground">
              Code: {pod.code} · {pod.members.length}/{pod.maxMembers} members
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShareOpen(true)}>
            <Plus className="mr-1 h-4 w-4" /> Share resource
          </Button>
          <Button variant="outline" size="sm" onClick={() => setInviteOpen(true)}>
            <UserPlus className="mr-1 h-4 w-4" /> Invite
          </Button>
          {isOwner && (
            <Button variant="outline" size="sm" render={<Link href={`/pods/${podId}/settings`} />}>
              <Settings className="mr-1 h-4 w-4" /> Settings
            </Button>
          )}
        </div>
      </div>

      <InviteMemberModal
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        podId={podId}
        podCode={pod.code}
      />
      <ShareCaptureModal
        open={shareOpen}
        onOpenChange={setShareOpen}
        podId={podId}
        extractions={extractionData?.data ?? []}
      />

      <div className="flex gap-1 border-b">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'border-b-2 border-primary text-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="grid gap-4 md:grid-cols-3">
            <StatCard label="Shared resources" value={capturesData?.total ?? 0} />
            <StatCard label="Members" value={pod.members.length} />
            <StatCard
              label="Saved by you"
              value={captures.filter((capture) => capture.isSavedByCurrentUser).length}
            />
          </div>
          <PodLeaderboard podId={podId} />
          <div className="xl:col-span-2">
            <PodActivityFeed podId={podId} />
          </div>
        </div>
      )}

      {activeTab === 'resources' && (
        <ResourceTab
          podId={podId}
          captures={captures}
          isLoading={capturesLoading}
          authHeaders={authHeaders}
          onStartedPractice={(sessionId) => router.push(`/recall/${sessionId}`)}
        />
      )}

      {activeTab === 'discussion' && <DiscussionTab podId={podId} />}

      {activeTab === 'members' && (
        <PodMemberList
          podId={podId}
          members={pod.members}
          currentUserId={currentUserId}
          isOwner={isOwner}
        />
      )}
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-sm text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  )
}

function ResourceTab({
  podId,
  captures,
  isLoading,
  authHeaders,
  onStartedPractice,
}: {
  podId: string
  captures: PodCapture[]
  isLoading: boolean
  authHeaders: Record<string, string> | null
  onStartedPractice: (sessionId: string) => void
}) {
  const [selectedId, setSelectedId] = useState<string | null>(captures[0]?.id ?? null)
  const saveCapture = useSavePodCapture()
  const unsaveCapture = useUnsavePodCapture()
  const selected = captures.find((capture) => capture.id === selectedId) ?? captures[0]

  async function startPractice(capture: PodCapture) {
    if (!authHeaders) return
    const session = await createRecallSession(authHeaders, {
      extractionId: capture.extractionId,
      questionCount: Math.min(Math.max(capture.extraction.questionCount || 10, 1), 10),
      order: 'due_first',
      difficultyLevel: 'beginner',
    })
    onStartedPractice(session.id)
  }

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading shared resources...</p>
  }

  if (captures.length === 0) {
    return (
      <div className="rounded-xl border-2 border-dashed border-border p-10 text-center">
        <BookOpenCheck className="mx-auto h-8 w-8 text-muted-foreground" />
        <p className="mt-3 text-lg font-semibold">No shared resources yet</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Share a completed capture so the group can discuss it and add it to their study list.
        </p>
      </div>
    )
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="space-y-3">
        {captures.map((capture) => (
          <button
            key={capture.id}
            onClick={() => setSelectedId(capture.id)}
            className={`w-full rounded-lg border p-4 text-left transition-colors ${
              selected?.id === capture.id ? 'border-primary bg-primary/5' : 'hover:bg-accent/40'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-semibold">{capture.extraction.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Shared by {capture.sharer.name} · {new Date(capture.createdAt).toLocaleDateString()}
                </p>
                {capture.note && (
                  <p className="mt-2 text-sm text-muted-foreground">&ldquo;{capture.note}&rdquo;</p>
                )}
              </div>
              {capture.isSavedByCurrentUser && <Badge variant="secondary">Saved</Badge>}
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
              <Badge variant="outline">{capture.extraction.conceptCount} concepts</Badge>
              <Badge variant="outline">{capture.extraction.questionCount} questions</Badge>
              <Badge variant="outline">{capture.commentCount} comments</Badge>
            </div>
          </button>
        ))}
      </div>

      {selected && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{selected.extraction.title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ResourcePreview podId={podId} captureId={selected.id} />
            <div className="flex gap-2">
              {!selected.isSavedByCurrentUser ? (
                <Button
                  className="flex-1"
                  onClick={() => saveCapture.mutate({ podId, captureId: selected.id })}
                  disabled={saveCapture.isPending}
                >
                  Add to my study list
                </Button>
              ) : (
                <>
                  <Button className="flex-1" onClick={() => startPractice(selected)}>
                    Start group practice
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => unsaveCapture.mutate({ podId, captureId: selected.id })}
                    disabled={unsaveCapture.isPending}
                  >
                    Remove
                  </Button>
                </>
              )}
            </div>
            <CaptureComments podId={podId} captureId={selected.id} />
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function ResourcePreview({ podId, captureId }: { podId: string; captureId: string }) {
  const { data: preview, isLoading, isError } = usePodCapturePreview(podId, captureId)
  const concepts = preview?.extraction.concepts ?? []
  const sampleQuestions = concepts.flatMap((concept) =>
    concept.questions.map((question) => ({ ...question, conceptTitle: concept.title }))
  )

  return (
    <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
      <div>
        <p className="text-sm font-semibold">Inside this resource</p>
        <p className="text-xs text-muted-foreground">
          Preview the concepts and question prompts before adding it to your study list.
        </p>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Loading preview...</p>}
      {isError && <p className="text-sm text-muted-foreground">Preview is unavailable.</p>}

      {preview && (
        <>
          {(preview.extraction.summary || preview.extraction.description) && (
            <p className="line-clamp-4 text-sm text-muted-foreground">
              {preview.extraction.summary || preview.extraction.description}
            </p>
          )}

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase text-muted-foreground">
              Concepts
            </p>
            {concepts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No concepts are available yet.</p>
            ) : (
              <div className="max-h-44 space-y-2 overflow-y-auto pr-1">
                {concepts.slice(0, 8).map((concept) => (
                  <div key={concept.id} className="rounded-md bg-background p-2">
                    <p className="text-sm font-medium">{concept.title}</p>
                    {concept.description && (
                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                        {concept.description}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase text-muted-foreground">
              Sample questions
            </p>
            {sampleQuestions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No question prompts are available yet.</p>
            ) : (
              <div className="max-h-44 space-y-2 overflow-y-auto pr-1">
                {sampleQuestions.slice(0, 5).map((question) => (
                  <div key={question.id} className="rounded-md bg-background p-2">
                    <p className="text-xs text-muted-foreground">{question.conceptTitle}</p>
                    <p className="mt-1 text-sm">{question.text}</p>
                    {Array.isArray(question.options) && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {question.options.slice(0, 4).map((option, index) => (
                          <Badge key={`${question.id}-${index}`} variant="outline">
                            {String(option)}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function CaptureComments({ podId, captureId }: { podId: string; captureId: string }) {
  const { data: comments, isLoading } = usePodCaptureComments(podId, captureId)
  const createComment = useCreatePodCaptureComment()
  const uploadAttachment = useUploadPodAttachment()
  const [body, setBody] = useState('')
  const [files, setFiles] = useState<File[]>([])

  async function submit() {
    const trimmed = body.trim()
    if (!trimmed) return
    try {
      const attachments = await Promise.all(
        files.map((file) => uploadAttachment.mutateAsync({ podId, file }))
      )
      await createComment.mutateAsync({
        podId,
        captureId,
        data: { body: trimmed, attachmentIds: attachments.map((attachment) => attachment.id) },
      })
      setBody('')
      setFiles([])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not post comment')
    }
  }

  const isPending = createComment.isPending || uploadAttachment.isPending

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <MessageSquare className="h-4 w-4" /> Resource discussion
      </div>
      {isLoading && <p className="text-sm text-muted-foreground">Loading comments...</p>}
      {!isLoading && (!comments || comments.length === 0) && (
        <p className="text-sm text-muted-foreground">No comments yet.</p>
      )}
      <div className="max-h-64 space-y-3 overflow-y-auto">
        {comments?.map((comment) => (
          <div key={comment.id} className="rounded-md bg-muted/40 p-3 text-sm">
            <p className="font-medium">{comment.user.name}</p>
            <p className="mt-1 text-muted-foreground">{comment.body}</p>
            <AttachmentList podId={podId} attachments={comment.attachments ?? []} />
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          value={body}
          onChange={(event) => setBody(event.target.value)}
          onKeyDown={(event) => event.key === 'Enter' && submit()}
          placeholder="Ask a question or add a study note..."
        />
        <AttachmentPicker files={files} onChange={setFiles} disabled={isPending} compact />
        <Button size="icon" onClick={submit} disabled={isPending || !body.trim()}>
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
      {files.length > 0 && (
        <SelectedAttachmentList files={files} onChange={setFiles} disabled={isPending} />
      )}
    </div>
  )
}

function DiscussionTab({ podId }: { podId: string }) {
  const { data: messages, isLoading } = usePodMessages(podId)
  const createMessage = useCreatePodMessage()
  const uploadAttachment = useUploadPodAttachment()
  const [body, setBody] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [replyBody, setReplyBody] = useState('')
  const [replyFiles, setReplyFiles] = useState<File[]>([])

  const repliesByParent = new Map<string, PodMessage[]>()
  const topLevelMessages = (messages ?? []).filter((message) => {
    if (!message.parentId) return true
    const replies = repliesByParent.get(message.parentId) ?? []
    repliesByParent.set(message.parentId, [...replies, message])
    return false
  })

  async function submit() {
    const trimmed = body.trim()
    if (!trimmed) return
    try {
      const attachments = await Promise.all(
        files.map((file) => uploadAttachment.mutateAsync({ podId, file }))
      )
      await createMessage.mutateAsync({
        podId,
        data: { body: trimmed, attachmentIds: attachments.map((attachment) => attachment.id) },
      })
      setBody('')
      setFiles([])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not post message')
    }
  }

  async function submitReply(parentId: string) {
    const trimmed = replyBody.trim()
    if (!trimmed) return
    try {
      const attachments = await Promise.all(
        replyFiles.map((file) => uploadAttachment.mutateAsync({ podId, file }))
      )
      await createMessage.mutateAsync({
        podId,
        data: {
          body: trimmed,
          parentId,
          attachmentIds: attachments.map((attachment) => attachment.id),
        },
      })
      setReplyBody('')
      setReplyFiles([])
      setReplyingTo(null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not post reply')
    }
  }

  const isPending = createMessage.isPending || uploadAttachment.isPending

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Group Discussion</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading && <p className="text-sm text-muted-foreground">Loading discussion...</p>}
        {!isLoading && (!messages || messages.length === 0) && (
          <p className="text-sm text-muted-foreground">
            Start the group discussion with a question, plan, or announcement.
          </p>
        )}
        <div className="max-h-[420px] space-y-3 overflow-y-auto">
          {topLevelMessages.map((message) => (
            <div key={message.id} className="rounded-lg border p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold">{message.user.name}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(message.createdAt).toLocaleString()}
                </p>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{message.body}</p>
              <AttachmentList podId={podId} attachments={message.attachments ?? []} />
              <div className="mt-3">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => {
                    setReplyingTo(replyingTo === message.id ? null : message.id)
                    setReplyBody('')
                    setReplyFiles([])
                  }}
                >
                  <Reply className="mr-1 h-3.5 w-3.5" />
                  Reply
                </Button>
              </div>

              {(repliesByParent.get(message.id) ?? []).length > 0 && (
                <div className="mt-3 space-y-2 border-l pl-3">
                  {(repliesByParent.get(message.id) ?? []).map((reply) => (
                    <div key={reply.id} className="rounded-md bg-muted/35 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold">{reply.user.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(reply.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                        {reply.body}
                      </p>
                      <AttachmentList podId={podId} attachments={reply.attachments ?? []} />
                    </div>
                  ))}
                </div>
              )}

              {replyingTo === message.id && (
                <div className="mt-3 space-y-2 border-l pl-3">
                  <Textarea
                    value={replyBody}
                    onChange={(event) => setReplyBody(event.target.value)}
                    placeholder="Write a reply..."
                    rows={2}
                  />
                  <SelectedAttachmentList
                    files={replyFiles}
                    onChange={setReplyFiles}
                    disabled={isPending}
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      size="sm"
                      onClick={() => submitReply(message.id)}
                      disabled={isPending || !replyBody.trim()}
                    >
                      {isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="mr-2 h-4 w-4" />
                      )}
                      Post reply
                    </Button>
                    <AttachmentPicker
                      files={replyFiles}
                      onChange={setReplyFiles}
                      disabled={isPending}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setReplyingTo(null)
                        setReplyBody('')
                        setReplyFiles([])
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="space-y-2">
          <Textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder="Post a study update, question, or plan..."
            rows={3}
          />
          <SelectedAttachmentList files={files} onChange={setFiles} disabled={isPending} />
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={submit} disabled={isPending || !body.trim()}>
              {isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              Post message
            </Button>
            <AttachmentPicker files={files} onChange={setFiles} disabled={isPending} />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function AttachmentPicker({
  files,
  onChange,
  disabled,
  compact = false,
}: {
  files: File[]
  onChange: (files: File[]) => void
  disabled?: boolean
  compact?: boolean
}) {
  const inputRef = useRef<HTMLInputElement | null>(null)

  function addFiles(selected: FileList | null) {
    if (!selected) return
    const next = Array.from(selected)
    const tooLarge = next.find((file) => file.size > 50 * 1024 * 1024)
    if (tooLarge) {
      toast.error('Attachment must be 50MB or smaller')
      return
    }
    onChange([...files, ...next])
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(event) => addFiles(event.target.files)}
      />
      <Button
        type="button"
        variant="outline"
        size={compact ? 'icon' : 'sm'}
        onClick={() => inputRef.current?.click()}
        disabled={disabled}
      >
        <Paperclip className={compact ? 'h-4 w-4' : 'mr-2 h-4 w-4'} />
        {!compact && 'Attach'}
      </Button>
    </>
  )
}

function SelectedAttachmentList({
  files,
  onChange,
  disabled,
}: {
  files: File[]
  onChange: (files: File[]) => void
  disabled?: boolean
}) {
  if (files.length === 0) return null

  return (
    <div className="flex flex-wrap gap-2">
      {files.map((file, index) => (
        <span
          key={`${file.name}-${file.size}-${index}`}
          className="inline-flex max-w-full items-center gap-2 rounded-md border bg-muted/30 px-2 py-1 text-xs"
        >
          <FileText className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{file.name}</span>
          <span className="text-muted-foreground">{formatFileSize(file.size)}</span>
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground"
            disabled={disabled}
            onClick={() => onChange(files.filter((_, fileIndex) => fileIndex !== index))}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </span>
      ))}
    </div>
  )
}

function AttachmentList({
  podId,
  attachments,
}: {
  podId: string
  attachments: PodAttachment[]
}) {
  const { data: session } = useSession()

  if (attachments.length === 0) return null

  async function openAttachment(attachment: PodAttachment) {
    if (!session?.accessToken) return
    try {
      const download = await getPodAttachmentDownload(
        { Authorization: `Bearer ${session.accessToken}` },
        podId,
        attachment.id
      )
      window.open(download.url, '_blank', 'noopener,noreferrer')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not open attachment')
    }
  }

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {attachments.map((attachment) => (
        <button
          key={attachment.id}
          type="button"
          onClick={() => openAttachment(attachment)}
          className="inline-flex max-w-full items-center gap-2 rounded-md border bg-background px-2 py-1 text-xs transition-colors hover:bg-accent"
        >
          <FileText className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{attachment.fileName}</span>
          <span className="text-muted-foreground">{formatFileSize(attachment.fileSize)}</span>
          <Download className="h-3.5 w-3.5 shrink-0" />
        </button>
      ))}
    </div>
  )
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
