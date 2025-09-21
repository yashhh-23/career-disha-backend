# 🔗 API Endpoints Mapping - Frontend to Backend

## 🚨 Critical Configuration Fix Required

### Current Issue
- **Frontend API Base**: `http://localhost:5000/api`
- **Backend Actual URL**: `http://localhost:3000/api/v1`

### ✅ Solution
Update frontend `.env` file to:
```bash
VITE_API_URL=http://localhost:3000/api/v1
```

---

## 📊 Complete API Mapping

### 🔐 Authentication APIs

| Frontend Call | Backend Endpoint | Status | Notes |
|---------------|------------------|--------|-------|
| `authAPI.register(userData)` | `POST /api/v1/auth/register` | ✅ Available | Requires email, password |
| `authAPI.login(credentials)` | `POST /api/v1/auth/login` | ✅ Available | Returns JWT token |
| `authAPI.getProfile()` | `GET /api/v1/auth/profile` | ✅ Available | Requires auth header |
| `authAPI.updateProfile(data)` | `PUT /api/v1/auth/profile` | ❌ Not Found | Need to implement |
| `authAPI.logout()` | `POST /api/v1/auth/logout` | ❌ Not Found | Frontend can handle locally |

### 👤 Profile APIs

| Frontend Call | Backend Endpoint | Status | Notes |
|---------------|------------------|--------|-------|
| Profile CRUD | `GET /api/v1/profile` | ✅ Available | User profile management |
| Profile Update | `PUT /api/v1/profile` | ✅ Available | Update profile data |

### 🎙️ Interview APIs

| Frontend Call | Backend Endpoint | Status | Notes |
|---------------|------------------|--------|-------|
| `interviewAPI.startInterview()` | `POST /api/v1/interview/start` | ✅ Available | Starts new interview session |
| `interviewAPI.respondToInterview(id, response)` | `POST /api/v1/interview/{id}/respond` | ✅ Available | Submit interview response |
| `interviewAPI.getInterview(id)` | `GET /api/v1/interview/{id}` | ✅ Available | Get interview details |
| `interviewAPI.completeInterview(id)` | `POST /api/v1/interview/{id}/complete` | ✅ Available | Complete interview |
| `interviewAPI.getInterviewHistory()` | `GET /api/v1/interview/history` | ✅ Available | Get user's interview history |

### 💡 Recommendation APIs

| Frontend Call | Backend Endpoint | Status | Notes |
|---------------|------------------|--------|-------|
| `recommendationAPI.getRecommendations(userId)` | `GET /api/v1/recommendations/{userId}` | ✅ Available | Get user recommendations |
| `recommendationAPI.generateRecommendations(data)` | `POST /api/v1/recommendations/generate` | ✅ Available | Generate new recommendations |
| `recommendationAPI.updateRecommendationStatus(id, status)` | `PUT /api/v1/recommendations/{id}` | ✅ Available | Update recommendation status |
| `recommendationAPI.getCourses(filters)` | `GET /api/v1/recommendations/courses` | ⚠️ Check Mapping | May need to map to external API |

### 📈 Progress APIs

| Frontend Call | Backend Endpoint | Status | Notes |
|---------------|------------------|--------|-------|
| `progressAPI.getProgress(userId)` | `GET /api/v1/progress/{userId}` | ✅ Available | Get user progress |
| `progressAPI.updateProgress(data)` | `POST /api/v1/progress/update` | ✅ Available | Update progress |
| `progressAPI.getAnalytics()` | `GET /api/v1/progress/analytics` | ✅ Available | Get analytics data |
| `progressAPI.setGoals(goals)` | `POST /api/v1/progress/goals` | ✅ Available | Set user goals |
| `progressAPI.updateGoalStatus(id, status)` | `PUT /api/v1/progress/goals/{id}` | ✅ Available | Update goal status |

### 🤖 AI APIs

| Frontend Call | Backend Endpoint | Status | Notes |
|---------------|------------------|--------|-------|
| `aiAPI.generateCareerInsights(data)` | ❌ Missing | Need Implementation | AI-powered career insights |
| `aiAPI.analyzeSkillGaps(skills, role)` | ❌ Missing | Need Implementation | Skill gap analysis |
| `aiAPI.generateRoadmap(goals)` | ❌ Missing | Need Implementation | Career roadmap generation |
| `aiAPI.parseResume(file)` | `POST /api/v1/uploads` | ⚠️ Partial | File upload available |

### 🎓 Mentorship APIs

| Frontend Call | Backend Endpoint | Status | Notes |
|---------------|------------------|--------|-------|
| `mentorshipAPI.askQuestion(question)` | `POST /api/v1/mentorship/questions` | ✅ Available | Ask mentorship question |
| `mentorshipAPI.getQuestions()` | `GET /api/v1/mentorship/questions` | ✅ Available | Get user questions |
| `mentorshipAPI.getAnswers(id)` | `GET /api/v1/mentorship/questions/{id}/answers` | ✅ Available | Get question answers |
| `mentorshipAPI.rateMentor(id, rating)` | `POST /api/v1/mentorship/questions/{id}/rating` | ✅ Available | Rate mentor response |

### 🌐 External APIs (Available but not in Frontend)

| Backend Endpoint | Purpose | Integration Needed |
|------------------|---------|-------------------|
| `GET /api/v1/external/courses/search` | Search external courses | Yes - for course recommendations |
| `POST /api/v1/external/courses/recommendations` | Get course recommendations | Yes - for personalized courses |
| `POST /api/v1/external/jobs/trends` | Get job market trends | Yes - for career insights |
| `GET /api/v1/external/jobs/search` | Search job opportunities | Yes - for career opportunities |

### 🏛️ Admin APIs (Available but not Connected)

| Backend Endpoint | Purpose | Integration Needed |
|------------------|---------|-------------------|
| `GET /api/v1/admin/*` | Admin functionality | Optional |
| `GET /api/v1/constellation/*` | Career constellation data | Yes - for data visualization |
| `GET /api/v1/notifications/*` | Notification system | Yes - for user notifications |

---

## 🛠️ Required Frontend Updates

### 1. **Environment Configuration**
```bash
# Update .env file
VITE_API_URL=http://localhost:3000/api/v1
```

### 2. **API Service Updates**
- Remove `/api` prefix from endpoint definitions (already in base URL)
- Update response data structure handlers
- Add error handling for new response formats

### 3. **Authentication Integration**
- Replace Firebase auth with JWT-based auth
- Update token storage and management
- Modify auth interceptors

### 4. **Missing API Implementations**
- Add external course search integration
- Implement career constellation visualization
- Add notification system
- Create admin panel interface (optional)

### 5. **Data Model Updates**
- Update frontend interfaces to match Prisma models
- Handle additional user profile fields
- Support interview session management

---

## 🧪 Testing Strategy

### Phase 1: Basic Connectivity
1. Test health endpoint: `GET /api/health`
2. Test auth endpoints: register/login
3. Verify JWT token handling

### Phase 2: Core Features
1. Test interview flow end-to-end
2. Verify recommendation system
3. Check progress tracking

### Phase 3: Advanced Features
1. Test external API integrations
2. Verify AI service responses
3. Check file upload functionality

---

## 📋 Implementation Checklist

- [ ] Update frontend `.env` configuration
- [ ] Fix API base URL in `api.js`
- [ ] Update authentication system
- [ ] Test basic connectivity
- [ ] Map all API responses
- [ ] Handle error responses
- [ ] Add missing API integrations
- [ ] Test all features end-to-end
- [ ] Optimize performance
- [ ] Add comprehensive error handling

---

**Status**: Ready to begin integration with configuration fixes!