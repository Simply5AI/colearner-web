export interface CropBounds { left: number; top: number; right: number; bottom: number }
export const fullPageCrop: CropBounds = { left: 0, top: 0, right: 100, bottom: 100 }

/** User-controlled rectangular crop in percentages; no page detection is claimed. */
export function validCrop(crop: CropBounds): boolean {
  return Object.values(crop).every(value => Number.isFinite(value) && value >= 0 && value <= 100)
    && crop.right - crop.left >= 5 && crop.bottom - crop.top >= 5
}

export function movePage<T>(pages: readonly T[], from: number, to: number): T[] {
  const next = [...pages]
  if (from < 0 || from >= next.length || to < 0 || to >= next.length) return next
  const [page] = next.splice(from, 1)
  next.splice(to, 0, page!)
  return next
}

export function lightingHint(pixels: Uint8ClampedArray): 'dark' | 'check' {
  let luminance = 0
  let count = 0
  for (let index = 0; index + 3 < pixels.length; index += 4) {
    luminance += (pixels[index] ?? 0) * 0.2126 + (pixels[index + 1] ?? 0) * 0.7152 + (pixels[index + 2] ?? 0) * 0.0722
    count++
  }
  return count > 0 && luminance / count < 55 ? 'dark' : 'check'
}

export async function editPage(file: File, crop: CropBounds, quarterTurns: number): Promise<File> {
  if (!validCrop(crop)) throw new Error('Keep a crop area of at least 5% of the page.')
  if (typeof createImageBitmap !== 'function') throw new Error('Photo editing is unavailable in this browser. Try another device.')
  const bitmap = await createImageBitmap(file)
  try {
    const sourceX = Math.round(bitmap.width * crop.left / 100)
    const sourceY = Math.round(bitmap.height * crop.top / 100)
    const width = Math.max(1, Math.round(bitmap.width * (crop.right - crop.left) / 100))
    const height = Math.max(1, Math.round(bitmap.height * (crop.bottom - crop.top) / 100))
    const turns = ((quarterTurns % 4) + 4) % 4
    const canvas = document.createElement('canvas')
    canvas.width = turns % 2 ? height : width
    canvas.height = turns % 2 ? width : height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Photo editing is unavailable on this device.')
    context.translate(canvas.width / 2, canvas.height / 2)
    context.rotate(turns * Math.PI / 2)
    context.drawImage(bitmap, sourceX, sourceY, width, height, -width / 2, -height / 2, width, height)
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('Could not save this photo.')), 'image/jpeg', 0.9))
    return new File([blob], `page-${crypto.randomUUID()}.jpg`, { type: 'image/jpeg' })
  } finally { bitmap.close() }
}
