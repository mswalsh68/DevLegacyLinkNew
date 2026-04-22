'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { theme } from '@/lib/theme'

export interface InviteBannerProps {
  inviteUrl:      string
  onDone:         () => void
  successTitle?:  string
}

export function InviteBanner({
  inviteUrl,
  onDone,
  successTitle = 'Added successfully!',
}: InviteBannerProps) {
  const [copied, setCopied] = useState(false)

  const copy = () => {
    navigator.clipboard.writeText(inviteUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div
      style={{
        backgroundColor: theme.cardBg,
        border:          `2px solid ${theme.primary}`,
        borderRadius:    'var(--radius-lg)',
        padding:         28,
        textAlign:       'center',
      }}
    >
      <div style={{ fontSize: 36, marginBottom: 12 }}>🎉</div>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: theme.gray900, margin: '0 0 8px' }}>
        {successTitle}
      </h2>
      <p style={{ fontSize: 14, color: theme.gray600, marginBottom: 20 }}>
        Share this invite link so they can set their password and log in for the first time.
        <br />
        <strong>Expires in 72 hours.</strong>
      </p>
      <div
        style={{
          backgroundColor: theme.gray50,
          border:          `1px solid ${theme.gray200}`,
          borderRadius:    8,
          padding:         '10px 14px',
          fontSize:        13,
          color:           theme.gray700,
          wordBreak:       'break-all',
          marginBottom:    16,
          textAlign:       'left',
        }}
      >
        {inviteUrl}
      </div>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
        <Button label={copied ? 'Copied!' : 'Copy Invite Link'} onClick={copy} />
        <Button label="Done" variant="outline" onClick={onDone} />
      </div>
    </div>
  )
}

export default InviteBanner
