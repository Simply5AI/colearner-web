import { describe, expect, it } from 'vitest'
import { toAdminBffPath } from '@/lib/api/admin-browser'

describe('toAdminBffPath', () => {
  it('strips the platform /api/admin prefix', () => {
    expect(toAdminBffPath('/api/admin/users/u1/sessions')).toBe('/users/u1/sessions')
  })

  it('keeps relative resource paths unchanged', () => {
    expect(toAdminBffPath('/users/u1/sessions')).toBe('/users/u1/sessions')
  })

  it('preserves query strings on the remainder', () => {
    expect(toAdminBffPath('/api/admin/users?limit=25')).toBe('/users?limit=25')
  })

  it('strips prefix for activity endpoints', () => {
    expect(toAdminBffPath('/api/admin/users/u1/activity?limit=50')).toBe(
      '/users/u1/activity?limit=50'
    )
  })
})