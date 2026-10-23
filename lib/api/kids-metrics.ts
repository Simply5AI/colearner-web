/**
 * Kids (band 6-9) payloads must not carry a percentage, a readiness number, a rate,
 * an attempt count, a failure count, or a weak-spot list. The check looks at field
 * names, and at model-written strings, so a learner's own sentence is not refused.
 */

const forbidden = new Set([
  'readiness', 'rate', 'successrate', 'attempts', 'attemptcount', 'attemptno',
  'failurecount', 'failcount', 'failures', 'misscount', 'missedcount', 'wrongcount',
  'percentage', 'percent', 'weakspots', 'weakspot', 'accuracy', 'accuracypercent',
])
/** Strings on these fields are model or product copy, not the learner's draft. */
const scanned = new Set(['text', 'reason', 'followup', 'examtip', 'guidance', 'label'])
const percent = /\d+(?:\.\d+)?\s*%/
const failurePhrase = /\b\d+\s+(?:failures|failure|fails|wrong answers|misses)\b/i
const normalise = (name: string) => name.toLowerCase().replace(/[_\-\s]/g, '')

/** A learner-facing reason when `value` is not safe to show to a child, otherwise null. */
export function kidsMetricIssue(value: unknown, depth = 0): string | null {
  if (depth > 14 || value === null || value === undefined) return null
  if (typeof value !== 'object') return null
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = kidsMetricIssue(item, depth + 1)
      if (found) return found
    }
    return null
  }
  for (const [key, item] of Object.entries(value)) {
    const name = normalise(key)
    if (forbidden.has(name)) return `A kids payload must not include ${key}.`
    if (typeof item === 'string' && scanned.has(name)) {
      if (percent.test(item)) return 'A kids payload must not include a percentage.'
      if (failurePhrase.test(item)) return 'A kids payload must not include a failure count.'
    }
    const found = kidsMetricIssue(item, depth + 1)
    if (found) return found
  }
  return null
}
