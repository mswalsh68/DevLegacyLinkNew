'use client'

// Add Members Wizard — unified entry point for all member creation.
// Step 1 → Member Type (Player / Alumni / Coach)
// Step 2 → Action     (Create Single / Bulk Upload / Generate Invite Link)
// Step 3 → Configure  (contextual form per type + action)
// Step 4 → Result     (success confirmation + invite URL if applicable)

import { useState, useRef, useTransition } from 'react'
import { Modal }  from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { createPlayer }     from '@/app/actions/players'
import { createAlumni }     from '@/app/actions/alumni'
import { createCoachStaff, generateInviteCode, generateSetupLink } from '@/app/actions/members'
import { bulkCreatePlayers } from '@/app/actions/players'
import { bulkCreateAlumni }  from '@/app/actions/alumni'

// ─── Types ────────────────────────────────────────────────────────────────────

type MemberType   = 'player' | 'alumni' | 'coach'
type WizardAction = 'create' | 'bulk' | 'invite'
type WizardStep   = 'type' | 'action' | 'configure' | 'result'

interface WizardResult {
  success:    boolean
  message:    string
  inviteUrl?: string
  setupUrl?:  string   // one-time account activation link for directly-created users
  count?:     number
  errors?:    string
}

interface SportOption {
  id:   string
  name: string
  abbr: string
}

export interface AddMembersWizardProps {
  isOpen:        boolean
  onClose:       () => void
  teamId:        number
  teamName:      string
  sport:         string
  positions:     string[]
  academicYears: string[]
  userId:        string
  appDb:         string         // tenant App DB name from session.appDb
  userRoleId:    number         // creator's roleId — enforces "at or below your level"
  sports:        SportOption[]  // active sports for this team
}

// Roles that can be assigned to staff/coach members, ordered by roleId.
// Only roles with roleId > creator's roleId are shown.
const STAFF_ROLES: { value: 'app_admin' | 'head_coach' | 'position_coach' | 'alumni_director'; label: string; roleId: number }[] = [
  { value: 'app_admin',       label: 'App Admin',        roleId: 2 },
  { value: 'head_coach',      label: 'Head Coach',       roleId: 3 },
  { value: 'position_coach',  label: 'Position Coach',   roleId: 4 },
  { value: 'alumni_director', label: 'Alumni Director',  roleId: 5 },
]

// ─── Shared style tokens ──────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width:        '100%',
  border:       '1.5px solid var(--color-gray-200)',
  borderRadius: 'var(--radius-sm)',
  padding:      '8px 12px',
  fontSize:     14,
  color:        'var(--color-gray-900)',
  background:   '#fff',
  boxSizing:    'border-box',
}

const labelStyle: React.CSSProperties = {
  fontSize:     12,
  fontWeight:   600,
  color:        'var(--color-gray-700)',
  display:      'block',
  marginBottom: 5,
}

const sectionStyle: React.CSSProperties = {
  display:       'flex',
  flexDirection: 'column',
  gap:           14,
}

// ─── Type-card tile (step 1 + 2) ─────────────────────────────────────────────

function OptionTile({
  icon, title, description, selected, onClick,
}: {
  icon: string; title: string; description: string
  selected: boolean; onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        border:          selected
          ? '2px solid var(--color-primary)'
          : '2px solid var(--color-gray-200)',
        borderRadius:    12,
        padding:         '16px 20px',
        background:      selected ? 'var(--color-primary-light)' : '#fff',
        cursor:          'pointer',
        textAlign:       'left',
        transition:      'border-color 0.15s, background 0.15s',
        width:           '100%',
      }}
    >
      <div style={{ fontSize: 22, marginBottom: 6 }}>{icon}</div>
      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-gray-900)', marginBottom: 3 }}>
        {title}
      </div>
      <div style={{ fontSize: 12, color: 'var(--color-gray-500)' }}>{description}</div>
    </button>
  )
}

// ─── Field helpers ────────────────────────────────────────────────────────────

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label style={labelStyle}>{label}{required && <span style={{ color: 'var(--color-danger)' }}> *</span>}</label>
      {children}
    </div>
  )
}

