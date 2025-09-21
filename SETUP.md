# 🚀 Career Disha Backend - Setup Guide

This guide helps you set up the Career Disha backend locally and for serverless deployment.

## 📋 Prerequisites Checklist

- [ ] Node.js 18.0.0+
- [ ] PostgreSQL 13+
- [ ] Git
- [ ] Google Gemini API key
- [ ] (Optional) Google Cloud SDK + a GCS bucket

---

## 🔧 Step-by-Step Setup

### Step 1: Install Required Software

Verify:
```powershell
node --version
npm --version
```

### Step 2: Get the Project
```powershell
git clone https://github.com/your-org/career-disha-backend.git
cd career-disha-backend
```

### Step 3: Install Dependencies
```powershell
npm install
```

### Step 4: Environment Configuration
```powershell
copy .env.example .env
notepad .env
```
Update at minimum:
```env
DATABASE_URL=postgresql://username:password@localhost:5432/careerdisha_dev
JWT_SECRET=your_secure_jwt_secret
GEMINI_API_KEY=your_gemini_api_key
# Optional
HUGGING_FACE_API_KEY=your_hf_api_key
ALLOWED_DOMAINS="http://localhost:3000,http://localhost:5173"
# For async resume processing
GCS_BUCKET_NAME=your-bucket-name
GCP_PROJECT_ID=your-project-id
```

### Step 5: Database Initialize
```powershell
npm run db:generate
npm run db:migrate
# optional seed
echo "(optional) npm run db:seed"
```

### Step 6: Run Locally

Option A: Classic dev server (Express)
```powershell
npm run dev
```

Option B: Local serverless (Functions Framework)
```powershell
npm run start:functions
```

### Step 7: Verify
```powershell
# Health
curl http://localhost:3000/api/health | cat
# Docs
start http://localhost:3000/api/docs
```

---

## ☁️ Serverless Deployment (Google Cloud Functions)

### 1) Deploy API (HTTP)
```powershell
gcloud functions deploy api `
  --gen2 --runtime nodejs18 --region=YOUR_REGION `
  --entry-point=api --trigger-http --allow-unauthenticated
```

### 2) Deploy Resume Worker (GCS Trigger)
```powershell
gcloud functions deploy handleResumeUpload `
  --gen2 --runtime nodejs18 --region=YOUR_REGION `
  --entry-point=handleResumeUpload `
  --trigger-bucket=YOUR_BUCKET_NAME
```

Set environment variables in your cloud environment as needed (`DATABASE_URL`, `JWT_SECRET`, `GEMINI_API_KEY`, `HUGGING_FACE_API_KEY`, `GCS_BUCKET_NAME`, `ALLOWED_DOMAINS`).

---

## 🔧 Useful Commands
```powershell
npm run db:studio     # Prisma Studio
npm run db:reset      # Reset DB
npm run lint          # Lint
npm run test          # Tests
```

## 🆘 Troubleshooting
- Prisma client not found: `npm run db:generate`
- Database connection issues: verify `DATABASE_URL` and PostgreSQL service
- 202 on uploads but no results: ensure GCS trigger is deployed and `GCS_BUCKET_NAME` is set

---

## ✅ Expected Local Output
```
🚀 Server is listening on http://localhost:3000
📚 API Documentation: http://localhost:3000/api/docs
📊 Monitoring available at http://localhost:3000/api/monitoring/health
```

Happy coding! 🎯