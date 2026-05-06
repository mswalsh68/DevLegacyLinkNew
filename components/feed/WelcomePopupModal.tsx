'use client'

import { useTeamConfig } from '@/providers/ThemeProvider'

interface Props {
  title:      string | null
  bodyHtml:   string
  imageUrl:   string | null
  onDismiss:  () => void
  submitting: boolean
}

export function WelcomePopupModal({ title, bodyHtml, imageUrl, onDismiss, submitting }: Props) {
  const { teamName } = useTeamConfig()

  return (
    <div style={{
      position:        'fixed',
      inset:           0,
      zIndex:          9998,
      backgroundColor: 'rgba(0,0,0,0.60)',
      display:         'flex',
      alignItems:      'center',
      justifyContent:  'center',
      padding:         '16px',
      overflowY:       'auto',
    }}>
      <div style={{
        backgroundColor: 'var(--color-card-bg)',
        borderRadius:    'var(--radius-lg)',
        maxWidth:        560,
        width:           '100%',
        boxShadow:       '0 20px 48px rgba(0,0,0,0.25)',
        overflow:        'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding:         '24px 28px 20px',
          borderBottom:    '1px solid var(--color-card-border)',
          backgroundColor: 'var(--color-primary)',
          display:         'flex',
          alignItems:      'center',
          gap:             14,
        }}>
          {imageUrl && (
            <img
              src={imageUrl}
              alt={teamName}
              style={{ width: 40, height: 40, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }}
            />
          )}
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: '#fff', margin: 0 }}>
              {title ?? `Welcome to ${teamName}`}
            </h2>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', margin: '4px 0 0' }}>
              {teamName} Alumni
            </p>
          </div>
        </div>

        {/* Body — trusted system HTML from dbo.feed_posts */}
        <div
          style={{ padding: '24px 28px', maxHeight: '60vh', overflowY: 'auto' }}
          dangerouslySetInnerHTML={{ __html: bodyHtml }}
        />

        {/* Footer */}
        <div style={{
          padding:        '16px 28px 24px',
          display:        'flex',
          justifyContent: 'flex-end',
          borderTop:      '1px solid var(--color-card-border)',
        }}>
          <button
            onClick={onDismiss}
            disabled={submitting}
            style={{
              padding:         '10px 28px',
              borderRadius:    'var(--radius-sm)',
              border:          'none',
              backgroundColor: 'var(--color-primary)',
              color:           '#fff',
              fontSize:        14,
              fontWeight:      600,
              cursor:          submitting ? 'default' : 'pointer',
              opacity:         submitting ? 0.6 : 1,
            }}
          >
            {submitting ? 'Saving…' : 'Continue to Feed'}
          </button>
        </div>
      </div>
    </div>
  )
}
