/** The optional "Pages: from __ to __" of a PDF upload or paper link. Blank is fine; otherwise both must be whole pages in order, at most `maxSpan` apart. */
export function parsePageRange(from: string, to: string, maxSpan = 50): { range: { pageFrom: number; pageTo: number } | null; error: string | null } {
  if (!from.trim() && !to.trim()) return { range: null, error: null }
  const pageFrom = Number(from), pageTo = Number(to)
  if (!from.trim() || !to.trim() || !Number.isInteger(pageFrom) || !Number.isInteger(pageTo) || pageFrom < 1 || pageTo < 1) return { range: null, error: 'Enter both page numbers as whole numbers, or leave both empty.' }
  if (pageTo < pageFrom) return { range: null, error: 'The last page must come after the first page.' }
  if (pageTo - pageFrom + 1 > maxSpan) return { range: null, error: `Choose at most ${maxSpan} pages at a time.` }
  return { range: { pageFrom, pageTo }, error: null }
}