function TextInput({ value, onChange, placeholder, type = 'text', required }: {
  value: string; onChange: (v: string) => void
  placeholder?: string; type?: string; required?: boolean
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      required={required}
      style={inputStyle}
    />
  )
}

function SelectInput({ value, onChange, options }: {
  value: string; onChange: (v: string) => void
  options: string[]
}) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} style={{ ...inputStyle, appearance: 'auto' }}>
      <option value="">Select…</option>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  )
}

// ─── CSV utilities ────────────────────────────────────────────────────────────

const CSV_TEMPLATES: Record<MemberType, { headers: string[]; example: string[] }> = {
  player: {
    headers: ['email','firstName','lastName','position','academicYear','recruitingClass'],
    example: ['john@email.com','John','Smith','QB','Junior','2022'],
  },
  alumni: {
    headers: ['email','firstName','lastName','position','graduationYear','city','state'],
    example: ['jane@email.com','Jane','Doe','WR','2019','Tampa','FL'],
  },
  coach: {
    headers: ['email','firstName','lastName'],
    example: ['coach@email.com','Mike','Jones'],
  },
}

function downloadTemplate(type: MemberType) {
  const { headers, example } = CSV_TEMPLATES[type]
  const csv  = [headers.join(','), example.join(',')].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `${type}-template.csv`
  a.click()
  URL.revokeObjectURL(url)
}

function parseCSV(text: string, type: MemberType): Record<string, string>[] {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  if (lines.length < 2) return []
  const headers = lines[0].split(',').map(h => h.trim())
  return lines.slice(1).map(line => {
    const vals = line.split(',').map(v => v.trim())
    const row: Record<string, string> = {}
    headers.forEach((h, i) => { row[h] = vals[i] ?? '' })
    return row
  })
}

// ─── Main wizard component ────────────────────────────────────────────────────

