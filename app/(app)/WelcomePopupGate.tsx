'use client'

// Shown to alumni users (program_role_id = 7) who have a pending welcome popup
// (role_change_log row with popup_shown = 0 and to_program_role_id = 7).
// Fetches on mount; renders the modal if pending; POSTs dismiss on button click.

import { useEffect, useState } from 'react'
import { WelcomePopupModal } from '@/components/feed/WelcomePopupModal'

interface PopupData {
  logId:    number
  title:    string | null
  bodyHtml: string
  imageUrl: string | null
}

type PopupState = 'loading' | 'pending' | 'done'

export function WelcomePopupGate() {
  const [state,      setState]      = useState<PopupState>('loading')
  const [popup,      setPopup]      = useState<PopupData | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetch('/api/feed/welcome-popup', { credentials: 'include' })
      .then((r) => r.json())
      .then(({ success, data }) => {
        if (!success || !data?.pending) { setState('done'); return }
        setPopup({
          logId:    data.logId,
          title:    data.title,
          bodyHtml: data.bodyHtml,
          imageUrl: data.imageUrl,
        })
        setState('pending')
      })
      .catch(() => setState('done'))
  }, [])

  const dismiss = async () => {
    if (!popup) return
    setSubmitting(true)
    try {
      await fetch('/api/feed/welcome-popup', {
        method:      'POST',
        headers:     { 'Content-Type': 'application/json' },
        credentials: 'include',
        body:        JSON.stringify({ logId: popup.logId }),
      })
    } catch {
      // best-effort — popup won't reappear until next login anyway
    } finally {
      setState('done')
      setSubmitting(false)
    }
  }

  if (state !== 'pending' || !popup) return null

  return (
    <WelcomePopupModal
      title={popup.title}
      bodyHtml={popup.bodyHtml}
      imageUrl={popup.imageUrl}
      onDismiss={dismiss}
      submitting={submitting}
    />
  )
}
