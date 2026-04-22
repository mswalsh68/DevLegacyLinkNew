// ─── Status option arrays ──────────────────────────────────────────────────────

export const PLAYER_STATUS_OPTIONS = [
  { value: 'active',      label: 'Active'      },
  { value: 'injured',     label: 'Injured'     },
  { value: 'suspended',   label: 'Suspended'   },
  { value: 'transferred', label: 'Transferred' },
  { value: 'walkOn',      label: 'Walk-On'     },
]

export const ALUMNI_STATUS_OPTIONS = [
  { value: 'active',       label: 'Active'         },
  { value: 'lostContact',  label: 'Lost Contact'   },
  { value: 'doNotContact', label: 'Do Not Contact' },
  { value: 'deceased',     label: 'Deceased'       },
]

// ─── Badge-variant helpers ─────────────────────────────────────────────────────

/** Alumni relationship status → Badge variant */
export function alumniStatusBadge(status: string): 'green' | 'warning' | 'danger' | 'gray' {
  const map: Record<string, 'green' | 'warning' | 'danger' | 'gray'> = {
    active:       'green',
    lostContact:  'warning',
    doNotContact: 'danger',
    deceased:     'gray',
  }
  return map[status] ?? 'gray'
}

/** Player status → Badge variant */
export function playerStatusBadge(status: string): 'green' | 'warning' | 'danger' | 'gray' | 'gold' {
  const map: Record<string, 'green' | 'warning' | 'danger' | 'gray' | 'gold'> = {
    active:      'green',
    injured:     'warning',
    suspended:   'danger',
    transferred: 'gray',
    walkOn:      'gold',
  }
  return map[status] ?? 'gray'
}

/** Campaign status → Badge variant */
export const CAMPAIGN_STATUS_BADGE: Record<string, 'green' | 'gold' | 'gray' | 'danger'> = {
  draft:     'gray',
  scheduled: 'gold',
  active:    'green',
  completed: 'green',
  cancelled: 'danger',
}

/** Feed post audience → Badge variant */
export const AUDIENCE_BADGE: Record<string, 'green' | 'gold' | 'gray'> = {
  all:          'gray',
  players_only: 'green',
  alumni_only:  'gold',
  by_position:  'gray',
  by_grad_year: 'gray',
  custom:       'gray',
}
