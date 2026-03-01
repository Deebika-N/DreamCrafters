import React from 'react'
import { Link } from 'react-router-dom'
import './Home.css'

export default function Home() {
  return (
    <div className="home-container">
      <div className="hero-section">
        <h1 className="hero-title">Welcome to DreamCrafters</h1>
        <p className="hero-subtitle">Empowering Learning</p>
        
        <div className="role-cards">
          <div className="role-card student-card">
            <div className="card-icon">🎓</div>
            <h2>Student</h2>
            <p>Track your activities and earn points</p>
            <div className="card-actions">
              <Link to="/student/signup" className="btn btn-primary">Sign Up</Link>
              <Link to="/student/login" className="btn btn-outline">Login</Link>
            </div>
          </div>

          <div className="role-card educator-card">
            <div className="card-icon">👨‍🏫</div>
            <h2>Educator</h2>
            <p>Manage activities and monitor progress</p>
            <div className="card-actions">
              <Link to="/educator/signup" className="btn btn-primary">Sign Up</Link>
              <Link to="/educator/login" className="btn btn-outline">Login</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
