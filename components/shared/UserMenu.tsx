'use client'

import Link from 'next/link'
import { signOut, useSession } from 'next-auth/react'
import { ChevronDown, GraduationCap, LogOut, Settings, User } from 'lucide-react'
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

function getInitials(name?: string | null, email?: string | null) {
  const source = name?.trim() || email?.split('@')[0] || 'User'
  return source
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function UserMenu() {
  const { data: session } = useSession()
  const user = session?.user
  const name = user?.name || 'User'
  const email = user?.email || ''
  const initials = getInitials(user?.name, user?.email)
  const isTeacher = user?.roles?.includes('TEACHER') ?? false

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button className="flex h-[34px] items-center gap-2 rounded-lg border border-border bg-card px-1.5 pr-2 text-left transition-colors hover:border-muted-foreground hover:text-foreground" />
        }
      >
        <Avatar size="sm" className="bg-primary/10">
          {user?.image && <AvatarImage src={user.image} alt={name} />}
          <AvatarFallback className="bg-primary/10 text-[11px] font-extrabold text-primary">
            {initials}
          </AvatarFallback>
        </Avatar>
        <span className="hidden max-w-28 truncate text-xs font-semibold text-foreground lg:block">
          {name}
        </span>
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 p-1.5">
        <div className="flex items-center gap-2.5 px-2 py-2">
          <Avatar className="h-9 w-9 bg-primary/10">
            {user?.image && <AvatarImage src={user.image} alt={name} />}
            <AvatarFallback className="bg-primary/10 text-xs font-extrabold text-primary">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-foreground">{name}</p>
            {email && (
              <p className="truncate text-xs text-muted-foreground">{email}</p>
            )}
          </div>
        </div>
        <DropdownMenuSeparator />
        {isTeacher ? (
          <DropdownMenuItem
            render={<Link href="/teacher/dashboard" />}
            className="flex items-center gap-2 px-2 py-2"
          >
            <GraduationCap className="h-4 w-4" />
            Teacher dashboard
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem
            render={<Link href="/become-teacher" />}
            className="flex items-center gap-2 px-2 py-2"
          >
            <GraduationCap className="h-4 w-4" />
            Become a teacher
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          render={<Link href="/settings/profile" />}
          className="flex items-center gap-2 px-2 py-2"
        >
          <User className="h-4 w-4" />
          Profile
        </DropdownMenuItem>
        <DropdownMenuItem
          render={<Link href="/settings" />}
          className="flex items-center gap-2 px-2 py-2"
        >
          <Settings className="h-4 w-4" />
          Settings
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="flex items-center gap-2 px-2 py-2 text-destructive"
          onClick={() => signOut({ redirectTo: '/login' })}
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
