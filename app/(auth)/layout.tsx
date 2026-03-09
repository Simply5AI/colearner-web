import { BrandPanel } from '@/components/auth/brand-panel'

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 min-h-screen">
      <BrandPanel />
      <main className="flex flex-1 items-center justify-center px-4 py-12 sm:px-8 lg:px-14">
        <div className="w-full max-w-[420px]">{children}</div>
      </main>
    </div>
  )
}
