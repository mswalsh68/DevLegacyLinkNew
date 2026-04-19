// Public home / landing page
export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-8 text-center">
      <h1 className="text-5xl font-bold tracking-tight text-gray-900">
        DevLegacyLink
      </h1>
      <p className="max-w-xl text-lg text-gray-600">
        Alumni &amp; roster management, built for the modern coaching staff.
      </p>
      <a
        href="/login"
        className="rounded-md bg-blue-600 px-6 py-3 text-base font-semibold text-white hover:bg-blue-700"
      >
        Sign in
      </a>
    </div>
  )
}
