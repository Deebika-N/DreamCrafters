import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import './Dashboard.css'

export default function StudentDashboard() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  return (
    <div className="dashboard-container">
      <nav className="dashboard-nav">
        <div className="nav-brand">
          <h2>DreamCrafters</h2>
        </div>
        <div className="nav-actions">
          <span className="user-greeting">Hello, {user?.name}!</span>
          <button onClick={() => navigate('/student/settings')} className="btn btn-secondary">Change Password</button>
          <button onClick={handleLogout} className="btn btn-logout">Logout</button>
        </div>
      </nav>

      <div className="dashboard-content">
        <div className="welcome-section">
          <h1>Welcome to Your Dashboard</h1>
          <p className="role-badge student-badge">Student</p>
        </div>

        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon">🎯</div>
            <h3>Total Points</h3>
            <p className="stat-value">0</p>
          </div>

          <div className="stat-card">
            <div className="stat-icon">📚</div>
            <h3>Activities Completed</h3>
            <p className="stat-value">0</p>
          </div>

          <div className="stat-card">
            <div className="stat-icon">🏆</div>
            <h3>Achievements</h3>
            <p className="stat-value">0</p>
          </div>

          <div className="stat-card">
            <div className="stat-icon">📈</div>
            <h3>Current Rank</h3>
            <p className="stat-value">-</p>
          </div>
        </div>

        <div className="info-section">
          <div className="info-card">
            <h3>📋 Recent Activities</h3>
            <p className="empty-state">No activities yet. Start participating to earn points!</p>
          </div>

          <div className="info-card">
            <h3>👤 Profile Information</h3>
            <div className="profile-info">
              <p><strong>Name:</strong> {user?.name}</p>
              <p><strong>Username:</strong> {user?.username}</p>
              <p><strong>Email:</strong> {user?.email}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
