import React from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ProtectedRoute } from './components/ProtectedRoute'

import Home from './pages/Home'

import StudentSignup from './pages/student/StudentSignup'
import StudentLogin from './pages/student/StudentLogin'
import StudentDashboard from './pages/student/StudentDashboard'
import StudentForgotPassword from './pages/student/StudentForgotPassword'
import StudentSettings from './pages/student/StudentSettings'

import EducatorSignup from './pages/educator/EducatorSignup'
import EducatorLogin from './pages/educator/EducatorLogin'
import EducatorDashboard from './pages/educator/EducatorDashboard'
import EducatorForgotPassword from './pages/educator/EducatorForgotPassword'
import EducatorSettings from './pages/educator/EducatorSettings'

import AdminLogin from './pages/admin/AdminLogin'
import AdminDashboard from './pages/admin/AdminDashboard'

export default function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Home />} />
          
          <Route path="/student/signup" element={<StudentSignup />} />
          <Route path="/student/login" element={<StudentLogin />} />
          <Route path="/student/forgot-password" element={<StudentForgotPassword />} />
          <Route 
            path="/student/dashboard" 
            element={
              <ProtectedRoute allowedRoles={['student']}>
                <StudentDashboard />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/student/settings" 
            element={
              <ProtectedRoute allowedRoles={['student']}>
                <StudentSettings />
              </ProtectedRoute>
            } 
          />

          <Route path="/educator/signup" element={<EducatorSignup />} />
          <Route path="/educator/login" element={<EducatorLogin />} />
          <Route path="/educator/forgot-password" element={<EducatorForgotPassword />} />
          <Route 
            path="/educator/dashboard" 
            element={
              <ProtectedRoute allowedRoles={['educator']}>
                <EducatorDashboard />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/educator/settings" 
            element={
              <ProtectedRoute allowedRoles={['educator']}>
                <EducatorSettings />
              </ProtectedRoute>
            } 
          />

          <Route path="/admin" element={<AdminLogin />} />
          <Route 
            path="/admin/dashboard" 
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminDashboard />
              </ProtectedRoute>
            } 
          />
        </Routes>
      </AuthProvider>
    </Router>
  )
}

