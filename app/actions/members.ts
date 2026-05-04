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
import { sp_CreateTeamMember, sp_CreateInviteCode } from '@/lib/db/procedures'
import { sendTransactionalEmail, buildInviteEmailHtml } from '@/lib/resend'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CreateCoachStaffInput {
  email:     string
  firstName: string
  lastName:  string
  teamId:    number
  teamName?: string   // for invite email
  role:      'app_admin' | 'head_coach' | 'position_coach' | 'alumni_director'
}

export interface GenerateInviteCodeInput {
  teamId:    number
  role:      string          // 'player' | 'alumni' | 'head_coach' | 'position_coach' | 'alumni_director'
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

