// Public login page — no auth required to view.
// Business logic (form submission, token handling) goes in a Client Component child.
export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-sm rounded-lg border border-gray-200 bg-white p-8 shadow-sm">
        <h1 className="mb-6 text-2xl font-bold text-gray-900">Sign in</h1>
        {/* LoginForm client component will replace this placeholder */}
        <p className="text-sm text-gray-500">Login form coming soon.</p>
      </div>
    </div>
  )
}
