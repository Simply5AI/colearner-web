export interface PasswordStrength {
  score: 0 | 1 | 2 | 3 | 4
  label: 'Too weak' | 'Weak' | 'Fair' | 'Good' | 'Strong'
}

export function getPasswordStrength(password: string): PasswordStrength {
  if (!password) return { score: 0, label: 'Too weak' }

  let score = 0
  if (password.length >= 8) score++
  if (/[A-Z]/.test(password)) score++
  if (/[a-z]/.test(password)) score++
  if (/[0-9]/.test(password)) score++
  if (/[^A-Za-z0-9]/.test(password)) score++

  // If less than 8 chars, cap at 1
  if (password.length < 8) score = Math.min(score, 1)

  const clamped = Math.min(score, 4) as 0 | 1 | 2 | 3 | 4

  const labels: Record<number, PasswordStrength['label']> = {
    0: 'Too weak',
    1: 'Weak',
    2: 'Fair',
    3: 'Good',
    4: 'Strong',
  }

  return { score: clamped, label: labels[clamped]! }
}
