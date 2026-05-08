'use client'

// Add Members Wizard — unified entry point for all member creation.
//
// Creator gating (from dbo.program_role):
//   role 8 (player)  — blocked entirely
//   role 7 (alumni)  — invite link only, for alumni of their sport(s)
//   role 1-6 (staff) — full access: dropdown role picker → create / bulk / invite
//
// Global role: every user created here gets role_id=3 (client) automatically.
// Positions are fetched dynamically per sport from /api/sports/[sportId]/positions.
// Invite links are sport-scoped.

import { useState, useRef, useEffect, useTransition } from 'react'
import { Modal }  from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { addPlayerToRoster, bulkAddPlayersToRoster } from '@/app/actions/players'
import { addAlumniRecord, bulkAddAlumni }           from '@/app/actions/alumni'
import { createCoachStaff, generateInviteCode }     from '@/app/actions/members'

// ─── Constants ────────────────────────────────────────────────────────────────

const PROGRAM_ROLES = [
  { id: 1, label: 'Athletic Director', roleKey: 'athletic_director', memberType: 'staff'  as const },
  { id: 2, label: 'Program Admin',     roleKey: 'app_admin',         memberType: 'staff'  as const },
  { id: 3, label: 'Alumni Director',   roleKey: 'alumni_director',   memberType: 'staff'  as const },
  { id: 4, label: 'Head Coach',        roleKey: 'head_coach',        memberType: 'staff'  as const },
  { id: 5, label: 'Coach',             roleKey: 'position_coach',    memberType: 'staff'  as const },
  { id: 6, label: 'Support Staff',     roleKey: 'support_staff',     memberType: 'staff'  as const },
  { id: 7, label: 'Alumni',            roleKey: 'alumni',            memberType: 'alumni' as const },
  { id: 8, label: 'Player',            roleKey: 'player',            memberType: 'player' as const },
] as const

type MemberType   = 'player' | 'alumni' | 'staff'
type WizardAction = 'create' | 'bulk' | 'invite'
type WizardStep   = 'select' | 'action' | 'configure' | 'result'

interface WizardResult {
  success:    boolean
  message:    string
  inviteUrl?: string
  count?:     number
  errors?:    string
}

interface SportOption {
  id:   number
  name: string
  abbr: string
}

interface PositionOption {
  positionId:   number
  positionName: string
}

export interface AddMembersWizardProps {
  isOpen:               boolean
  onClose:              () => void
  teamId:               number
  teamName:             string
  replyToEmail?:        string
  academicYears:        string[]
  userId:               number
  appDb:                string
  creatorProgramRoleId: number
  sports:               SportOption[]
}

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

// ─── Action tile ─────────────────────────────────────────────────────────────

