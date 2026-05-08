'use server'

// ─── Member Management Server Actions ────────────────────────────────────────
//
// Handles member types that don't fit cleanly into players.ts / alumni.ts:
//
//   createCoachStaff:
//     Global DB only → sp_CreateTeamMember
//     Coaches don't have an App DB player/alumni record — they just need
//     a user account + team role + app_permissions (roster + alumni).
//
//   generateInviteCode:
//     Global DB → sp_CreateInviteCode
//     Thin server action wrapper so the wizard (client component) can call
//     it directly without going through the /api/invite/codes route handler.

import { randomUUID } from 'crypto'
import { getServerSession } from '@/lib/auth'
import { sp_CreateTeamMember, sp_CreateInviteCode, sp_AddUserRole } from '@/lib/db/procedures'
import { appDbContext } from '@/lib/db/connection'
import { sendTransactionalEmail, buildInviteEmailHtml, buildTeamAddedEmailHtml } from '@/lib/resend'

// Maps roleKey → program_role_id (mirrors dbo.program_role)
const ROLE_TO_PROGRAM_ROLE_ID: Record<string, number> = {
  athletic_director: 1,
  app_admin:         2,
  alumni_director:   3,
  head_coach:        4,
  position_coach:    5,
  support_staff:     6,
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CreateCoachStaffInput {
  email:     string
  firstName: string
  lastName:  string
  teamId:    number
  teamName?: string   // for invite email
  role:      'athletic_director' | 'app_admin' | 'alumni_director' | 'head_coach' | 'position_coach' | 'support_staff'
  sportId?:  number | null   // required to write a users_sports row in AppDB
}

export interface GenerateInviteCodeInput {
  teamId:    number
  role:      string          // 'player' | 'alumni' | 'head_coach' | 'position_coach' | 'alumni_director'
  sportId?:  number | null   // scopes player/alumni invite to a specific sport
  expiresAt?: Date | null
  maxUses?:   number | null
}

export interface ResendInviteInput {
  email:     string
  firstName: string
  teamId:    number
  teamName?: string
  role:      string
}

// ─── Actions ─────────────────────────────────────────────────────────────────

/**
 * Creates a coach/staff member account with immediate team access.
 * Unlike players/alumni, coaches have no App DB record — only Global DB.
 */
export async function createCoachStaff(
  input: CreateCoachStaffInput,
): Promise<{ success: boolean; userId?: number; error?: string }> {
  try {
    const session = await getServerSession()
    if (!session) return { success: false, error: 'Unauthorized' }

    const { userId, errorCode } = await sp_CreateTeamMember({
      email:     input.email,
      firstName: input.firstName,
      lastName:  input.lastName,
      teamId:    input.teamId,
      role:      input.role,
      createdBy: session.userId,
    })

    if (errorCode) {
      const messages: Record<string, string> = {
        TEAM_NOT_FOUND: 'Team not found.',
      }
      return { success: false, error: messages[errorCode] ?? errorCode }
    }

    // Write to AppDB so the staff member appears in users_sports (program_role_id 1-6)
    const programRoleId = ROLE_TO_PROGRAM_ROLE_ID[input.role]
    const appDb = (session as unknown as Record<string, unknown>).appDb as string | undefined
    if (userId && programRoleId && input.sportId && appDb) {
      try {
        await appDbContext.run(appDb, async () => {
          await sp_AddUserRole({
            userId:        userId!,
            programRoleId,
            sportId:       input.sportId ?? null,
            adminUserId:   session.userId,
          })
        })
      } catch (appErr) {
        console.warn('[createCoachStaff] AppDB sp_AddUserRole failed:', appErr)
      }
    }

    // Send invite email (fire-and-forget)
    void (async () => {
      try {
        const token = randomUUID()
        const { inviteCodeId, errorCode: codeErr } = await sp_CreateInviteCode({
          teamId:    input.teamId,
          role:      input.role,
          token,
          createdBy: session.userId,
          expiresAt: null,
          maxUses:   1,
        })
        if (codeErr || !inviteCodeId) {
          console.warn('[createCoachStaff] sp_CreateInviteCode error:', codeErr)
          return
        }
        const baseUrl   = process.env.NEXT_PUBLIC_APP_URL ?? ''
        const inviteUrl = `${baseUrl}/join?code=${token}`
        await sendTransactionalEmail(
          input.email,
          `You've been added to ${input.teamName ?? 'your program'} — LegacyLink`,
          buildInviteEmailHtml({
            firstName: input.firstName,
            teamName:  input.teamName ?? 'your program',
            inviteUrl,
            role:      input.role,
          }),
        )
      } catch (err) {
        console.error('[createCoachStaff] invite send failed:', err)
      }
    })()

    return { success: true, userId: userId ?? undefined }
  } catch (err) {
    console.error('[createCoachStaff]', err)
    return { success: false, error: 'INTERNAL_ERROR' }
  }
}

/**
 * Generates a scoped invite code and returns the shareable URL.
 * Called from the Add Members wizard (client component).
 */
export async function generateInviteCode(
  input: GenerateInviteCodeInput,
): Promise<{ success: boolean; inviteUrl?: string; token?: string; error?: string }> {
  try {
    const session = await getServerSession()
    if (!session) return { success: false, error: 'Unauthorized' }

    const token = randomUUID()

    const { inviteCodeId, errorCode } = await sp_CreateInviteCode({
      teamId:    input.teamId,
      role:      input.role,
      sportId:   input.sportId  ?? null,
      token,
      createdBy: session.userId,
      expiresAt: input.expiresAt ?? null,
      maxUses:   input.maxUses   ?? null,
    })

    if (errorCode || !inviteCodeId) {
      const messages: Record<string, string> = {
        TEAM_NOT_FOUND: 'Team not found.',
        FORBIDDEN:      'You do not have access to this team.',
      }
      return { success: false, error: messages[errorCode ?? ''] ?? (errorCode ?? 'Failed to generate code') }
    }

    const baseUrl   = process.env.NEXT_PUBLIC_APP_URL ?? ''
    const inviteUrl = `${baseUrl}/join?code=${token}`

    return { success: true, inviteUrl, token }
  } catch (err) {
    console.error('[generateInviteCode]', err)
    return { success: false, error: 'INTERNAL_ERROR' }
  }
}

/**
 * Resends an invite email to an existing member who hasn't claimed their account.
 * Generates a fresh single-use invite code and sends a new invite email.
 */
export async function resendInvite(
  input: ResendInviteInput,
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getServerSession()
    if (!session) return { success: false, error: 'Unauthorized' }

    const token = randomUUID()

    const { inviteCodeId, errorCode } = await sp_CreateInviteCode({
      teamId:    input.teamId,
      role:      input.role,
      token,
      createdBy: session.userId,
      expiresAt: null,
      maxUses:   1,
    })

    if (errorCode || !inviteCodeId) {
      const messages: Record<string, string> = {
        TEAM_NOT_FOUND: 'Team not found.',
        FORBIDDEN:      'You do not have access to this team.',
      }
      return { success: false, error: messages[errorCode ?? ''] ?? (errorCode ?? 'Failed to generate code') }
    }

    const baseUrl   = process.env.NEXT_PUBLIC_APP_URL ?? ''
    const inviteUrl = `${baseUrl}/join?code=${token}`

    await sendTransactionalEmail(
      input.email,
      `Your invite to ${input.teamName ?? 'your program'} — LegacyLink`,
      buildInviteEmailHtml({
        firstName: input.firstName,
        teamName:  input.teamName ?? 'your program',
        inviteUrl,
        role:      input.role,
      }),
    )

    return { success: true }
  } catch (err) {
    console.error('[resendInvite]', err)
    return { success: false, error: 'INTERNAL_ERROR' }
  }
}

export interface NotifyTeamAddedInput {
  email:     string
  firstName: string
  teamName?: string
}

/**
 * Sends a "you've been added to [team]" notification to an existing user.
 * No invite code — the user already has an account and just needs to log in.
 */
export async function notifyTeamAdded(
  input: NotifyTeamAddedInput,
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getServerSession()
    if (!session) return { success: false, error: 'Unauthorized' }

    const baseUrl  = process.env.NEXT_PUBLIC_APP_URL ?? ''
    const loginUrl = `${baseUrl}/login`

    await sendTransactionalEmail(
      input.email,
      `You've been added to ${input.teamName ?? 'your program'} — LegacyLink`,
      buildTeamAddedEmailHtml({
        firstName: input.firstName,
        teamName:  input.teamName ?? 'your program',
        loginUrl,
      }),
    )

    return { success: true }
  } catch (err) {
    console.error('[notifyTeamAdded]', err)
    return { success: false, error: 'INTERNAL_ERROR' }
  }
}

