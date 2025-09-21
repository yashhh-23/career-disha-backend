# 🚀 CareerDisha Integration Implementation Guide

## 🎯 Quick Start - Immediate Integration Steps

### STEP 1: Fix Critical Configuration (5 minutes)

#### 1.1 Update Frontend Environment
```bash
# Navigate to frontend directory
cd c:\Users\Sahil\Documents\career-disha-frontend

# Create .env file from example
cp .env.example .env

# Edit .env file with correct backend URL
```

**Update `.env` content:**
```bash
# API Configuration - FIXED
VITE_API_URL=http://localhost:3000/api/v1

# Firebase Configuration (keep for now, will replace later)
VITE_FIREBASE_API_KEY=demo-api-key
VITE_FIREBASE_AUTH_DOMAIN=career-advisor-demo.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=career-advisor-demo
VITE_FIREBASE_STORAGE_BUCKET=career-advisor-demo.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abcdef123456
VITE_FIREBASE_MEASUREMENT_ID=G-ABCDEF123

# Environment
VITE_NODE_ENV=development
```

#### 1.2 Start Both Services
```bash
# Terminal 1: Start Backend (already running)
cd c:\Users\Sahil\Documents\career-disha-backend
npm run dev

# Terminal 2: Start Frontend
cd c:\Users\Sahil\Documents\career-disha-frontend
npm run dev
```

#### 1.3 Quick Test
- Frontend: `http://localhost:5173`
- Backend Health: `http://localhost:3000/api/health`
- API Docs: `http://localhost:3000/api/docs`

---

## 🔧 STEP 2: Integrate Authentication System (30 minutes)

### 2.1 Update Frontend API Service

**File: `src/services/api.js`**
```javascript
// Update API base URL (already fixed with .env)
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';

// Update authAPI endpoints (remove /api prefix)
export const authAPI = {
  register: (userData) => api.post('/auth/register', userData),
  login: (credentials) => api.post('/auth/login', credentials),
  getProfile: () => api.get('/auth/profile'),
  updateProfile: (profileData) => api.put('/profile', profileData), // Use /profile endpoint
  logout: () => Promise.resolve(), // Handle locally
};
```

### 2.2 Update useAuth Hook

**File: `src/hooks/useAuth.jsx`**

Replace mock authentication with real backend integration:

```javascript
import { useState, useEffect, useContext, createContext } from 'react';
import { authAPI } from '../services/api';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Check for existing token on app start
  useEffect(() => {
    const token = localStorage.getItem('authToken');
    if (token) {
      // Verify token with backend
      authAPI.getProfile()
        .then(response => {
          setUser(response.data);
        })
        .catch(() => {
          localStorage.removeItem('authToken');
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email, password) => {
    try {
      const response = await authAPI.login({ email, password });
      const { token, user } = response.data;
      
      localStorage.setItem('authToken', token);
      setUser(user);
      return user;
    } catch (error) {
      throw new Error(error.response?.data?.error || 'Login failed');
    }
  };

  const signup = async (userData) => {
    try {
      const response = await authAPI.register(userData);
      // Auto-login after registration
      return await login(userData.email, userData.password);
    } catch (error) {
      throw new Error(error.response?.data?.error || 'Registration failed');
    }
  };

  const logout = () => {
    localStorage.removeItem('authToken');
    setUser(null);
  };

  const value = {
    user,
    login,
    signup,
    logout,
    loading
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
```

---

## 🔄 STEP 3: Update Components for Real API (45 minutes)

### 3.1 Update Login Component

**File: `src/components/auth/Login.jsx`**

Update error handling and response structure:

```javascript
// In handleSubmit function, update error handling:
try {
  await login(formData.email, formData.password);
  navigate('/dashboard');
} catch (error) {
  setError(error.message);
}
```

### 3.2 Update Register Component  

**File: `src/components/auth/Register.jsx`**

Update to match backend expected format:

```javascript
// Update form data structure to match backend
const handleSubmit = async (e) => {
  e.preventDefault();
  setLoading(true);
  setError('');

  try {
    await signup({
      email: formData.email,
      password: formData.password,
      name: formData.name,
      // Add any other required fields from backend
    });
    navigate('/dashboard');
  } catch (error) {
    setError(error.message);
  } finally {
    setLoading(false);
  }
};
```

### 3.3 Update Dashboard Component

**File: `src/pages/Dashboard.jsx`**

Remove mock data and integrate real APIs:

```javascript
import { useEffect, useState } from 'react';
import { progressAPI, recommendationAPI } from '../services/api';

const Dashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        // Load real data from backend
        const [progressData, recommendations] = await Promise.all([
          progressAPI.getProgress(user.id),
          recommendationAPI.getRecommendations(user.id)
        ]);
        
        setStats({
          interviewsCompleted: progressData.data.interviewsCompleted || 0,
          skillsAssessed: progressData.data.skillsAssessed || 0,
          coursesRecommended: recommendations.data.length || 0,
          progressPercentage: progressData.data.overallProgress || 0,
        });
      } catch (error) {
        console.error('Failed to load dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      loadDashboardData();
    }
  }, [user]);

  // Rest of component...
};
```