function ActionTile({
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
        border:       selected
          ? '2px solid var(--color-primary)'
          : '2px solid var(--color-gray-200)',
        borderRadius: 12,
        padding:      '16px 20px',
        background:   selected ? 'var(--color-primary-light)' : '#fff',
        cursor:       'pointer',
        textAlign:    'left',
        transition:   'border-color 0.15s, background 0.15s',
        width:        '100%',
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

// ─── CSV utilities ────────────────────────────────────────────────────────────

const CSV_TEMPLATES: Record<MemberType, { headers: string[]; example: string[] }> = {
  staff: {
    headers: ['email', 'firstName', 'lastName'],
    example: ['coach@example.com', 'Mike', 'Jones'],
  },
  alumni: {
    headers: ['email', 'firstName', 'lastName', 'position', 'graduationYear', 'city', 'state'],
    example: ['jane@example.com', 'Jane', 'Doe', 'Midfielder', '2019', 'Tampa', 'FL'],
  },
  player: {
    headers: ['email', 'firstName', 'lastName', 'position', 'academicYear', 'recruitingClass'],
    example: ['john@example.com', 'John', 'Smith', 'Forward', 'Junior', '2022'],
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

function parseCSV(text: string): Record<string, string>[] {
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
  teamId, teamName, replyToEmail, academicYears, userId, appDb,
  creatorProgramRoleId,
  sports,
}: AddMembersWizardProps) {
  const showSportPicker = sports.length > 1

  const [step,           setStep]           = useState<WizardStep>('select')
  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null)
  const [action,         setAction]         = useState<WizardAction | null>(null)
  const [result,         setResult]         = useState<WizardResult | null>(null)
  const [isPending,      startTransition]   = useTransition()

  // ── Form state ────────────────────────────────────────────────────────────
  const [email,           setEmail]           = useState('')
  const [firstName,       setFirstName]       = useState('')
  const [lastName,        setLastName]        = useState('')
  const [positionId,      setPositionId]      = useState<number | null>(null)
  const [academicYear,    setAcademicYear]    = useState('')
  const [recruitingClass, setRecruitingClass] = useState('')
  const [graduationYear,  setGraduationYear]  = useState('')
  const [selSportId,      setSelSportId]      = useState<number | null>(() => sports[0]?.id ?? null)
  const [formError,       setFormError]       = useState('')

  // ── Sync selSportId when sports prop loads (async) ───────────────────────
  useEffect(() => {
    if (selSportId === null && sports.length > 0) {
      setSelSportId(sports[0].id)
    }
  }, [sports]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Positions (fetched per sport) ─────────────────────────────────────────
  const [sportPositions,     setSportPositions]     = useState<PositionOption[]>([])
  const [positionsLoading,   setPositionsLoading]   = useState(false)

  useEffect(() => {
    if (!selSportId) { setSportPositions([]); return }
    setPositionsLoading(true)
    setPositionId(null)
    fetch(`/api/sports/${selSportId}/positions`, { credentials: 'include' })
      .then(r => r.json())
      .then(res => {
        if (res.success) setSportPositions(res.data ?? [])
      })
      .catch(() => {})
      .finally(() => setPositionsLoading(false))
  }, [selSportId])

  // ── Bulk upload state ─────────────────────────────────────────────────────
  const [csvRows,    setCsvRows]    = useState<Record<string, string>[]>([])
  const [csvFileName, setCsvFileName] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Invite state ──────────────────────────────────────────────────────────
  const [inviteExpiry,  setInviteExpiry]  = useState('')
  const [inviteMaxUses, setInviteMaxUses] = useState('')
  const [urlCopied,     setUrlCopied]     = useState(false)

  // ── Derived ───────────────────────────────────────────────────────────────
  const selectedRole   = PROGRAM_ROLES.find(r => r.id === selectedRoleId) ?? null
  const memberType: MemberType | null = selectedRole?.memberType ?? null
  const assignableRoles = PROGRAM_ROLES.filter(r => r.id >= creatorProgramRoleId)
  const isAlumniCreator = creatorProgramRoleId === 7
  const isPlayerCreator = creatorProgramRoleId === 8

  // ── Helpers ───────────────────────────────────────────────────────────────
  function resetWizard() {
    setStep('select'); setSelectedRoleId(null); setAction(null); setResult(null)
    setEmail(''); setFirstName(''); setLastName(''); setPositionId(null)
    setAcademicYear(''); setRecruitingClass(''); setGraduationYear('')
    setSelSportId(sports[0]?.id ?? null); setFormError('')
    setCsvRows([]); setCsvFileName('')
    setInviteExpiry(''); setInviteMaxUses(''); setUrlCopied(false)
  }

  function handleClose() { resetWizard(); onClose() }

  function goBack() {
    if (step === 'action')    { setStep('select'); setAction(null) }
    if (step === 'configure') { setStep('action'); setFormError('') }
    if (step === 'result')    { resetWizard() }
  }

  function selectAction(a: WizardAction) { setAction(a); setStep('configure') }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setCsvFileName(file.name)
    const reader = new FileReader()
    reader.onload = ev => setCsvRows(parseCSV(ev.target?.result as string))
    reader.readAsText(file)
  }

  // ── Submit ────────────────────────────────────────────────────────────────
  function handleSubmit() {
    setFormError('')
    if (action === 'create' && (!email || !firstName || !lastName)) {
      setFormError('Email, first name, and last name are required.')
      return
    }
    startTransition(async () => {
      if (action === 'create')       await submitCreate()
      else if (action === 'bulk')    await submitBulk()
      else if (action === 'invite')  await submitInvite()
    })
  }

  async function submitCreate() {
    if (!selectedRole) return

    if (memberType === 'player') {
      const res = await addPlayerToRoster({
        appDb, email, firstName, lastName,
        globalTeamId:  teamId, teamName, replyToEmail,
        programRoleId: 8,
        sportId:       selSportId,
        positionId,
        classYear:     recruitingClass ? parseInt(recruitingClass) : null,
        adminUserId:   userId,
      })
      if (res.success) {
        setResult({ success: true, message: `${firstName} ${lastName} added to the roster.` })
        setStep('result')
      } else {
        setFormError(res.error ?? 'Failed to create player.')
      }

    } else if (memberType === 'alumni') {
      const res = await addAlumniRecord({
        appDb, email, firstName, lastName,
        globalTeamId:  teamId, teamName, replyToEmail,
        programRoleId: 7,
        sportId:       selSportId,
        positionId,
        classYear:     graduationYear ? parseInt(graduationYear) : null,
        adminUserId:   userId,
      })
      if (res.success) {
        setResult({ success: true, message: `${firstName} ${lastName} added to alumni.` })
        setStep('result')
      } else {
        setFormError(res.error ?? 'Failed to create alumni record.')
      }

    } else if (memberType === 'staff') {
      const res = await createCoachStaff({
        email, firstName, lastName, teamId, teamName,
        role:    selectedRole.roleKey as Parameters<typeof createCoachStaff>[0]['role'],
        sportId: selSportId,
      })
      if (res.success) {
        setResult({ success: true, message: `${firstName} ${lastName} added as ${selectedRole.label}.` })
        setStep('result')
      } else {
        setFormError(res.error ?? 'Failed to create staff member.')
      }
    }
  }

  async function submitBulk() {
    if (csvRows.length === 0) { setFormError('Please upload a CSV file with at least one row.'); return }
    if (!selectedRole) return

    // Resolve position names → IDs from the currently-loaded sportPositions
    function resolvePositionId(name: string): number | null {
      if (!name) return null
      const match = sportPositions.find(
        p => p.positionName.toLowerCase() === name.toLowerCase()
      )
      return match?.positionId ?? null
    }

    if (memberType === 'player') {
      const players = csvRows.map(r => ({
        email:      r.email,
        firstName:  r.firstName  || r.first_name  || '',
        lastName:   r.lastName   || r.last_name   || '',
        positionId: resolvePositionId(r.position ?? ''),
        classYear:  parseInt(r.recruitingClass || r.recruiting_class || '') || null,
      }))
      const res = await bulkAddPlayersToRoster({
        appDb, players,
        globalTeamId:  teamId, teamName, replyToEmail,
        programRoleId: 8,
        sportId:       selSportId,
        adminUserId:   userId,
      })
      setResult({
        success: res.successCount > 0,
        message: `${res.successCount} player(s) added.`,
        count:   res.successCount,
        errors:  res.skippedCount > 0 ? `${res.skippedCount} row(s) skipped.` : undefined,
      })
      setStep('result')

    } else if (memberType === 'alumni') {
      const alumni = csvRows.map(r => ({
        email:      r.email,
        firstName:  r.firstName  || r.first_name  || '',
        lastName:   r.lastName   || r.last_name   || '',
        positionId: resolvePositionId(r.position ?? ''),
        classYear:  r.graduationYear ? parseInt(r.graduationYear) : null,
      }))
      const res = await bulkAddAlumni({
        appDb, alumni,
        globalTeamId:  teamId, teamName, replyToEmail,
        programRoleId: 7,
        sportId:       selSportId,
        adminUserId:   userId,
      })
      setResult({
        success: res.successCount > 0,
        message: `${res.successCount} alumni added.`,
        count:   res.successCount,
        errors:  res.skippedCount > 0 ? `${res.skippedCount} row(s) skipped.` : undefined,
      })
      setStep('result')

    } else if (memberType === 'staff') {
      let success = 0, failed = 0
      for (const r of csvRows) {
        const res = await createCoachStaff({
          email:     r.email,
          firstName: r.firstName || r.first_name || '',
          lastName:  r.lastName  || r.last_name  || '',
          teamId,
          role:    selectedRole.roleKey as Parameters<typeof createCoachStaff>[0]['role'],
          sportId: selSportId,
        })
        if (res.success) success++; else failed++
      }
      setResult({
        success: success > 0,
        message: `${success} member(s) added as ${selectedRole.label}.`,
        count:   success,
        errors:  failed > 0 ? `${failed} row(s) failed.` : undefined,
      })
      setStep('result')
    }
  }

  async function submitInvite(overrideRoleKey?: string) {
    const role = overrideRoleKey ?? selectedRole?.roleKey
    if (!role) return
    const res = await generateInviteCode({
      teamId,
      role,
      sportId:   selSportId,
      expiresAt: inviteExpiry  ? new Date(inviteExpiry)      : null,
      maxUses:   inviteMaxUses ? parseInt(inviteMaxUses) : null,
    })
    if (res.success && res.inviteUrl) {
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

  // ── Sport selector (reused in multiple places) ────────────────────────────
  function SportPicker() {
    if (!showSportPicker) return null
    return (
      <Field label="Sport">
        <select
          value={selSportId ?? ''}
          onChange={e => setSelSportId(parseInt(e.target.value, 10) || null)}
          style={{ ...inputStyle, appearance: 'auto' }}
        >
          {sports.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </Field>
    )
  }

  // ── Position selector (sport-aware) ──────────────────────────────────────
  function PositionPicker() {
    return (
      <Field label="Position">
        <select
          value={positionId ?? ''}
          onChange={e => setPositionId(parseInt(e.target.value, 10) || null)}
          style={{ ...inputStyle, appearance: 'auto' }}
          disabled={positionsLoading || sportPositions.length === 0}
        >
          <option value="">
            {positionsLoading ? 'Loading…' : sportPositions.length === 0 ? 'No positions defined' : 'Select…'}
          </option>
          {sportPositions.map(p => (
            <option key={p.positionId} value={p.positionId}>{p.positionName}</option>
          ))}
        </select>
      </Field>
    )
  }

  // ── Step titles ───────────────────────────────────────────────────────────
  const stepTitle: Record<WizardStep, string> = {
    select:    'Add Member',
    action:    `Add ${selectedRole?.label ?? 'Member'}`,
    configure: action === 'invite' ? 'Generate Invite Link'
             : action === 'bulk'   ? 'Bulk Upload'
             : `Add ${selectedRole?.label ?? 'Member'}`,
    result: 'Done',
  }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <Modal title={stepTitle[step]} onClose={handleClose} isOpen={isOpen} size="md">

      {/* Progress breadcrumb */}
      {step !== 'result' && !isAlumniCreator && !isPlayerCreator && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 24, alignItems: 'center' }}>
          {(['select', 'action', 'configure'] as WizardStep[]).map((s, i) => (
            <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{
                width: 22, height: 22, borderRadius: '50%', fontSize: 11, fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                backgroundColor: step === s
                  ? 'var(--color-primary)'
                  : (['select', 'action', 'configure'] as WizardStep[]).indexOf(step) > i
                    ? 'var(--color-primary-light)'
                    : 'var(--color-gray-100)',
                color: step === s ? '#fff'
                  : (['select', 'action', 'configure'] as WizardStep[]).indexOf(step) > i
                    ? 'var(--color-primary)'
                    : 'var(--color-gray-400)',
              }}>
                {(['select', 'action', 'configure'] as WizardStep[]).indexOf(step) > i ? '✓' : i + 1}
              </div>
              {i < 2 && <div style={{ width: 24, height: 1, backgroundColor: 'var(--color-gray-200)' }} />}
            </div>
          ))}
        </div>
      )}

      {/* ── Player: blocked ── */}
      {isPlayerCreator && (
        <div style={{ textAlign: 'center', padding: '24px 0' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🔒</div>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-gray-900)', margin: '0 0 8px' }}>
            Not Authorized
          </h3>
          <p style={{ fontSize: 14, color: 'var(--color-gray-600)', margin: 0 }}>
            Players cannot add members. Contact your program admin for assistance.
          </p>
          <div style={{ marginTop: 20 }}>
            <Button label="Close" onClick={handleClose} />
          </div>
        </div>
      )}

      {/* ── Alumni creator: invite-only ── */}
      {isAlumniCreator && step !== 'result' && (
        <div style={sectionStyle}>
          <div style={{ backgroundColor: 'var(--color-primary-light)', border: '1px solid var(--color-primary)', borderRadius: 8, padding: '12px 16px' }}>
            <p style={{ fontSize: 13, color: 'var(--color-primary)', margin: 0, fontWeight: 600 }}>
              Alumni Invite Link
            </p>
            <p style={{ fontSize: 12, color: 'var(--color-gray-600)', margin: '4px 0 0' }}>
              Share this link with fellow alumni. Requests require admin approval.
            </p>
          </div>

          {formError && (
            <div style={{ padding: '10px 14px', borderRadius: 8, fontSize: 13, backgroundColor: 'var(--color-danger-light)', color: 'var(--color-danger)' }}>
              {formError}
            </div>
          )}

          <SportPicker />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Expiry Date (optional)">
              <TextInput value={inviteExpiry} onChange={setInviteExpiry} type="date" />
            </Field>
            <Field label="Max Uses (optional)">
              <TextInput value={inviteMaxUses} onChange={setInviteMaxUses} placeholder="Unlimited" type="number" />
            </Field>
          </div>

          <Button
            label={isPending ? 'Generating…' : 'Generate Invite Link'}
            loading={isPending}
            onClick={() => {
              setFormError('')
              startTransition(() => submitInvite('alumni'))
            }}
          />
        </div>
      )}

      {/* ── Staff flow ── */}
      {!isAlumniCreator && !isPlayerCreator && (
        <>
          {/* Step 1: Select role */}
          {step === 'select' && (
            <div style={sectionStyle}>
              <Field label="Role" required>
                <select
                  value={selectedRoleId ?? ''}
                  onChange={e => setSelectedRoleId(parseInt(e.target.value, 10) || null)}
                  style={{ ...inputStyle, appearance: 'auto' }}
                >
                  <option value="">Select a role…</option>
                  {assignableRoles.map(r => (
                    <option key={r.id} value={r.id}>{r.label}</option>
                  ))}
                </select>
              </Field>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
                <Button label="Continue" disabled={!selectedRoleId} onClick={() => selectedRoleId && setStep('action')} />
              </div>
            </div>
          )}

          {/* Step 2: Action */}
          {step === 'action' && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 24 }}>
                <ActionTile icon="✏️" title="Create"      description="Add one member"    selected={action === 'create'} onClick={() => selectAction('create')} />
                <ActionTile icon="📄" title="Bulk Upload" description="CSV file import"   selected={action === 'bulk'}   onClick={() => selectAction('bulk')} />
                <ActionTile icon="🔗" title="Invite Link" description="Share a signup link" selected={action === 'invite'} onClick={() => selectAction('invite')} />
              </div>
              <Button label="← Back" variant="ghost" size="sm" onClick={goBack} />
            </>
          )}

          {/* Step 3: Configure */}
          {step === 'configure' && (
            <>
              {/* CREATE SINGLE */}
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
                    <TextInput value={email} onChange={setEmail} placeholder="member@example.com" type="email" />
                  </Field>

                  {memberType === 'player' && (
                    <>
                      {showSportPicker && <SportPicker />}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <PositionPicker />
                        <Field label="Academic Year">
                          <select value={academicYear} onChange={e => setAcademicYear(e.target.value)} style={{ ...inputStyle, appearance: 'auto' }}>
                            <option value="">Select…</option>
                            {academicYears.map(y => <option key={y} value={y}>{y}</option>)}
                          </select>
                        </Field>
                      </div>
                      <Field label="Recruiting Class (year)">
                        <TextInput value={recruitingClass} onChange={setRecruitingClass} placeholder={String(new Date().getFullYear())} type="number" />
                      </Field>
                    </>
                  )}

                  {memberType === 'alumni' && (
                    <>
                      {showSportPicker && <SportPicker />}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <PositionPicker />
                        <Field label="Graduation Year">
                          <TextInput value={graduationYear} onChange={setGraduationYear} placeholder="2019" type="number" />
                        </Field>
                      </div>
                    </>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
                    <Button label="← Back" variant="ghost" size="sm" onClick={goBack} />
                    <Button label={isPending ? 'Adding…' : 'Add Member'} loading={isPending} onClick={handleSubmit} />
                  </div>
                </div>
              )}

              {/* BULK UPLOAD */}
              {action === 'bulk' && (
                <div style={sectionStyle}>
                  {formError && (
                    <div style={{ padding: '10px 14px', borderRadius: 8, fontSize: 13, backgroundColor: 'var(--color-danger-light)', color: 'var(--color-danger)' }}>
                      {formError}
                    </div>
                  )}

                  {memberType !== 'staff' && showSportPicker && <SportPicker />}

                  {memberType !== 'staff' && sportPositions.length > 0 && (
                    <p style={{ fontSize: 12, color: 'var(--color-gray-500)', margin: 0 }}>
                      Valid positions for CSV: {sportPositions.map(p => p.positionName).join(', ')}
                    </p>
                  )}

                  <div style={{ backgroundColor: 'var(--color-gray-50)', border: '1px solid var(--color-gray-200)', borderRadius: 8, padding: '12px 16px' }}>
                    <p style={{ fontSize: 13, color: 'var(--color-gray-600)', margin: '0 0 8px' }}>
                      Download the CSV template, fill it in, then upload below.
                    </p>
                    <Button label="Download Template" variant="outline" size="sm" onClick={() => downloadTemplate(memberType!)} />
                  </div>

                  <div>
                    <input ref={fileInputRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={handleFileChange} />
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      style={{ border: '2px dashed var(--color-gray-300)', borderRadius: 10, padding: '28px 20px', textAlign: 'center', cursor: 'pointer', backgroundColor: 'var(--color-gray-50)' }}
                    >
                      {csvFileName ? (
                        <>
                          <div style={{ fontSize: 20, marginBottom: 6 }}>📄</div>
                          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-gray-800)' }}>{csvFileName}</div>
                          <div style={{ fontSize: 12, color: 'var(--color-gray-500)', marginTop: 4 }}>{csvRows.length} row(s) ready · Click to change</div>
                        </>
                      ) : (
                        <>
                          <div style={{ fontSize: 24, marginBottom: 6 }}>⬆️</div>
                          <div style={{ fontSize: 14, color: 'var(--color-gray-600)' }}>Click to upload CSV</div>
                        </>
                      )}
                    </div>
                  </div>

                  {csvRows.length > 0 && (
                    <div style={{ fontSize: 12, color: 'var(--color-gray-500)' }}>
                      Previewing first 3 of {csvRows.length} rows:
                      <div style={{ fontFamily: 'monospace', backgroundColor: 'var(--color-gray-50)', border: '1px solid var(--color-gray-200)', borderRadius: 6, padding: '8px 10px', marginTop: 6, overflowX: 'auto' }}>
                        {csvRows.slice(0, 3).map((r, i) => <div key={i}>{JSON.stringify(r)}</div>)}
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
                    <Button label="← Back" variant="ghost" size="sm" onClick={goBack} />
                    <Button label={isPending ? 'Uploading…' : `Upload ${csvRows.length || ''} Records`} loading={isPending} disabled={csvRows.length === 0} onClick={handleSubmit} />
                  </div>
                </div>
              )}

              {/* INVITE LINK */}
              {action === 'invite' && (
                <div style={sectionStyle}>
                  {formError && (
                    <div style={{ padding: '10px 14px', borderRadius: 8, fontSize: 13, backgroundColor: 'var(--color-danger-light)', color: 'var(--color-danger)' }}>
                      {formError}
                    </div>
                  )}

                  <div style={{ backgroundColor: 'var(--color-primary-light)', border: '1px solid var(--color-primary)', borderRadius: 8, padding: '12px 16px' }}>
                    <p style={{ fontSize: 13, color: 'var(--color-primary)', margin: 0, fontWeight: 600 }}>
                      {teamName} · {selectedRole?.label}
                    </p>
                    <p style={{ fontSize: 12, color: 'var(--color-gray-600)', margin: '4px 0 0' }}>
                      Anyone with this link can request access. Requests require admin approval.
                    </p>
                  </div>

                  {/* Sport scope for player/alumni invite links */}
                  {selectedRole && selectedRole.memberType !== 'staff' && showSportPicker && (
                    <SportPicker />
                  )}

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
        </>
      )}

      {/* ── Result (all paths) ── */}
      {step === 'result' && result && (
        <div style={{ textAlign: 'center', padding: '8px 0' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>{result.success ? '✅' : '❌'}</div>
          <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-gray-900)', margin: '0 0 8px' }}>
            {result.success ? 'Success!' : 'Something went wrong'}
          </h3>
          <p style={{ fontSize: 14, color: 'var(--color-gray-600)', margin: '0 0 16px' }}>{result.message}</p>

          {result.errors && (
            <p style={{ fontSize: 13, color: 'var(--color-warning)', marginBottom: 16 }}>{result.errors}</p>
          )}

          {result.inviteUrl && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ backgroundColor: 'var(--color-gray-50)', border: '1px solid var(--color-gray-200)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: 'var(--color-gray-700)', wordBreak: 'break-all', textAlign: 'left', marginBottom: 10 }}>
                {result.inviteUrl}
              </div>
              <Button label={urlCopied ? 'Copied!' : 'Copy Invite Link'} variant={urlCopied ? 'secondary' : 'primary'} onClick={() => copyUrl(result.inviteUrl!)} fullWidth />
              <p style={{ fontSize: 12, color: 'var(--color-gray-500)', marginTop: 8 }}>
                Share this link with the member. They will be prompted to request access, which requires admin approval.
              </p>
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 8 }}>
            {!isAlumniCreator && <Button label="Add Another" variant="outline" onClick={resetWizard} />}
            <Button label="Done" onClick={handleClose} />
          </div>
        </div>
      )}

    </Modal>
  )
}

export default AddMembersWizard
