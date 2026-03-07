export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen">
      {/* TODO: Marketing header/nav */}
      <main>{children}</main>
      {/* TODO: Marketing footer */}
    </div>
  )
}
