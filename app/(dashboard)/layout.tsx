export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen">
      {/* TODO: AppSidebar component */}
      <aside className="hidden w-64 border-r md:block">
        <nav className="p-4">
          <h2 className="mb-4 text-lg font-semibold">CoLearner</h2>
          <p className="text-sm text-muted-foreground">Sidebar placeholder</p>
        </nav>
      </aside>
      <main className="flex-1 p-6">{children}</main>
    </div>
  )
}
