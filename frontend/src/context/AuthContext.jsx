import React, { createContext, useContext, useState, useEffect } from 'react'
import api from '../api'

const AuthContext = createContext()

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Try to get user data from localStorage for persistence
    const userData = localStorage.getItem('user')
    
    if (userData) {
      setUser(JSON.parse(userData))
    }
    setLoading(false)
  }, [])

  const login = (userData) => {
    // Store user data in localStorage and state
    localStorage.setItem('user', JSON.stringify(userData))
    setUser(userData)
  }

  const logout = async () => {
    // Call logout endpoint based on user role
    try {
      if (user?.role === 'student') {
        await api.post('/student/auth/logout')
      } else if (user?.role === 'educator') {
        await api.post('/educator/auth/logout')
      } else if (user?.role === 'admin') {
        await api.post('/admin/auth/logout')
      }
    } catch (err) {
      console.error('Logout error:', err)
    }
    
    // Clear local storage and state
    localStorage.removeItem('user')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  )
}
