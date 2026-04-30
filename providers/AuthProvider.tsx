'use client'

// Provides the current user session to all client components.
// Reads the decoded user profile from localStorage (tokens stay in httpOnly cookies).
import { createContext, useContext, useEffect, useState } from 'react'
import type { UserSession } from '@/types'

interface AuthContextValue {
  user: UserSession | null
  isLoading: boolean
  clearSession: () => void
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  isLoading: true,
  clearSession: () => {},
})

export function useAuth() {
  return useContext(AuthContext)
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserSession | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function loadSession() {
      // Fast path: render immediately from localStorage so there's no flash.
      // We still always fetch from the server below to keep the cache in sync
      // with the JWT cookie — stale localStorage is the #1 cause of blank
      // dashboards after deployments or team switches.
      let hasLocalUser = false
      try {
        const raw = localStorage.getItem('cfb_user')
        if (raw) {
          const parsed = JSON.parse(raw) as UserSession & { globalRole?: string }
          if (parsed.globalRole && !parsed.role) {
            parsed.role = parsed.globalRole as UserSession['role']
          }
          setUser(parsed)
          setIsLoading(false)
          hasLocalUser = true
        }
      } catch {
        // Corrupt localStorage — fall through
      }

      // Always sync with the server. The JWT cookie is the source of truth;
      // localStorage is only a render-speed optimisation.
      try {
        const res = await fetch('/api/auth/me', { credentials: 'include' })
        if (res.ok) {
          const body = await res.json() as { success: boolean; data?: { user: UserSession } }
          if (body.success && body.data?.user) {
            const fresh = body.data.user as UserSession & { globalRole?: string }
            if (fresh.globalRole && !fresh.role) {
              fresh.role = fresh.globalRole as UserSession['role']
            }
            localStorage.setItem('cfb_user', JSON.stringify(fresh))
            setUser(fresh)
          }
        } else {
          // Cookie invalid/expired — clear stale cache and treat as logged out
          localStorage.removeItem('cfb_user')
          setUser(null)
        }
      } catch {
        // Network error — keep whatever we got from localStorage
      } finally {
        if (!hasLocalUser) setIsLoading(false)
      }
    }

    loadSession()
  }, [])

  function clearSession() {
    localStorage.removeItem('cfb_user')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, clearSession }}>
      {children}
    </AuthContext.Provider>
  )
}
