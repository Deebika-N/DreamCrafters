import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../../api';
import '../Auth.css';

function StudentForgotPassword() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Step 1: Request OTP
  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await api.post('/student/auth/request-password-reset', { email });
      if (response.data.success) {
        setStep(2);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify OTP
  const handleOTPSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await api.post('/student/auth/verify-password-reset-otp', {
        email,
        otp
      });
      if (response.data.success) {
        setStep(3);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid or expired OTP');
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Reset password
  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError('');

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    try {
      const response = await api.post('/student/auth/reset-password', {
        email,
        otp,
        newPassword
      });
      if (response.data.success) {
        alert('Password reset successful! Please login with your new password.');
        navigate('/student/login');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h2>Forgot Password - Student</h2>
        
        {error && <div className="error-message">{error}</div>}
        
        {step === 1 && (
          <form onSubmit={handleEmailSubmit} className="auth-form">
            <p className="auth-description">
              Enter your email address and we'll send you an OTP to reset your password.
            </p>
            <div className="form-group">
              <label>Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                placeholder="Enter your email"
              />
            </div>
            <button type="submit" className="auth-button" disabled={loading}>
              {loading ? 'Sending...' : 'Send OTP'}
            </button>
            <div className="auth-links">
              <Link to="/student/login">Back to Login</Link>
            </div>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={handleOTPSubmit} className="auth-form">
            <p className="auth-description">
              Enter the 6-digit OTP sent to <strong>{email}</strong>
            </p>
            <div className="form-group">
              <label>OTP</label>
              <input
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                required
                disabled={loading}
                placeholder="Enter 6-digit OTP"
                maxLength={6}
                pattern="[0-9]{6}"
              />
            </div>
            <button type="submit" className="auth-button" disabled={loading}>
              {loading ? 'Verifying...' : 'Verify OTP'}
            </button>
            <div className="auth-links">
              <button 
                type="button" 
                onClick={() => setStep(1)} 
                className="link-button"
                disabled={loading}
              >
                Back
              </button>
            </div>
          </form>
        )}

        {step === 3 && (
          <form onSubmit={handleResetPassword} className="auth-form">
            <p className="auth-description">
              Create a new password for your account
            </p>
            <div className="form-group">
              <label>New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                disabled={loading}
                placeholder="Enter new password"
                minLength={6}
              />
            </div>
            <div className="form-group">
              <label>Confirm Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={loading}
                placeholder="Confirm new password"
                minLength={6}
              />
            </div>
            <button type="submit" className="auth-button" disabled={loading}>
              {loading ? 'Resetting...' : 'Reset Password'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default StudentForgotPassword;
