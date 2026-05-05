'use client'

// Shown to alumni users (program_role_id = 7) who have not yet responded to the
// community T&C for the current App DB (tenant).  Fetches consent state on mount
// and renders the modal if the user needs to respond.  Disappears once resolved.

import { useEffect, useState } from 'react'
import { CommunityConsentModal } from '@/components/community/CommunityConsentModal'
import { COMMUNITY_TC_VERSION } from '@/lib/constants'

type ConsentState = 'loading' | 'needed' | 'done'

export function CommunityConsentGate() {
  const [state,      setState]      = useState<ConsentState>('loading')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetch('/api/community/consent', { credentials: 'include' })
      .then((r) => r.json())
      .then(({ success, data }) => {
        if (!success || !data) { setState('done'); return }
        const needsConsent =
          !data.consentAccepted ||
          data.consentTcVersion !== COMMUNITY_TC_VERSION
        setState(needsConsent ? 'needed' : 'done')
      })
      .catch(() => setState('done'))  // best-effort — don't block on network error
  }, [])

  const respond = async (accepted: boolean) => {
    setSubmitting(true)
    try {
      await fetch('/api/community/consent', {
        method:      'POST',
        headers:     { 'Content-Type': 'application/json' },
        credentials: 'include',
        body:        JSON.stringify({ accepted }),
      })
    } catch {
      // ignore — consent will be re-requested on next page load
    } finally {
      setState('done')
      setSubmitting(false)
    }
  }

  if (state !== 'needed') return null

  return (
    <CommunityConsentModal
      onAccept={() => respond(true)}
      onDecline={() => respond(false)}
      submitting={submitting}
    />
  )
}
