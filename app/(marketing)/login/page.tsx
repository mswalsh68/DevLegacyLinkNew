// Login is public (no auth required to view).
// Form interaction logic lives in a client component child.
import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = { title: 'Sign In' }

export default function LoginPage() {
  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-gray-50 px-4 py-12">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-2 font-bold text-gray-900">
            <span className="rounded bg-blue-600 px-2 py-0.5 text-sm text-white">DLL</span>
            DevLegacyLink
          </div>
          <h1 className="mt-4 text-2xl font-bold text-gray-900">Sign in to your account</h1>
          <p className="mt-1 text-sm text-gray-500">
            Enter your credentials to continue.
          </p>
        </div>

        {/* Card */}
        <div className="rounded-xl border border-gray-200 bg-white px-8 py-8 shadow-sm">
          {/* LoginForm client component will replace this placeholder */}
          <p className="text-center text-sm text-gray-400">Login form coming in Phase 2.</p>
        </div>

        <p className="mt-6 text-center text-sm text-gray-500">
          Don&apos;t have an account?{' '}
          <Link href="/contact" className="font-medium text-blue-600 hover:underline">
            Request access
          </Link>
        </p>
      </div>
    </div>
  )
}
