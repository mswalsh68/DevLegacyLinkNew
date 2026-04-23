// /join — public self-signup page.
// Matches the login page layout exactly (full-screen background + dark card).
// The ?code= query param auto-fills the invite code input.
import type { Metadata } from 'next'
import Image from 'next/image'
import { JoinContent } from './JoinContent'

export const metadata: Metadata = { title: 'Request Access — LegacyLink' }

export default async function JoinPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>
}) {
  const { code } = await searchParams

  return (
    <div className="relative min-h-screen flex items-center justify-center px-4 py-12">

      {/* Full-screen background — same as login */}
      <Image
        src="/login-background.jpg"
        alt=""
        fill
        priority
        style={{ objectFit: 'cover', objectPosition: 'center' }}
      />

      {/* Dark scrim */}
      <div className="absolute inset-0" style={{ backgroundColor: 'rgba(0,0,0,0.62)' }} />

      {/* Card */}
      <div
        className="relative w-full max-w-md rounded-2xl overflow-hidden"
        style={{ boxShadow: '0 32px 80px rgba(0,0,0,0.8)' }}
      >

        {/* White logo panel */}
        <div className="flex items-center justify-center px-6 py-8 bg-white">
          <Image
            src="/logo-full.jpg"
            alt="LegacyLink — Where rosters become legacies"
            width={420}
            height={160}
            priority
            style={{ objectFit: 'contain', width: '100%', height: 'auto' }}
          />
        </div>

        {/* Gold divider */}
        <div style={{ height: 3, backgroundColor: '#CFC493' }} />

        {/* Dark content panel */}
        <div className="px-8 py-8 bg-brand-dark">
          <h2 className="text-base font-semibold mb-6 tracking-wide text-white/65">
            Request access to your program
          </h2>
          <JoinContent initialCode={code ?? ''} />
        </div>

      </div>

      {/* Footer */}
      <p className="absolute bottom-4 text-xs text-white/25">
        &copy; {new Date().getFullYear()} LegacyLink &mdash; All rights reserved
      </p>

    </div>
  )
}
