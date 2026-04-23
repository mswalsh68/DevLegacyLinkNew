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
    try {
      const raw = localStorage.getItem('cfb_user')
      if (raw) {
        const parsed = JSON.parse(raw) as UserSession & { globalRole?: string }
        // Backward-compat: JWTs issued before migration 018 used globalRole instead of role.
        // Safe to remove once all active sessions have been refreshed post-deployment.
        if (parsed.globalRole && !parsed.role) {
          parsed.role = parsed.globalRole as UserSession['role']
        }
        setUser(parsed)
      }
    } catch {
      // Corrupt storage — ignore and treat as logged out
    } finally {
      setIsLoading(false)
    }
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
