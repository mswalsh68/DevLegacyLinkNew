'use client'

// Shown at the top of every page while a View As / Role Preview session is active.
// Calls POST /api/internal/preview/end on exit and redirects to /global.

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { PROGRAM_ROLE_LABELS } from '@/lib/constants'

interface Props {
  teamName:      string
  programRoleId: number
}

export function PreviewBanner({ teamName, programRoleId }: Props) {
  const router  = useRouter()
  const [exiting, setExiting] = useState(false)

  const roleName = PROGRAM_ROLE_LABELS[programRoleId] ?? `Role ${programRoleId}`

  async function handleExit() {
    setExiting(true)
    try {
      await fetch('/api/internal/preview/end', { method: 'POST' })
    } finally {
      router.push('/global')
      router.refresh()
    }
  }

  return (
    <div
      role="alert"
      aria-live="polite"
      style={{
        position:        'sticky',
        top:             0,
        zIndex:          1000,
        backgroundColor: '#7c3aed',
        color:           '#fff',
        padding:         '8px 20px',
        display:         'flex',
        alignItems:      'center',
        justifyContent:  'space-between',
        gap:             12,
        fontSize:        13,
        fontWeight:      500,
      }}
    >
      <span>
        <strong>Preview mode</strong>
        {' — '}
        viewing <em>{teamName}</em> as <em>{roleName}</em>.
        {' '}
        Writes are disabled.
      </span>

      <button
        onClick={handleExit}
        disabled={exiting}
        style={{
          padding:         '4px 14px',
          borderRadius:    6,
          border:          '1px solid rgba(255,255,255,0.5)',
          backgroundColor: 'transparent',
          color:           '#fff',
          fontSize:        12,
          fontWeight:      600,
          cursor:          exiting ? 'not-allowed' : 'pointer',
          whiteSpace:      'nowrap',
          opacity:         exiting ? 0.6 : 1,
        }}
      >
        {exiting ? 'Exiting…' : 'Exit Preview'}
      </button>
    </div>
  )
}
