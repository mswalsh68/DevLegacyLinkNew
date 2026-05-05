'use client'

import { useState } from 'react'
import { useTeamConfig } from '@/providers/ThemeProvider'
import { COMMUNITY_TC_VERSION } from '@/lib/constants'

interface Props {
  onAccept: () => void
  onDecline: () => void
  submitting: boolean
}

export function CommunityConsentModal({ onAccept, onDecline, submitting }: Props) {
  const { teamName } = useTeamConfig()

  return (
    <div style={{
      position:        'fixed',
      inset:           0,
      zIndex:          9999,
      backgroundColor: 'rgba(0,0,0,0.55)',
      display:         'flex',
      alignItems:      'center',
      justifyContent:  'center',
      padding:         '16px',
    }}>
      <div style={{
        backgroundColor: 'var(--color-card-bg)',
        borderRadius:    'var(--radius-lg)',
        maxWidth:        540,
        width:           '100%',
        boxShadow:       '0 20px 48px rgba(0,0,0,0.22)',
        overflow:        'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding:         '24px 28px 20px',
          borderBottom:    '1px solid var(--color-card-border)',
          backgroundColor: 'var(--color-primary)',
        }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#fff', margin: 0 }}>
            Join the {teamName} Alumni Community
          </h2>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)', margin: '6px 0 0' }}>
            Version {COMMUNITY_TC_VERSION}
          </p>
        </div>

        {/* Body */}
        <div style={{ padding: '24px 28px' }}>
          <p style={{ fontSize: 14, color: 'var(--color-gray-700)', lineHeight: 1.7, margin: '0 0 16px' }}>
            By joining the alumni community you agree to the following terms:
          </p>
          <ul style={{ fontSize: 14, color: 'var(--color-gray-700)', lineHeight: 1.8, margin: '0 0 20px', paddingLeft: 20 }}>
            <li>Your name and contact details may be visible to other verified alumni and program staff of {teamName}.</li>
            <li>You can control your contact visibility at any time from your profile settings.</li>
            <li>Your information will not be shared outside the {teamName} program.</li>
            <li>You may withdraw from the community at any time by contacting program staff.</li>
          </ul>
          <p style={{ fontSize: 13, color: 'var(--color-gray-500)', margin: 0 }}>
            Declining will hide your profile from other alumni. You can still use the feed.
          </p>
        </div>

        {/* Footer */}
        <div style={{
          padding:      '16px 28px 24px',
          display:      'flex',
          gap:          12,
          justifyContent: 'flex-end',
          borderTop:    '1px solid var(--color-card-border)',
        }}>
          <button
            onClick={onDecline}
            disabled={submitting}
            style={{
              padding:         '9px 20px',
              borderRadius:    'var(--radius-sm)',
              border:          '1.5px solid var(--color-gray-300)',
              backgroundColor: 'transparent',
              color:           'var(--color-gray-600)',
              fontSize:        13,
              fontWeight:      600,
              cursor:          submitting ? 'default' : 'pointer',
              opacity:         submitting ? 0.6 : 1,
            }}
          >
            Decline
          </button>
          <button
            onClick={onAccept}
            disabled={submitting}
            style={{
              padding:         '9px 20px',
              borderRadius:    'var(--radius-sm)',
              border:          'none',
              backgroundColor: 'var(--color-primary)',
              color:           '#fff',
              fontSize:        13,
              fontWeight:      600,
              cursor:          submitting ? 'default' : 'pointer',
              opacity:         submitting ? 0.6 : 1,
            }}
          >
            {submitting ? 'Saving…' : 'Join Community'}
          </button>
        </div>
      </div>
    </div>
  )
}
