import React, { useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import api from '../../api'
import '../Auth.css'

export default function StudentSignup() {
  const [step, setStep] = useState(1) // 1: email, 2: OTP, 3: details
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [formData, setFormData] = useState({
    name: '',
    username: '',
    password: '',
    confirmPassword: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleEmailSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setMessage('')

    try {
      const res = await api.post('/student/auth/request-signup', { email })
      setMessage(res.data.message)
      setStep(2)
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const handleOTPSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      await api.post('/student/auth/verify-otp', { email, otp })
      setMessage('OTP verified! Complete your registration')
      setStep(3)
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid OTP')
    } finally {
      setLoading(false)
    }
  }

  const handleDetailsSubmit = async (e) => {
    e.preventDefault()
    
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setLoading(true)
    setError('')

    try {
      const res = await api.post('/student/auth/complete-signup', {
        email,
        otp,
        name: formData.name,
        username: formData.username,
        password: formData.password
      })
      login(res.data.user)
      navigate('/student/dashboard')
    } catch (err) {
      setError(err.response?.data?.error || 'Signup failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <h1>Student Sign Up</h1>
          <p>Step {step} of 3</p>
        </div>

        {step === 1 && (
          <form onSubmit={handleEmailSubmit} className="auth-form">
            <div className="form-group">
              <label>Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                required
              />
            </div>

            {error && <div className="alert alert-error">{error}</div>}
            {message && <div className="alert alert-success">{message}</div>}

            <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
              {loading ? 'Sending...' : 'Send OTP'}
            </button>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={handleOTPSubmit} className="auth-form">
            <div className="form-group">
              <label>Enter OTP</label>
              <input
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder="Enter 6-digit OTP"
                maxLength="6"
                required
              />
              <small>Check your email: {email}</small>
            </div>

            {error && <div className="alert alert-error">{error}</div>}
            {message && <div className="alert alert-success">{message}</div>}

            <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
              {loading ? 'Verifying...' : 'Verify OTP'}
            </button>
            <button type="button" onClick={() => setStep(1)} className="btn btn-outline btn-full">
              Change Email
            </button>
          </form>
        )}

        {step === 3 && (
          <form onSubmit={handleDetailsSubmit} className="auth-form">
            <div className="form-group">
              <label>Full Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                placeholder="Enter your full name"
                required
              />
            </div>

            <div className="form-group">
              <label>Username</label>
              <input
                type="text"
                value={formData.username}
                onChange={(e) => setFormData({...formData, username: e.target.value})}
                placeholder="Choose a username"
                required
              />
            </div>

            <div className="form-group">
              <label>Password</label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({...formData, password: e.target.value})}
                placeholder="Create a password"
                required
              />
            </div>

            <div className="form-group">
              <label>Confirm Password</label>
              <input
                type="password"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})}
                placeholder="Confirm your password"
                required
              />
            </div>

            {error && <div className="alert alert-error">{error}</div>}

            <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
              {loading ? 'Creating Account...' : 'Complete Registration'}
            </button>
          </form>
        )}

        <div className="auth-footer">
          Already have an account? <Link to="/student/login">Login</Link>
        </div>
        <div className="auth-footer">
          <Link to="/" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
            <ArrowLeft size={16} /> Back to Home
          </Link>
        </div>
      </div>
    </div>
  )
}