---

## 🧪 STEP 4: Testing & Validation (20 minutes)

### 4.1 Test Authentication Flow
1. **Register new user**
   - Open `http://localhost:5173/register`
   - Fill form and submit
   - Check if redirected to dashboard
   - Verify token in localStorage

2. **Test login**
   - Logout and try login
   - Verify user persistence across page refresh

3. **Test API integration**
   - Check browser Network tab for API calls
   - Verify correct endpoints being called
   - Check for proper authentication headers

### 4.2 Debug Common Issues

**Issue: CORS errors**
```javascript
// Backend already configured for localhost:5173
// Check ALLOWED_DOMAINS in backend .env
```

**Issue: 401 Unauthorized**
```javascript
// Check if token is being sent in headers
// Verify token format in localStorage
```

**Issue: 404 Not Found**
```javascript
// Verify API base URL is correct
// Check endpoint paths match backend routes
```

---

## 📈 STEP 5: Integrate Advanced Features (1-2 hours)

### 5.1 Interview System Integration

**File: `src/pages/Interview.jsx`**

```javascript
import { interviewAPI } from '../services/api';

// Replace mock interview logic with real API calls
const startInterview = async () => {
  try {
    const response = await interviewAPI.startInterview();
    setInterviewSession(response.data);
  } catch (error) {
    console.error('Failed to start interview:', error);
  }
};

const submitResponse = async (response) => {
  try {
    await interviewAPI.respondToInterview(interviewSession.id, response);
    // Handle next question logic
  } catch (error) {
    console.error('Failed to submit response:', error);
  }
};
```

### 5.2 Progress Tracking Integration

**File: `src/pages/Progress.jsx`**

```javascript
import { progressAPI } from '../services/api';

// Load real progress data
useEffect(() => {
  const loadProgress = async () => {
    try {
      const response = await progressAPI.getProgress(user.id);
      setProgressData(response.data);
    } catch (error) {
      console.error('Failed to load progress:', error);
    }
  };
  
  loadProgress();
}, [user]);
```

### 5.3 Recommendations Integration  

**File: `src/pages/Results.jsx`**

```javascript
import { recommendationAPI } from '../services/api';

// Load real recommendations
useEffect(() => {
  const loadRecommendations = async () => {
    try {
      const response = await recommendationAPI.getRecommendations(user.id);
      setRecommendations(response.data);
    } catch (error) {
      console.error('Failed to load recommendations:', error);
    }
  };
  
  loadRecommendations();
}, [user]);
```

---

## ⚡ STEP 6: Performance & Production Readiness (30 minutes)

### 6.1 Error Handling
- Add global error boundary
- Implement retry logic for failed requests
- Add loading states for all API calls

### 6.2 Environment Configuration
```bash
# Production environment variables
VITE_API_URL=https://your-backend-domain.com/api/v1
VITE_NODE_ENV=production
```

### 6.3 Build & Test
```bash
# Test production build
npm run build
npm run preview
```

---

## ✅ Integration Completion Checklist

### Core Integration
- [ ] Frontend connects to backend successfully
- [ ] User registration works
- [ ] User login works  
- [ ] JWT tokens handled properly
- [ ] Dashboard loads real data
- [ ] API errors handled gracefully

### Feature Integration
- [ ] Interview system connected
- [ ] Progress tracking functional
- [ ] Recommendations loading
- [ ] Profile management working
- [ ] File uploads functional (if needed)

### Testing & Quality
- [ ] All API endpoints tested
- [ ] Error scenarios handled
- [ ] Loading states implemented
- [ ] Performance optimized
- [ ] Production build successful

### Optional Advanced Features
- [ ] External API integrations (courses, jobs)
- [ ] Real-time notifications
- [ ] Admin panel (if needed)
- [ ] Advanced AI features
- [ ] Comprehensive analytics

---

## 🚨 Troubleshooting Guide

### Common Issues

**1. API Connection Failed**
- Check if backend is running on port 3000
- Verify VITE_API_URL in .env file
- Check CORS configuration in backend

**2. Authentication Not Working**
- Clear localStorage and try again
- Check token format in Network tab
- Verify backend auth endpoints

**3. Data Not Loading**
- Check API response format
- Verify user ID in API calls
- Check for authentication headers

**4. CORS Issues**
- Ensure backend ALLOWED_DOMAINS includes frontend URL
- Check request headers
- Verify OPTIONS requests

### Quick Fixes
```bash
# Reset everything
rm -rf node_modules
npm install
npm run dev

# Clear browser data
localStorage.clear()
# Refresh page
```

---

**🎉 Result**: Fully integrated CareerDisha application with frontend connected to backend, real authentication, and all core features functional!