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
      if (raw) setUser(JSON.parse(raw) as UserSession)
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