export function AddMembersWizard({
  isOpen, onClose,
  teamId, teamName, sport, positions, academicYears, userId, appDb, userRoleId, sports,
}: AddMembersWizardProps) {
  // Roles the current user is allowed to assign (must be below their own level)
  const assignableStaffRoles = STAFF_ROLES.filter(r => r.roleId > userRoleId)
  const showSportPicker = sports.length > 1

  const [step,       setStep]       = useState<WizardStep>('type')
  const [memberType, setMemberType] = useState<MemberType | null>(null)
  const [action,     setAction]     = useState<WizardAction | null>(null)
  const [result,     setResult]     = useState<WizardResult | null>(null)
  const [isPending,  startTransition] = useTransition()

  // ── Create single: form state ─────────────────────────────────────────────
  const [email,           setEmail]           = useState('')
  const [firstName,       setFirstName]       = useState('')
  const [lastName,        setLastName]        = useState('')
  const [position,        setPosition]        = useState('')
  const [academicYear,    setAcademicYear]     = useState('')
  const [recruitingClass, setRecruitingClass] = useState('')
  const [graduationYear,  setGraduationYear]  = useState('')
  const [coachRole,       setCoachRole]       = useState<'app_admin' | 'head_coach' | 'position_coach' | 'alumni_director'>('head_coach')
  const [selSportId,      setSelSportId]      = useState(() => sports[0]?.id ?? '')
  const [formError,       setFormError]       = useState('')

  // ── Bulk upload state ─────────────────────────────────────────────────────
  const [csvRows,     setCsvRows]     = useState<Record<string, string>[]>([])
  const [csvFileName, setCsvFileName] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Invite state ──────────────────────────────────────────────────────────
  const [inviteRole,     setInviteRole]     = useState('player')
  const [inviteExpiry,   setInviteExpiry]   = useState('')
  const [inviteMaxUses,  setInviteMaxUses]  = useState('')
  const [generatedUrl,   setGeneratedUrl]   = useState('')
  const [urlCopied,      setUrlCopied]      = useState(false)

  // ── Navigation helpers ────────────────────────────────────────────────────
  function resetWizard() {
    setStep('type'); setMemberType(null); setAction(null); setResult(null)
    setEmail(''); setFirstName(''); setLastName(''); setPosition('')
    setAcademicYear(''); setRecruitingClass(''); setGraduationYear('')
    setCoachRole('head_coach'); setSelSportId(sports[0]?.id ?? ''); setFormError('')
    setCsvRows([]); setCsvFileName('')
    setInviteRole('player'); setInviteExpiry(''); setInviteMaxUses('')
    setGeneratedUrl(''); setUrlCopied(false)
  }

  function handleClose() { resetWizard(); onClose() }

  function goBack() {
    if (step === 'action')    { setStep('type');   setAction(null) }
    if (step === 'configure') { setStep('action'); setFormError('') }
    if (step === 'result')    { resetWizard() }
  }

  function selectType(t: MemberType) {
    setMemberType(t)
    setStep('action')
  }

  function selectAction(a: WizardAction) {
    setAction(a)
    if (a === 'invite') {
      // Default invite role based on member type
      setInviteRole(memberType === 'coach' ? (assignableStaffRoles[0]?.value ?? 'head_coach') : memberType === 'alumni' ? 'alumni' : 'player')
    }
    setStep('configure')
  }

  // ── CSV file handler ──────────────────────────────────────────────────────
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setCsvFileName(file.name)
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      const rows = parseCSV(text, memberType!)
      setCsvRows(rows)
    }
    reader.readAsText(file)
  }

  // ── Submit handlers ───────────────────────────────────────────────────────
  function handleSubmit() {
    setFormError('')

    if (action === 'create') {
      if (!email || !firstName || !lastName) {
        setFormError('Email, first name, and last name are required.')
        return
      }
    }

    startTransition(async () => {
      if (action === 'create') {
        await submitCreate()
      } else if (action === 'bulk') {
        await submitBulk()
      } else if (action === 'invite') {
        await submitInvite()
      }
    })
  }

  async function submitCreate() {
    if (memberType === 'player') {
      const res = await createPlayer({
        appDb,
        email, firstName, lastName,
        position:        position || 'ATH',
        academicYear:    academicYear || 'Freshman',
        recruitingClass: parseInt(recruitingClass) || new Date().getFullYear(),
        globalTeamId:    teamId,
        createdBy:       userId,
        sportId:         selSportId || undefined,
      })
      if (res.success) {
        const setup = res.userId ? await generateSetupLink(res.userId) : null
        setResult({
          success:  true,
          message:  `${firstName} ${lastName} added to the roster.`,
          setupUrl: setup?.setupUrl,
        })
        setStep('result')
      } else {
        setFormError(res.error ?? 'Failed to create player.')
      }

    } else if (memberType === 'alumni') {
      const res = await createAlumni({
        appDb,
        email, firstName, lastName,
        position:       position || undefined,
        graduationYear: graduationYear ? parseInt(graduationYear) : undefined,
        globalTeamId:   teamId,
        createdBy:      userId,
        sportId:        selSportId || undefined,
      })
      if (res.success) {
        const setup = res.userId ? await generateSetupLink(res.userId) : null
        setResult({
          success:  true,
          message:  `${firstName} ${lastName} added to alumni.`,
          setupUrl: setup?.setupUrl,
        })
        setStep('result')
      } else {
        setFormError(res.error ?? 'Failed to create alumni.')
      }

    } else if (memberType === 'coach') {
      const res = await createCoachStaff({
        email, firstName, lastName, teamId, role: coachRole,
      })
      if (res.success) {
        const setup = res.userId ? await generateSetupLink(res.userId) : null
        setResult({
          success:  true,
          message:  `${firstName} ${lastName} added as ${coachRole.replace(/_/g, ' ')}.`,
          setupUrl: setup?.setupUrl,
        })
        setStep('result')
      } else {
        setFormError(res.error ?? 'Failed to create coach.')
      }
    }
  }

  async function submitBulk() {
    if (csvRows.length === 0) {
      setFormError('Please upload a CSV file with at least one row.')
      return
    }

    if (memberType === 'player') {
      const players = csvRows.map(r => ({
        email:          r.email,
        firstName:      r.firstName      || r.first_name  || '',
        lastName:       r.lastName       || r.last_name   || '',
        position:       r.position       || 'ATH',
        academicYear:   r.academicYear   || r.academic_year || 'Freshman',
        recruitingClass: parseInt(r.recruitingClass || r.recruiting_class || '') || new Date().getFullYear(),
      }))
      const res = await bulkCreatePlayers({ appDb, players, createdBy: userId, globalTeamId: teamId, sportId: selSportId || undefined })
      setResult({
        success: res.successCount > 0,
        message: `${res.successCount} player(s) added.`,
        count:   res.successCount,
        errors:  res.skippedCount > 0 ? `${res.skippedCount} row(s) skipped.` : undefined,
      })
      setStep('result')

    } else if (memberType === 'alumni') {
      const alumni = csvRows.map(r => ({
        email:          r.email,
        firstName:      r.firstName || r.first_name || '',
        lastName:       r.lastName  || r.last_name  || '',
        graduationYear: r.graduationYear ? parseInt(r.graduationYear) : undefined,
        currentCity:    r.city  || undefined,
        currentState:   r.state || undefined,
      }))
      const res = await bulkCreateAlumni({ appDb, alumni, createdBy: userId, globalTeamId: teamId, sportId: selSportId || undefined })
      setResult({
        success: res.successCount > 0,
        message: `${res.successCount} alumni added.`,
        count:   res.successCount,
        errors:  res.skippedCount > 0 ? `${res.skippedCount} row(s) skipped.` : undefined,
      })
      setStep('result')

    } else if (memberType === 'coach') {
      // For coaches, process row-by-row
      let success = 0, failed = 0
      for (const r of csvRows) {
        const res = await createCoachStaff({
          email:     r.email,
          firstName: r.firstName || r.first_name || '',
          lastName:  r.lastName  || r.last_name  || '',
          teamId,
          role: coachRole,
        })
        if (res.success) success++; else failed++
      }
      setResult({
        success: success > 0,
        message: `${success} coach(es) added.`,
        count:   success,
        errors:  failed > 0 ? `${failed} row(s) failed.` : undefined,
      })
      setStep('result')
    }
  }

  async function submitInvite() {
    const res = await generateInviteCode({
      teamId,
      role:      inviteRole,
      expiresAt: inviteExpiry ? new Date(inviteExpiry) : null,
      maxUses:   inviteMaxUses ? parseInt(inviteMaxUses) : null,
    })

    if (res.success && res.inviteUrl) {
      setGeneratedUrl(res.inviteUrl)
      setResult({ success: true, message: 'Invite link generated.', inviteUrl: res.inviteUrl })
      setStep('result')
    } else {
      setFormError(res.error ?? 'Failed to generate invite link.')
    }
  }

  function copyUrl(url: string) {
    navigator.clipboard.writeText(url).then(() => {
      setUrlCopied(true)
      setTimeout(() => setUrlCopied(false), 2000)
    })
  }

  // ── Step titles ───────────────────────────────────────────────────────────
  const stepTitle: Record<WizardStep, string> = {
    type:      'Add Members',
    action:    `Add ${memberType === 'coach' ? 'Coach / Admin' : memberType === 'alumni' ? 'Alumni' : 'Player'}`,
    configure: action === 'invite' ? 'Generate Invite Link'
             : action === 'bulk'   ? 'Bulk Upload'
             : `Create ${memberType === 'coach' ? 'Coach / Admin' : memberType === 'alumni' ? 'Alumni' : 'Player'}`,
    result: 'Done',
  }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <Modal title={stepTitle[step]} onClose={handleClose} isOpen={isOpen} size="md">

      {/* Progress breadcrumb */}
      {step !== 'result' && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 24, alignItems: 'center' }}>
          {(['type','action','configure'] as WizardStep[]).map((s, i) => (
            <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{
                width: 22, height: 22, borderRadius: '50%', fontSize: 11, fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                backgroundColor: step === s
                  ? 'var(--color-primary)'
                  : ['type','action','configure'].indexOf(step) > i
                    ? 'var(--color-primary-light)'
                    : 'var(--color-gray-100)',
                color: step === s ? '#fff'
                  : ['type','action','configure'].indexOf(step) > i
                    ? 'var(--color-primary)'
                    : 'var(--color-gray-400)',
              }}>
                {['type','action','configure'].indexOf(step) > i ? '✓' : i + 1}
              </div>
              {i < 2 && <div style={{ width: 24, height: 1, backgroundColor: 'var(--color-gray-200)' }} />}
            </div>
          ))}
        </div>
      )}

      {/* ── Step 1: Member Type ── */}
      {step === 'type' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <OptionTile
            icon="🏈" title="Player" description="Add to active roster"
            selected={memberType === 'player'} onClick={() => selectType('player')}
          />
          <OptionTile
            icon="🎓" title="Alumni" description="Graduate or past player"
            selected={memberType === 'alumni'} onClick={() => selectType('alumni')}
          />
          <OptionTile
            icon="📋" title="Coach / Admin" description="Staff member"
            selected={memberType === 'coach'} onClick={() => selectType('coach')}
          />
        </div>
      )}

      {/* ── Step 2: Action ── */}
      {step === 'action' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 24 }}>
            <OptionTile
              icon="✏️" title="Create" description="Single member form"
              selected={action === 'create'} onClick={() => selectAction('create')}
            />
            <OptionTile
              icon="📄" title="Bulk Upload" description="CSV file import"
              selected={action === 'bulk'} onClick={() => selectAction('bulk')}
            />
            <OptionTile
              icon="🔗" title="Invite Link" description="Share a signup link"
              selected={action === 'invite'} onClick={() => selectAction('invite')}
            />
          </div>
          <Button label="← Back" variant="ghost" size="sm" onClick={goBack} />
        </>
      )}

      {/* ── Step 3: Configure ── */}
      {step === 'configure' && (
        <>
          {/* CREATE SINGLE ─────────────────────────────────────────── */}
          {action === 'create' && (
            <div style={sectionStyle}>
              {formError && (
                <div style={{ padding: '10px 14px', borderRadius: 8, fontSize: 13, backgroundColor: 'var(--color-danger-light)', color: 'var(--color-danger)' }}>
                  {formError}
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field label="First Name" required>
                  <TextInput value={firstName} onChange={setFirstName} placeholder="Jane" />
                </Field>
                <Field label="Last Name" required>
                  <TextInput value={lastName} onChange={setLastName} placeholder="Smith" />
                </Field>
              </div>

              <Field label="Email" required>
                <TextInput value={email} onChange={setEmail} placeholder="player@email.com" type="email" />
              </Field>

              {/* Sport selector (multi-sport teams only, not applicable to coaches) */}
              {showSportPicker && memberType !== 'coach' && (
                <Field label="Sport">
                  <select
                    value={selSportId}
                    onChange={e => setSelSportId(e.target.value)}
                    style={{ ...inputStyle, appearance: 'auto' }}
                  >
                    {sports.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </Field>
              )}

              {/* Player-specific */}
              {memberType === 'player' && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <Field label="Position">
                      <SelectInput value={position} onChange={setPosition} options={positions} />
                    </Field>
                    <Field label="Academic Year">
                      <SelectInput value={academicYear} onChange={setAcademicYear} options={academicYears} />
                    </Field>
                  </div>
                  <Field label="Recruiting Class (year)">
                    <TextInput value={recruitingClass} onChange={setRecruitingClass} placeholder={String(new Date().getFullYear())} type="number" />
                  </Field>
                </>
              )}

              {/* Alumni-specific */}
              {memberType === 'alumni' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <Field label="Position">
                    <SelectInput value={position} onChange={setPosition} options={positions} />
                  </Field>
                  <Field label="Graduation Year">
                    <TextInput value={graduationYear} onChange={setGraduationYear} placeholder="2019" type="number" />
                  </Field>
                </div>
              )}

              {/* Coach-specific */}
              {memberType === 'coach' && (
                <Field label="Role">
                  <select
                    value={coachRole}
                    onChange={e => setCoachRole(e.target.value as typeof coachRole)}
                    style={{ ...inputStyle, appearance: 'auto' }}
                  >
                    {assignableStaffRoles.map(r => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </Field>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
                <Button label="← Back" variant="ghost" size="sm" onClick={goBack} />
                <Button label={isPending ? 'Adding…' : 'Add Member'} loading={isPending} onClick={handleSubmit} />
              </div>
            </div>
          )}

          {/* BULK UPLOAD ───────────────────────────────────────────── */}
          {action === 'bulk' && (
            <div style={sectionStyle}>
              {formError && (
                <div style={{ padding: '10px 14px', borderRadius: 8, fontSize: 13, backgroundColor: 'var(--color-danger-light)', color: 'var(--color-danger)' }}>
                  {formError}
                </div>
              )}

              {/* Sport selector (multi-sport teams only, not applicable to coaches) */}
              {showSportPicker && memberType !== 'coach' && (
                <Field label="Sport">
                  <select
                    value={selSportId}
                    onChange={e => setSelSportId(e.target.value)}
                    style={{ ...inputStyle, appearance: 'auto' }}
                  >
                    {sports.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </Field>
              )}

              {/* Template download */}
              <div style={{ backgroundColor: 'var(--color-gray-50)', border: '1px solid var(--color-gray-200)', borderRadius: 8, padding: '12px 16px' }}>
                <p style={{ fontSize: 13, color: 'var(--color-gray-600)', margin: '0 0 8px' }}>
                  Download the CSV template, fill it in, then upload below.
                </p>
                <Button label="Download Template" variant="outline" size="sm" onClick={() => downloadTemplate(memberType!)} />
              </div>

              {/* File input */}
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  style={{ display: 'none' }}
                  onChange={handleFileChange}
                />
                <div
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    border:          '2px dashed var(--color-gray-300)',
                    borderRadius:    10,
                    padding:         '28px 20px',
                    textAlign:       'center',
                    cursor:          'pointer',
                    backgroundColor: 'var(--color-gray-50)',
                  }}
                >
                  {csvFileName ? (
                    <>
                      <div style={{ fontSize: 20, marginBottom: 6 }}>📄</div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-gray-800)' }}>{csvFileName}</div>
                      <div style={{ fontSize: 12, color: 'var(--color-gray-500)', marginTop: 4 }}>
                        {csvRows.length} row(s) ready · Click to change
                      </div>
                    </>
                  ) : (
                    <>
                      <div style={{ fontSize: 24, marginBottom: 6 }}>⬆️</div>
                      <div style={{ fontSize: 14, color: 'var(--color-gray-600)' }}>Click to upload CSV</div>
                    </>
                  )}
                </div>
              </div>

              {/* Preview */}
              {csvRows.length > 0 && (
                <div style={{ fontSize: 12, color: 'var(--color-gray-500)' }}>
                  Previewing first 3 rows of {csvRows.length} total:
                  <div style={{ fontFamily: 'monospace', backgroundColor: 'var(--color-gray-50)', border: '1px solid var(--color-gray-200)', borderRadius: 6, padding: '8px 10px', marginTop: 6, overflowX: 'auto' }}>
                    {csvRows.slice(0, 3).map((r, i) => (
                      <div key={i}>{JSON.stringify(r)}</div>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
                <Button label="← Back" variant="ghost" size="sm" onClick={goBack} />
                <Button
                  label={isPending ? 'Uploading…' : `Upload ${csvRows.length || ''} Records`}
                  loading={isPending}
                  disabled={csvRows.length === 0}
                  onClick={handleSubmit}
                />
              </div>
            </div>
          )}

          {/* INVITE LINK ───────────────────────────────────────────── */}
          {action === 'invite' && (
            <div style={sectionStyle}>
              {formError && (
                <div style={{ padding: '10px 14px', borderRadius: 8, fontSize: 13, backgroundColor: 'var(--color-danger-light)', color: 'var(--color-danger)' }}>
                  {formError}
                </div>
              )}

              {/* Context */}
              <div style={{ backgroundColor: 'var(--color-primary-light)', border: '1px solid var(--color-primary)', borderRadius: 8, padding: '12px 16px' }}>
                <p style={{ fontSize: 13, color: 'var(--color-primary)', margin: 0, fontWeight: 600 }}>
                  {teamName} · {sport}
                </p>
                <p style={{ fontSize: 12, color: 'var(--color-gray-600)', margin: '4px 0 0' }}>
                  Anyone with this link can request access. Requests require admin approval.
                </p>
              </div>

              <Field label="Access Role">
                <select
                  value={inviteRole}
                  onChange={e => setInviteRole(e.target.value)}
                  style={{ ...inputStyle, appearance: 'auto' }}
                >
                  <option value="player">Player</option>
                  <option value="alumni">Alumni</option>
                  {assignableStaffRoles.map(r => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </Field>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field label="Expiry Date (optional)">
                  <TextInput value={inviteExpiry} onChange={setInviteExpiry} type="date" />
                </Field>
                <Field label="Max Uses (optional)">
                  <TextInput value={inviteMaxUses} onChange={setInviteMaxUses} placeholder="Unlimited" type="number" />
                </Field>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
                <Button label="← Back" variant="ghost" size="sm" onClick={goBack} />
                <Button label={isPending ? 'Generating…' : 'Generate Link'} loading={isPending} onClick={handleSubmit} />
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Step 4: Result ── */}
      {step === 'result' && result && (
        <div style={{ textAlign: 'center', padding: '8px 0' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>{result.success ? '✅' : '❌'}</div>
          <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-gray-900)', margin: '0 0 8px' }}>
            {result.success ? 'Success!' : 'Something went wrong'}
          </h3>
          <p style={{ fontSize: 14, color: 'var(--color-gray-600)', margin: '0 0 16px' }}>
            {result.message}
          </p>

          {result.errors && (
            <p style={{ fontSize: 13, color: 'var(--color-warning)', marginBottom: 16 }}>
              {result.errors}
            </p>
          )}

          {/* Setup URL — one-time activation link for directly-created users */}
          {result.setupUrl && (
            <div style={{ marginBottom: 20 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-gray-700)', marginBottom: 8 }}>
                Share this link so they can set their password:
              </p>
              <div style={{
                backgroundColor: 'var(--color-gray-50)',
                border:          '1px solid var(--color-gray-200)',
                borderRadius:    8,
                padding:         '10px 14px',
                fontSize:        12,
                color:           'var(--color-gray-700)',
                wordBreak:       'break-all',
                textAlign:       'left',
                marginBottom:    10,
              }}>
                {result.setupUrl}
              </div>
              <Button
                label={urlCopied ? 'Copied!' : 'Copy Setup Link'}
                variant={urlCopied ? 'secondary' : 'primary'}
                onClick={() => copyUrl(result.setupUrl!)}
                fullWidth
              />
              <p style={{ fontSize: 12, color: 'var(--color-gray-500)', marginTop: 8 }}>
                Expires in 7 days. Single use — the link becomes inactive once they set their password.
              </p>
            </div>
          )}

          {/* Invite URL display */}
          {result.inviteUrl && (
            <div style={{ marginBottom: 20 }}>
              <div style={{
                backgroundColor: 'var(--color-gray-50)',
                border:          '1px solid var(--color-gray-200)',
                borderRadius:    8,
                padding:         '10px 14px',
                fontSize:        13,
                color:           'var(--color-gray-700)',
                wordBreak:       'break-all',
                textAlign:       'left',
                marginBottom:    10,
              }}>
                {result.inviteUrl}
              </div>
              <Button
                label={urlCopied ? 'Copied!' : 'Copy Invite Link'}
                variant={urlCopied ? 'secondary' : 'primary'}
                onClick={() => copyUrl(result.inviteUrl!)}
                fullWidth
              />
              <p style={{ fontSize: 12, color: 'var(--color-gray-500)', marginTop: 8 }}>
                Share this link with the member. They will be prompted to request access, which requires admin approval.
              </p>
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 8 }}>
            <Button label="Add Another" variant="outline" onClick={resetWizard} />
            <Button label="Done" onClick={handleClose} />
          </div>
        </div>
      )}

    </Modal>
  )
}

export default AddMembersWizard
