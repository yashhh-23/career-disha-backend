# 🎯 Career Disha Backend

> AI-powered career guidance platform backend with asynchronous resume processing and serverless-ready API

[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![Express.js](https://img.shields.io/badge/Express.js-5.x-blue.svg)](https://expressjs.com/)
[![Prisma](https://img.shields.io/badge/Prisma-6.x-indigo.svg)](https://www.prisma.io/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## 📋 Table of Contents

- [Features](#-features)
- [Prerequisites](#-prerequisites)
- [Installation](#-installation)
- [Environment Setup](#-environment-setup)
- [Database Setup](#-database-setup)
- [Running the Application](#-running-the-application)
- [API Documentation](#-api-documentation)
- [Project Structure](#-project-structure)
- [Available Scripts](#-available-scripts)
- [Monitoring](#-monitoring)
- [Testing](#-testing)
- [Deployment](#-deployment)
- [Contributing](#-contributing)

## ✨ Features

### 🤖 **AI-Powered Services**
- **Google Gemini Integration** - Advanced career guidance and recommendations
- **HuggingFace AI Models** - Text analysis and skill assessment
- **Smart Interview Practice** - AI-driven interviews and feedback
- **Personalized Learning Paths** - Adaptive course recommendations

### 🔐 **Authentication & Security**
- JWT-based authentication with role-based access control
- Security middleware (Helmet, CORS with allowlist, Rate limiting)
- Input sanitization and XSS protection

### ☁️ **Serverless & Async Processing**
- **Asynchronous Resume Processing** via Google Cloud Storage (GCS) trigger
- **Serverless API** ready for Google Cloud Functions (2nd gen)
- Immediate `202 Accepted` on resume upload; background OCR + AI analysis

### 📊 **Monitoring & Analytics**
- Performance/error monitoring and structured logging
- Health endpoints and basic analytics models

### 🎓 **Educational Features**
- Learning management models (Courses, Lessons, Progress)
- Skill assessment and career constellation scaffolding

## 🔧 Prerequisites

- **Node.js** (v18.0.0 or higher)
- **npm** (v8.0.0 or higher)
- **PostgreSQL** (v13 or higher)
- Optional for deployment: **Google Cloud SDK** and a **GCS bucket**

## 🚀 Installation

### 1. **Clone the Repository**
```bash
git clone https://github.com/your-org/career-disha-backend.git
cd career-disha-backend
```

### 2. **Install Dependencies**
```bash
npm install
```

## 🔑 Environment Setup

Create and edit `.env`:
```bash
copy .env.example .env
```
Key variables:
```env
# Database
DATABASE_URL=postgresql://username:password@localhost:5432/careerdisha_dev

# Auth
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRES_IN=7d

# AI Services
GEMINI_API_KEY=your-gemini-api-key
HUGGING_FACE_API_KEY=your-hf-api-key

# Server
NODE_ENV=development
PORT=3000
ALLOWED_DOMAINS="http://localhost:3000,http://localhost:5173"

# Google Cloud Storage (for async resume processing)
GCS_BUCKET_NAME=your-bucket-name
GCP_PROJECT_ID=your-project-id
```

## 🗃️ Database Setup
```bash
npm run db:generate
npm run db:migrate
# optional
npm run db:seed
```

## ▶️ Running the Application

### Development (classic Express)
```bash
npm run dev
# http://localhost:3000
```

### Local serverless (Functions Framework)
```bash
npm run start:functions
# http://localhost:3000
```

### Production
```bash
npm start
```

## 📚 API Documentation
- Swagger UI: `http://localhost:3000/api/docs`
- JSON Spec: `http://localhost:3000/api/docs.json`

### Key API Endpoints

| Category | Endpoint | Description |
|----------|----------|-------------|
| Health | `GET /api/health` | Server health check |
| Auth | `POST /api/v1/auth/register` | User registration |
| Auth | `POST /api/v1/auth/login` | User login |
| Profile | `GET /api/v1/profile` | Get profile |
| Uploads | `POST /api/v1/uploads` | Upload resume (returns 202 Accepted) |
| Monitoring | `GET /api/monitoring/health` | System health |

## 📁 Project Structure
```
career-disha-backend/
├── src/
│   ├── api/
│   ├── config/
│   ├── middlewares/
│   ├── routes/
│   ├── services/
│   ├── workers/
│   └── server.js
├── prisma/
├── logs/
├── index.js              # Cloud Functions entry (http target: api)
├── start.ps1
└── ...
```

## 📜 Available Scripts
```bash
npm run dev              # Dev server
npm run start:functions  # Local serverless via Functions Framework
npm start                # Production
npm run db:generate      # Prisma client
npm run db:migrate       # Migrations
npm run db:seed          # Seed
npm run db:studio        # Prisma Studio
npm run lint             # Lint
npm run test             # Tests
```

## 📊 Monitoring
- `GET /api/monitoring/health`
- `GET /api/monitoring/summary`

## 🧪 Testing
```bash
npm test
```

## 🚀 Deployment

### Cloud Functions (API)
```bash
gcloud functions deploy api \
  --gen2 --runtime nodejs18 --region=YOUR_REGION \
  --entry-point=api --trigger-http --allow-unauthenticated
```

### Cloud Functions (GCS resume worker)
```bash
gcloud functions deploy handleResumeUpload \
  --gen2 --runtime nodejs18 --region=YOUR_REGION \
  --entry-point=handleResumeUpload \
  --trigger-bucket=YOUR_BUCKET_NAME
```

Ensure env vars are set in your deployment environment (`DATABASE_URL`, `JWT_SECRET`, `GEMINI_API_KEY`, `HUGGING_FACE_API_KEY`, `GCS_BUCKET_NAME`, `ALLOWED_DOMAINS`).

## 🤝 Contributing
- Follow ESLint and Prettier
- Write tests for new features
- Update docs for API changes

## 📄 License
MIT