'use server'

import { sendTransactionalEmail, buildMentorRequestEmailHtml, buildMentorAcceptedEmailHtml, buildMentorDeclinedEmailHtml, buildMentorCancelledEmailHtml } from '@/lib/resend'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://dev-legacy-link-new.vercel.app'

export async function notifyAlumniMentorRequest(params: {
  alumniEmail:     string
  alumniFirstName: string
  playerFirstName: string
  playerLastName:  string
  playerPosition:  string | null
  playerClassYear: number | null
  teamName:        string
  coachName:       string
}): Promise<void> {
  await sendTransactionalEmail(
    params.alumniEmail,
    `You've been selected as a mentor — ${params.teamName}`,
    buildMentorRequestEmailHtml({
      ...params,
      dashboardUrl: `${APP_URL}/mentor`,
    }),
  )
}

export async function notifyPlayerMentorAccepted(params: {
  playerEmail:     string
  playerFirstName: string
  alumniFirstName: string
  alumniLastName:  string
  alumniPosition:  string | null
  alumniClassYear: number | null
  teamName:        string
}): Promise<void> {
  await sendTransactionalEmail(
    params.playerEmail,
    `Your mentor has been assigned — ${params.teamName}`,
    buildMentorAcceptedEmailHtml({
      ...params,
      dashboardUrl: `${APP_URL}/mentor`,
    }),
  )
}

export async function notifyAdminMentorDeclined(params: {
  adminEmail:      string
  adminFirstName:  string
  alumniFirstName: string
  alumniLastName:  string
  playerFirstName: string
  playerLastName:  string
  teamName:        string
}): Promise<void> {
  await sendTransactionalEmail(
    params.adminEmail,
    `Mentor request unavailable — ${params.teamName}`,
    buildMentorDeclinedEmailHtml({
      ...params,
      dashboardUrl: `${APP_URL}/mentor`,
    }),
  )
}

export async function notifyAlumniMentorCancelled(params: {
  alumniEmail:     string
  alumniFirstName: string
  playerFirstName: string
  playerLastName:  string
  teamName:        string
}): Promise<void> {
  await sendTransactionalEmail(
    params.alumniEmail,
    `Mentor request withdrawn — ${params.teamName}`,
    buildMentorCancelledEmailHtml(params),
  )
}
