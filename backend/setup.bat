@echo off
REM ColorBook Engine Backend Setup Script for Windows

echo 🎨 Setting up ColorBook Engine Backend...

REM Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Node.js is not installed. Please install Node.js 18+ first.
    echo Download from: https://nodejs.org/
    pause
    exit /b 1
)

REM Check if PostgreSQL is installed
where psql >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ⚠️  PostgreSQL is not installed or not in PATH
    echo Please install PostgreSQL 12+ before continuing
    echo Download from: https://www.postgresql.org/download/windows/
    set /p continue="Continue anyway? (y/N): "
    if /i not "%continue%"=="y" exit /b 1
)

REM Navigate to backend directory
cd backend

echo 📦 Installing dependencies...
call npm install

REM Copy environment file
if not exist .env (
    echo 📋 Creating environment file...
    copy .env.example .env >nul
    echo ✅ Created .env file. Please update it with your configuration.
) else (
    echo ⚠️  .env file already exists
)

REM Create directories
if not exist uploads mkdir uploads
if not exist uploads\images mkdir uploads\images
if not exist uploads\drawings mkdir uploads\drawings
if not exist uploads\exports mkdir uploads\exports
if not exist logs mkdir logs
echo 📁 Created upload and log directories

REM Database setup
set /p setup_db="Do you want to create the database? (y/N): "
if /i "%setup_db%"=="y" (
    set /p db_user="Enter PostgreSQL username (default: postgres): "
    if "%db_user%"=="" set db_user=postgres
    
    set /p db_name="Enter database name (default: colorbook_engine): "
    if "%db_name%"=="" set db_name=colorbook_engine
    
    echo Creating database %db_name%...
    createdb -U %db_user% %db_name% 2>nul
    
    echo Running database schema...
    psql -U %db_user% -d %db_name% -f database\schema.sql
    
    echo ✅ Database setup complete
)

echo.
echo 🎉 Backend setup complete!
echo.
echo 📝 Next steps:
echo 1. Update the .env file with your database credentials
echo 2. Configure Stripe keys if you want payment functionality
echo 3. Set up email configuration for notifications
echo 4. Run 'npm run dev' to start the development server
echo.
echo 🚀 To start the backend:
echo cd backend ^&^& npm run dev

pause