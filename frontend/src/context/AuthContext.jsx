/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState } from 'react'
import CurtainCover from '../components/CurtainCover'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(
    () => localStorage.getItem('srg_auth') === 'true'
  )
  const [coveringOut, setCoveringOut] = useState(false)

  const login = () => {
    setIsAuthenticated(true)
    localStorage.setItem('srg_auth', 'true')
  }

  const logout = () => {
    setCoveringOut(true)
  }

  const handleCovered = () => {
    setIsAuthenticated(false)
    localStorage.removeItem('srg_auth')
    sessionStorage.setItem('srg_just_logged_out', 'true')
    setCoveringOut(false)
  }

  return (
    <AuthContext.Provider value={{ isAuthenticated, login, logout }}>
      {children}
      {coveringOut && <CurtainCover onCovered={handleCovered} />}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
