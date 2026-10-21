import type { Metadata } from 'next'
import localFont from 'next/font/local'
import './globals.css'
import { cn } from '@/lib/utils'
import { AuthProvider } from '@/lib/providers/auth-provider'
import { QueryProvider } from '@/lib/providers/query-provider'
import { ThemeProvider } from '@/lib/providers/theme-provider'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Toaster } from '@/components/ui/sonner'

const geist = localFont({
  src: './fonts/geist-latin-variable.woff2',
  weight: '200 900',
  display: 'swap',
  variable: '--font-geist',
})
const nunito = localFont({
  src: './fonts/nunito-latin-variable.woff2',
  weight: '200 900',
  display: 'swap',
  variable: '--font-nunito',
})

export const metadata: Metadata = {
  title: {
    default: 'CoLearner - AI-Powered Adaptive Learning',
    template: '%s | CoLearner',
  },
  description:
    'Master any subject with AI-powered spaced repetition and active recall.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={cn('font-sans', geist.variable, nunito.variable)} suppressHydrationWarning>
      <body>
        <AuthProvider>
          <QueryProvider>
            <ThemeProvider>
              <TooltipProvider>
                {children}
                <Toaster />
              </TooltipProvider>
            </ThemeProvider>
          </QueryProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
