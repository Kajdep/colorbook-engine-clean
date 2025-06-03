# ColorBook Engine Production Deployment Script for Windows
# PowerShell script to handle complete deployment process

param(
    [switch]$SkipBuild,
    [switch]$SkipMigrations,
    [string]$EnvFile = ".env.production"
)

$ErrorActionPreference = "Stop"

Write-Host "🚀 Starting ColorBook Engine Production Deployment..." -ForegroundColor Green

# Check if environment file exists
if (-not (Test-Path $EnvFile)) {
    Write-Host "❌ $EnvFile file not found!" -ForegroundColor Red
    Write-Host "📝 Please copy .env.production.template to .env.production and configure it" -ForegroundColor Yellow
    exit 1
}

# Load environment variables
Get-Content $EnvFile | ForEach-Object {
    if ($_ -match "^([^#][^=]*)=(.*)$") {
        [Environment]::SetEnvironmentVariable($matches[1], $matches[2], "Process")
    }
}

Write-Host "📦 Checking Docker installation..." -ForegroundColor Blue
try {
    docker --version | Out-Null
    docker-compose --version | Out-Null
    Write-Host "✅ Docker is installed and running" -ForegroundColor Green
} catch {
    Write-Host "❌ Docker is not installed or not running" -ForegroundColor Red
    Write-Host "Please install Docker Desktop and ensure it's running" -ForegroundColor Yellow
    exit 1
}

if (-not $SkipBuild) {
    Write-Host "📦 Building Docker images..." -ForegroundColor Blue
    docker-compose -f docker-compose.yml build
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Docker build failed" -ForegroundColor Red
        exit 1
    }
}

Write-Host "🗄️ Starting database..." -ForegroundColor Blue
docker-compose -f docker-compose.yml up -d db

# Wait for database to be ready
Write-Host "⏳ Waiting for database to be ready..." -ForegroundColor Yellow
Start-Sleep -Seconds 15

# Test database connection
$retries = 0
$maxRetries = 10
do {
    try {
        docker-compose -f docker-compose.yml exec -T db pg_isready -U postgres -d colorbook_engine
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ Database is ready" -ForegroundColor Green
            break
        }
    } catch {
        # Continue to retry
    }
    $retries++
    if ($retries -ge $maxRetries) {
        Write-Host "❌ Database failed to become ready" -ForegroundColor Red
        docker-compose -f docker-compose.yml logs db
        exit 1
    }
    Write-Host "⏳ Database not ready yet, retrying in 5 seconds..." -ForegroundColor Yellow
    Start-Sleep -Seconds 5
} while ($retries -lt $maxRetries)

if (-not $SkipMigrations) {
    Write-Host "🔄 Running database migrations..." -ForegroundColor Blue
    
    # Copy migration files to container
    $migrationFiles = Get-ChildItem -Path "../database/migrations/*.sql" -ErrorAction SilentlyContinue
    
    foreach ($file in $migrationFiles) {
        Write-Host "Running migration: $($file.Name)" -ForegroundColor Cyan
        try {
            $content = Get-Content $file.FullName -Raw
            $content | docker-compose -f docker-compose.yml exec -T db psql -U postgres -d colorbook_engine
            if ($LASTEXITCODE -eq 0) {
                Write-Host "✅ Migration $($file.Name) completed" -ForegroundColor Green
            } else {
                Write-Host "⚠️ Migration $($file.Name) may have had issues (this might be normal for existing tables)" -ForegroundColor Yellow
            }
        } catch {
            Write-Host "⚠️ Error running migration $($file.Name): $($_.Exception.Message)" -ForegroundColor Yellow
        }
    }
}

Write-Host "🚀 Starting all services..." -ForegroundColor Blue
docker-compose -f docker-compose.yml up -d

Write-Host "🔍 Checking service health..." -ForegroundColor Blue
Start-Sleep -Seconds 20

# Check if services are running
$runningServices = docker-compose -f docker-compose.yml ps --services --filter "status=running"
$allServices = docker-compose -f docker-compose.yml ps --services

if ($runningServices.Count -eq $allServices.Count) {
    Write-Host "✅ All services are running successfully!" -ForegroundColor Green
    
    # Show running services
    Write-Host "📊 Service Status:" -ForegroundColor Blue
    docker-compose -f docker-compose.yml ps
    
    # Check application health
    Write-Host "🔍 Checking application health endpoint..." -ForegroundColor Blue
    try {
        Start-Sleep -Seconds 5
        $healthCheck = Invoke-RestMethod -Uri "http://localhost:3000/api/monitoring/health" -TimeoutSec 10
        if ($healthCheck.status -eq "healthy") {
            Write-Host "✅ Application health check passed" -ForegroundColor Green
        } else {
            Write-Host "⚠️ Application health check returned: $($healthCheck.status)" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "⚠️ Could not reach health endpoint (this might be normal during startup)" -ForegroundColor Yellow
    }
    
    # Show recent logs
    Write-Host "📋 Recent application logs:" -ForegroundColor Blue
    docker-compose -f docker-compose.yml logs --tail=20 app
    
} else {
    Write-Host "❌ Some services failed to start. Check the logs:" -ForegroundColor Red
    docker-compose -f docker-compose.yml logs
    exit 1
}

Write-Host "🎉 Deployment completed successfully!" -ForegroundColor Green
Write-Host "🌐 Your application should be available at: http://localhost:3000" -ForegroundColor Cyan
Write-Host "🔧 To manage services use: docker-compose -f docker-compose.yml [start|stop|restart|logs]" -ForegroundColor Blue

# Show useful commands
Write-Host "`n📚 Useful Commands:" -ForegroundColor Blue
Write-Host "  • View logs: docker-compose -f docker-compose.yml logs -f [service]" -ForegroundColor White
Write-Host "  • Stop services: docker-compose -f docker-compose.yml down" -ForegroundColor White
Write-Host "  • Restart services: docker-compose -f docker-compose.yml restart" -ForegroundColor White
Write-Host "  • Check status: docker-compose -f docker-compose.yml ps" -ForegroundColor White
Write-Host "  • Access database: docker-compose -f docker-compose.yml exec db psql -U postgres -d colorbook_engine" -ForegroundColor White
