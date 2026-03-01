# Cookie-Based Authentication Guide

## Overview
The JWT tokens are now stored in HTTP-only cookies instead of localStorage for enhanced security. Cookies are automatically sent with every request.

## Backend Setup

### 1. Token Storage
Tokens are set as HTTP-only cookies when users login or signup:

```javascript
res.cookie('token', token, {
  httpOnly: true,                          // Prevents JavaScript access
  secure: process.env.NODE_ENV === 'production', // HTTPS only in production
  sameSite: 'lax',                        // CSRF protection
  maxAge: 30 * 24 * 60 * 60 * 1000       // 30 days
});
```

### 2. Token Verification
The `protect` middleware automatically checks for tokens in cookies:

```javascript
// In middleware/auth.js
if (req.cookies.token) {
  token = req.cookies.token;
}
```

### 3. Creating Protected Routes

#### Example: Create a new protected route

```javascript
// backend/routes/studentAuth.js (or create new route file)
const express = require('express');
const router = express.Router();
const { protect, restrictTo } = require('../middleware/auth');

// Public route (no authentication needed)
router.get('/api/public-data', (req, res) => {
  res.json({ message: 'Public data' });
});

// Protected route (requires authentication)
router.get('/api/student/dashboard-data', protect, restrictTo('student'), (req, res) => {
  // req.user is available here (populated by protect middleware)
  res.json({
    success: true,
    data: {
      userId: req.user._id,
      name: req.user.name,
      // ... your data
    }
  });
});

// Protected route for multiple roles
router.get('/api/shared-data', protect, restrictTo('student', 'educator'), (req, res) => {
  res.json({ message: 'Data for students and educators' });
});

module.exports = router;
```

#### Add to server.js:
```javascript
const myNewRouter = require('./routes/myNewRoute');
app.use('/api', myNewRouter);
```

## Frontend Usage

### 1. API Configuration
The axios instance is already configured with `withCredentials: true`:

```javascript
// frontend/src/api.js
const api = axios.create({
  baseURL: 'http://localhost:5000/api',
  withCredentials: true  // Automatically sends cookies
});
```

### 2. Making Authenticated Requests

```javascript
import api from '../api';

// GET request (cookie automatically sent)
const fetchData = async () => {
  try {
    const response = await api.get('/student/auth/profile');
    console.log(response.data.user);
  } catch (error) {
    console.error('Error:', error.response?.data?.error);
  }
};

// POST request (cookie automatically sent)
const createSomething = async (data) => {
  try {
    const response = await api.post('/student/something', data);
    return response.data;
  } catch (error) {
    console.error('Error:', error.response?.data?.error);
  }
};

// PUT request
const updateSomething = async (id, data) => {
  try {
    const response = await api.put(`/student/something/${id}`, data);
    return response.data;
  } catch (error) {
    console.error('Error:', error.response?.data?.error);
  }
};

// DELETE request
const deleteSomething = async (id) => {
  try {
    const response = await api.delete(`/student/something/${id}`);
    return response.data;
  } catch (error) {
    console.error('Error:', error.response?.data?.error);
  }
};
```

### 3. Using in React Components

```javascript
import React, { useState, useEffect } from 'react';
import api from '../../api';
import { useAuth } from '../../context/AuthContext';

function MyComponent() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await api.get('/student/auth/profile');
        setData(response.data);
      } catch (err) {
        setError(err.response?.data?.error || 'Failed to fetch data');
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      fetchData();
    }
  }, [user]);

  const handleSubmit = async (formData) => {
    try {
      setLoading(true);
      const response = await api.post('/student/something', formData);
      // Handle success
      alert('Success!');
    } catch (err) {
      setError(err.response?.data?.error || 'Operation failed');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      <h2>Welcome {user?.name}</h2>
      {/* Your component content */}
    </div>
  );
}
```

## Available Endpoints

### Student Routes
- `POST /api/student/auth/login` - Login
- `POST /api/student/auth/logout` - Logout
- `GET /api/student/auth/profile` - Get profile (protected)
- `POST /api/student/auth/change-password` - Change password (protected)

### Educator Routes
- `POST /api/educator/auth/login` - Login
- `POST /api/educator/auth/logout` - Logout
- `GET /api/educator/auth/profile` - Get profile (protected)
- `POST /api/educator/auth/change-password` - Change password (protected)

### Admin Routes
- `POST /api/admin/auth/login` - Login
- `POST /api/admin/auth/logout` - Logout
- `GET /api/admin/auth/profile` - Get profile (protected)

## Security Benefits

1. **HTTP-Only Cookies**: JavaScript cannot access the token, preventing XSS attacks
2. **Automatic Sending**: Browser automatically includes cookies in requests
3. **SameSite Protection**: Helps prevent CSRF attacks
4. **Secure Flag**: In production, cookies are only sent over HTTPS

## Development Notes

- Cookies work across all requests automatically
- No need to manually set Authorization headers
- Logout clears the cookie from the server side
- Frontend stores minimal user data in localStorage for UI purposes only
- The actual authentication token is never exposed to JavaScript

## Testing

```javascript
// Check if user is authenticated
const checkAuth = async () => {
  try {
    const response = await api.get('/student/auth/profile');
    console.log('Authenticated as:', response.data.user);
  } catch (error) {
    console.log('Not authenticated');
  }
};
```
