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
      // Try localStorage first (fast path)
      try {
        const raw = localStorage.getItem('cfb_user')
        if (raw) {
          const parsed = JSON.parse(raw) as UserSession & { globalRole?: string }
          if (parsed.globalRole && !parsed.role) {
            parsed.role = parsed.globalRole as UserSession['role']
          }
          setUser(parsed)
          setIsLoading(false)
          return
        }
      } catch {
        // Corrupt — fall through to server fetch
      }

      // Fallback: localStorage empty but cookie may still be valid
      // (e.g., storage was cleared, new tab, stale session)
      try {
        const res = await fetch('/api/auth/me', { credentials: 'include' })
        if (res.ok) {
          const body = await res.json() as { success: boolean; data?: { user: UserSession } }
          if (body.success && body.data?.user) {
            localStorage.setItem('cfb_user', JSON.stringify(body.data.user))
            setUser(body.data.user)
          }
        }
      } catch {
        // Network error — treat as logged out
      } finally {
        setIsLoading(false)
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
