import { describe, expect, it } from 'vitest'
import { fullPageCrop, lightingHint, movePage, validCrop } from '@/lib/material-image'

describe('material page editing boundaries', () => {
  it('validates finite bounds and a usable crop', () => {
    expect(validCrop(fullPageCrop)).toBe(true)
    expect(validCrop({ ...fullPageCrop, left: 99 })).toBe(false)
    expect(validCrop({ ...fullPageCrop, top: Number.NaN })).toBe(false)
    expect(validCrop({ ...fullPageCrop, right: 101 })).toBe(false)
    expect(validCrop({ left: 20, top: 20, right: 25, bottom: 25 })).toBe(true)
  })
  it('reorders without mutating the original pages or duplicating one', () => {
    const pages = ['first', 'second', 'third']
    expect(movePage(pages, 0, 2)).toEqual(['second', 'third', 'first'])
    expect(pages).toEqual(['first', 'second', 'third'])
    expect(movePage(pages, -1, 2)).toEqual(pages)
    expect(movePage(pages, 0, 3)).toEqual(pages)
  })
  it('reports low measured brightness without claiming readability', () => {
    expect(lightingHint(new Uint8ClampedArray([0, 0, 0, 255, 20, 20, 20, 255]))).toBe('dark')
    expect(lightingHint(new Uint8ClampedArray([255, 255, 255, 255]))).toBe('check')
    expect(lightingHint(new Uint8ClampedArray())).toBe('check')
  })
})
