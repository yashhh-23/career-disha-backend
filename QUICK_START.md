# 🚀 CareerDisha Quick Integration Script

## Step 1: Fix API Configuration (Run this first!)

### For Windows (PowerShell):
```powershell
# Navigate to frontend directory
cd "c:\Users\Sahil\Documents\career-disha-frontend"

# Create .env file with correct configuration
@"
# API Configuration - FIXED
VITE_API_URL=http://localhost:3000/api/v1

# Firebase Configuration (temporary - will replace)
VITE_FIREBASE_API_KEY=demo-api-key
VITE_FIREBASE_AUTH_DOMAIN=career-advisor-demo.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=career-advisor-demo
VITE_FIREBASE_STORAGE_BUCKET=career-advisor-demo.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abcdef123456
VITE_FIREBASE_MEASUREMENT_ID=G-ABCDEF123

# Environment
VITE_NODE_ENV=development
"@ | Out-File -FilePath .env -Encoding utf8

Write-Host "✅ Frontend .env file created with correct API URL"
Write-Host "🔗 Backend URL: http://localhost:3000/api/v1"
Write-Host "🔗 Frontend URL: http://localhost:5173"
Write-Host ""
Write-Host "Next steps:"
Write-Host "1. Start backend: cd career-disha-backend && npm run dev"
Write-Host "2. Start frontend: cd career-disha-frontend && npm run dev"
Write-Host "3. Test connection: Open http://localhost:5173"
```

### For Manual Setup:
1. **Create .env file** in `career-disha-frontend` folder
2. **Add this content**:
```bash
VITE_API_URL=http://localhost:3000/api/v1
VITE_NODE_ENV=development
```

## Step 2: Start Services

### Terminal 1 - Backend:
```bash
cd career-disha-backend
npm run dev
```
**Expected output**: "🚀 Server is listening on http://localhost:3000"

### Terminal 2 - Frontend:
```bash
cd career-disha-frontend
npm run dev
```
**Expected output**: "Local: http://localhost:5173/"

## Step 3: Quick Test

1. **Backend Health**: http://localhost:3000/api/health
2. **API Docs**: http://localhost:3000/api/docs
3. **Frontend**: http://localhost:5173

## Step 4: Test Integration

1. **Register a new user**:
   - Go to http://localhost:5173/register
   - Fill the form
   - Check browser console for API calls

2. **Check Network Tab**:
   - Should see calls to `localhost:3000/api/v1/auth/register`
   - Should receive JWT token in response

---

## 🐛 Troubleshooting

### Frontend can't connect to backend:
```bash
# Check if backend is running
curl http://localhost:3000/api/health

# If not running, start it:
cd career-disha-backend
npm run dev
```

### CORS errors:
- Backend already configured for localhost:5173
- Check ALLOWED_DOMAINS in backend .env

### 404 errors on API calls:
- Verify VITE_API_URL in frontend .env
- Should be: `http://localhost:3000/api/v1`

---

## 📋 Integration Status

After completing the quick setup:

✅ **WORKING**:
- Basic API connectivity
- Health checks
- CORS configuration
- Environment setup

🔄 **NEEDS INTEGRATION**:
- Authentication system (replace Firebase)
- API response handlers
- Real data loading
- Error handling

📚 **DOCUMENTATION CREATED**:
- `INTEGRATION_PLAN.md` - Complete analysis and roadmap
- `API_MAPPING.md` - Detailed endpoint mapping
- `IMPLEMENTATION_GUIDE.md` - Step-by-step instructions

---

**🎯 Next Step**: Follow the detailed `IMPLEMENTATION_GUIDE.md` to complete the full integration!