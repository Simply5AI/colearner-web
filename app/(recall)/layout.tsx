export default function RecallLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-background">
      {/* Minimal chrome for focus mode */}
      <main className="mx-auto max-w-3xl p-6">{children}</main>
    </div>
  )
}
