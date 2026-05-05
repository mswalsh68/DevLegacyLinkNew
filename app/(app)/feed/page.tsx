import { redirect } from 'next/navigation'
import { getServerSession } from '@/lib/auth'
import { canAsync } from '@/lib/permissions.server'
import FeedContent from './FeedContent'

export default async function FeedPage() {
  const session = await getServerSession()
  if (!session) redirect('/login')

  const [viewPerm, postPerm, deleteAnyPerm, pinPerm] = await Promise.all([
    canAsync(session, 'feed:view'),
    canAsync(session, 'feed:post'),
    canAsync(session, 'feed:delete_any'),
    canAsync(session, 'feed:pin'),
  ])

  return (
    <FeedContent
      canView={viewPerm.allowed}
      canPost={postPerm.allowed}
      canDeleteAny={deleteAnyPerm.allowed}
      canPin={pinPerm.allowed}
      postScope={postPerm.scope}
    />
  )
}
