// Marketing layout — public, no auth required.
// Wraps home, login, pricing, etc.
export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Marketing nav will go here */}
      <main className="flex-1">{children}</main>
      {/* Marketing footer will go here */}
    </div>
  )
}
