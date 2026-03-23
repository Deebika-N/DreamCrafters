import React from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { 
  LayoutDashboard, 
  Calendar, 
  Library, 
  Target, 
  Video, 
  MessageSquare, 
  Users, 
  Briefcase, 
  Settings, 
  LogOut 
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import GradientText from './reactbits/GradientText'

const navItems = [
  { section: 'Main', items: [
    { path: '/dashboard', icon: <LayoutDashboard size={18} />, label: 'Dashboard' },
    { path: '/study-planner', icon: <Calendar size={18} />, label: 'Study Planner' },
  ]},
  { section: 'Learn', items: [
    { path: '/content', icon: <Library size={18} />, label: 'Content Library' },
    { path: '/careers', icon: <Target size={18} />, label: 'Career Paths' },
    { path: '/webinars', icon: <Video size={18} />, label: 'Webinars' },
  ]},
  { section: 'Connect', items: [
    { path: '/chat', icon: <MessageSquare size={18} />, label: 'AI Chatbot' },
    { path: '/mentors', icon: <Users size={18} />, label: 'Mentors' },
  ]},
  { section: 'Opportunities', items: [
    { path: '/jobs', icon: <Briefcase size={18} />, label: 'Job Board' },
  ]},
]

export default function Sidebar({ isOpen, onClose }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    navigate('/')
  }

  const displayName = user?.name || user?.organizationName || ''
  const initials = displayName
    ? displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : '?'

  return (
    <>
      {isOpen && <div className="sidebar-overlay" onClick={onClose} style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0,0,0,0.5)', zIndex: 99,
        display: 'none'
      }} />}
      <aside className={`sidebar${isOpen ? ' open' : ''}`}>
        <div className="sidebar-brand">
          <h2>
            <GradientText
              colors={['#667eea', '#764ba2', '#f093fb', '#667eea']}
              animationSpeed={4}
            >
              DreamCrafters
            </GradientText>
          </h2>
          <span>Learning Platform</span>
        </div>

        <nav className="sidebar-nav">
          {navItems.map(section => (
            <div key={section.section}>
              <div className="sidebar-section">
                <div className="sidebar-section-title">{section.section}</div>
              </div>
              {section.items.map(item => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
                  onClick={onClose}
                >
                  <span className="icon">{item.icon}</span>
                  {item.label}
                </NavLink>
              ))}
            </div>
          ))}

          <div className="sidebar-section">
            <div className="sidebar-section-title">Account</div>
          </div>
          <NavLink
            to="/settings"
            className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
            onClick={onClose}
          >
            <span className="icon"><Settings size={18} /></span>
            Settings
          </NavLink>
          <button className="sidebar-link" onClick={handleLogout}>
            <span className="icon"><LogOut size={18} /></span>
            Logout
          </button>
        </nav>

        <div className="sidebar-user">
          <div className="sidebar-avatar">{initials}</div>
          <div className="sidebar-user-info">
            <div className="sidebar-user-name">{displayName || 'User'}</div>
            <div className="sidebar-user-role">{user?.role || 'student'}</div>
          </div>
        </div>
      </aside>
    </>
  )
}
