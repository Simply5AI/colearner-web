'use client'

import { useEffect } from 'react'
import Image from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import Underline from '@tiptap/extension-underline'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface RichTextEditorProps {
  value?: Record<string, unknown> | null
  onChange?: (json: Record<string, unknown>) => void
  readOnly?: boolean
  placeholder?: string
  className?: string
}

function ToolbarButton({
  active,
  onClick,
  children,
}: {
  active?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant={active ? 'default' : 'outline'}
      onClick={onClick}
      className="h-8 px-2 text-xs"
    >
      {children}
    </Button>
  )
}

export function RichTextEditor({
  value,
  onChange,
  readOnly = false,
  placeholder = 'Start writing...',
  className,
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Link.configure({ openOnClick: false }),
      Image,
      Placeholder.configure({ placeholder }),
    ],
    content: value ?? { type: 'doc', content: [] },
    editable: !readOnly,
    immediatelyRender: false,
    onUpdate: ({ editor: currentEditor }) => {
      onChange?.(currentEditor.getJSON() as Record<string, unknown>)
    },
  })

  useEffect(() => {
    if (!editor) return
    editor.setEditable(!readOnly)
  }, [editor, readOnly])

  useEffect(() => {
    if (!editor || !value) return
    const current = JSON.stringify(editor.getJSON())
    const incoming = JSON.stringify(value)
    if (current !== incoming) {
      editor.commands.setContent(value)
    }
  }, [editor, value])

  if (!editor) {
    return <div className="h-32 animate-pulse rounded-lg border bg-muted/40" />
  }

  return (
    <div className={cn('overflow-hidden rounded-lg border', className)}>
      {!readOnly && (
        <div className="flex flex-wrap gap-1 border-b bg-muted/30 p-2">
          <ToolbarButton
            active={editor.isActive('bold')}
            onClick={() => editor.chain().focus().toggleBold().run()}
          >
            Bold
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive('italic')}
            onClick={() => editor.chain().focus().toggleItalic().run()}
          >
            Italic
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive('underline')}
            onClick={() => editor.chain().focus().toggleUnderline().run()}
          >
            Underline
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive('heading', { level: 1 })}
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          >
            H1
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive('heading', { level: 2 })}
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          >
            H2
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive('heading', { level: 3 })}
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          >
            H3
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive('bulletList')}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
          >
            Bullets
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive('orderedList')}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
          >
            Numbered
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive('codeBlock')}
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          >
            Code
          </ToolbarButton>
          <ToolbarButton
            onClick={() => {
              const url = window.prompt('Enter link URL')
              if (!url) return
              editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
            }}
          >
            Link
          </ToolbarButton>
        </div>
      )}
      <EditorContent
        editor={editor}
        className={cn(
          'prose prose-sm max-w-none p-3 focus:outline-none',
          '[&_.ProseMirror]:min-h-[160px] [&_.ProseMirror]:outline-none',
          readOnly && 'bg-muted/20',
        )}
      />
    </div>
  )
}