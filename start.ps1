# ===============================================
# CAREER DISHA BACKEND - QUICK START SCRIPT
# ===============================================
# PowerShell script to set up and start the Career Disha backend server

Write-Host "🎯 Career Disha Backend - Quick Start" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan

# Check if Node.js is installed
Write-Host "🔍 Checking Node.js installation..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version
    Write-Host "✅ Node.js found: $nodeVersion" -ForegroundColor Green
    
    if ([version]($nodeVersion.Substring(1)) -lt [version]"18.0.0") {
        Write-Host "⚠️  Warning: Node.js 18.0.0 or higher is recommended" -ForegroundColor Yellow
    }
} catch {
    Write-Host "❌ Node.js not found. Please install Node.js 18.0.0 or higher from https://nodejs.org/" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

# Check if npm is available
Write-Host "🔍 Checking npm installation..." -ForegroundColor Yellow
try {
    $npmVersion = npm --version
    Write-Host "✅ npm found: v$npmVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ npm not found. Please reinstall Node.js" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

# Check if PostgreSQL is running (optional check)
Write-Host "🔍 Checking PostgreSQL..." -ForegroundColor Yellow
$pgRunning = Get-Process postgres -ErrorAction SilentlyContinue
if ($pgRunning) {
    Write-Host "✅ PostgreSQL appears to be running" -ForegroundColor Green
} else {
    Write-Host "⚠️  PostgreSQL not detected. Make sure it's running before starting the server" -ForegroundColor Yellow
}

# Check if .env file exists
Write-Host "🔍 Checking environment configuration..." -ForegroundColor Yellow
if (Test-Path ".env") {
    Write-Host "✅ Environment file (.env) found" -ForegroundColor Green
} else {
    Write-Host "⚠️  Environment file not found. Creating from template..." -ForegroundColor Yellow
    if (Test-Path ".env.example") {
        Copy-Item ".env.example" ".env"
        Write-Host "📝 Created .env file from .env.example" -ForegroundColor Green
        Write-Host "🔧 Please edit .env file with your configuration before continuing" -ForegroundColor Yellow
        Write-Host "   Required: DATABASE_URL, JWT_SECRET, GEMINI_API_KEY, GCS_BUCKET_NAME" -ForegroundColor Yellow
        
        $response = Read-Host "Have you configured your .env file? (y/n)"
        if ($response -ne "y" -and $response -ne "Y") {
            Write-Host "Please configure your .env file and run this script again" -ForegroundColor Yellow
            Read-Host "Press Enter to exit"
            exit 0
        }
    } else {
        Write-Host "❌ .env.example file not found. Please create .env file manually" -ForegroundColor Red
        Read-Host "Press Enter to exit"
        exit 1
    }
}

# Check if node_modules exists
Write-Host "🔍 Checking dependencies..." -ForegroundColor Yellow
if (Test-Path "node_modules") {
    Write-Host "✅ Dependencies already installed" -ForegroundColor Green
} else {
    Write-Host "📦 Installing dependencies..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Failed to install dependencies" -ForegroundColor Red
        Read-Host "Press Enter to exit"
        exit 1
    }
    Write-Host "✅ Dependencies installed successfully" -ForegroundColor Green
}

# Generate Prisma client
Write-Host "🔄 Generating Prisma client..." -ForegroundColor Yellow
npm run db:generate
if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️  Warning: Failed to generate Prisma client. Database may not be configured" -ForegroundColor Yellow
} else {
    Write-Host "✅ Prisma client generated" -ForegroundColor Green
}

# Create necessary directories
Write-Host "📁 Creating required directories..." -ForegroundColor Yellow
$dirs = @("logs", "uploads", "temp")
foreach ($dir in $dirs) {
    if (!(Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir | Out-Null
        Write-Host "✅ Created $dir/ directory" -ForegroundColor Green
    }
}

# Ask user how they want to start the server
Write-Host ""
Write-Host "🚀 Ready to start Career Disha Backend!" -ForegroundColor Green
Write-Host ""
Write-Host "Choose how you want to start the server:" -ForegroundColor Cyan
Write-Host "1. Development mode (auto-reload on changes)" -ForegroundColor White
Write-Host "2. Debug mode (with Node.js inspector)" -ForegroundColor White
Write-Host "3. Production mode" -ForegroundColor White
Write-Host "4. Run database migration first" -ForegroundColor White
Write-Host "5. Local serverless (Functions Framework)" -ForegroundColor White
Write-Host "6. Exit" -ForegroundColor White
Write-Host ""

$choice = Read-Host "Enter your choice (1-6)"

switch ($choice) {
    "1" {
        Write-Host "🔄 Starting in development mode..." -ForegroundColor Green
        Write-Host "Server will be available at: http://localhost:3000" -ForegroundColor Cyan
        Write-Host "API Documentation: http://localhost:3000/api/docs" -ForegroundColor Cyan
        Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Yellow
        Write-Host ""
        npm run dev
    }
    "2" {
        Write-Host "🐛 Starting in debug mode..." -ForegroundColor Green
        Write-Host "Server will be available at: http://localhost:3000" -ForegroundColor Cyan
        Write-Host "Debugger will be available at: http://127.0.0.1:9229" -ForegroundColor Cyan
        Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Yellow
        Write-Host ""
        npm run dev:debug
    }
    "3" {
        Write-Host "🏭 Starting in production mode..." -ForegroundColor Green
        Write-Host "Server will be available at: http://localhost:3000" -ForegroundColor Cyan
        Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Yellow
        Write-Host ""
        npm start
    }
    "4" {
        Write-Host "🗃️ Running database migration..." -ForegroundColor Green
        npm run db:migrate
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ Database migration completed" -ForegroundColor Green
            Write-Host ""
            & $MyInvocation.MyCommand.Path # Restart the script
        } else {
            Write-Host "❌ Database migration failed" -ForegroundColor Red
            Read-Host "Press Enter to exit"
        }
    }
    "5" {
        Write-Host "☁️ Starting local serverless (Functions Framework)..." -ForegroundColor Green
        Write-Host "Function target: api | http://localhost:3000" -ForegroundColor Cyan
        Write-Host "Press Ctrl+C to stop" -ForegroundColor Yellow
        npm run start:functions
    }
    "6" {
        Write-Host "👋 Goodbye!" -ForegroundColor Cyan
        exit 0
    }
    default {
        Write-Host "❌ Invalid choice. Exiting..." -ForegroundColor Red
        Read-Host "Press Enter to exit"
        exit 1
    }
}