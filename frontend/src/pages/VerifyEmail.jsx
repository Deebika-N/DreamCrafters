import React, { useState, useEffect } from 'react'
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../api'
import './Auth.css'

export default function VerifyEmail() {
  const [searchParams] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()
  const { login } = useAuth()

  const token = searchParams.get('token')
  const typeFromUrl = searchParams.get('type')
  const email = location.state?.email || ''
  const type = typeFromUrl || location.state?.type || 'student'

  const [formData, setFormData] = useState({
    name: '',
    organizationName: '',
    username: '',
    password: '',
    confirmPassword: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (!token) {
      setError('Verification token is missing')
      return
    }

    setLoading(true)
    setError('')

    try {
      const endpoint = type === 'student' 
        ? '/student/auth/complete-signup'
        : '/educator/auth/complete-signup'

      const payload = type === 'student'
        ? { token, name: formData.name, username: formData.username, password: formData.password }
        : { token, organizationName: formData.organizationName, username: formData.username, password: formData.password }

      const res = await api.post(endpoint, payload)
      login(res.data.token, res.data.user)
      navigate(type === 'student' ? '/student/dashboard' : '/educator/dashboard')
    } catch (err) {
      setError(err.response?.data?.error || 'Verification failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <h1>Complete Your Registration</h1>
          <p>Email: {email}</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {type === 'student' ? (
            <div className="form-group">
              <label>Full Name</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="Enter your full name"
                required
              />
            </div>
          ) : (
            <div className="form-group">
              <label>Organization / Institution Name</label>
              <input
                type="text"
                name="organizationName"
                value={formData.organizationName}
                onChange={handleChange}
                placeholder="Enter organization name"
                required
              />
            </div>
          )}

          <div className="form-group">
            <label>Username</label>
            <input
              type="text"
              name="username"
              value={formData.username}
              onChange={handleChange}
              placeholder="Choose a username"
              required
            />
          </div>

          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="Create a password"
              required
            />
          </div>

          <div className="form-group">
            <label>Confirm Password</label>
            <input
              type="password"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              placeholder="Confirm your password"
              required
            />
          </div>

          {error && <div className="alert alert-error">{error}</div>}

          <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
            {loading ? 'Creating Account...' : 'Complete Registration'}
          </button>
        </form>
      </div>
    </div>
  )
}
