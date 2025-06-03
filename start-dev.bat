@echo off
echo Starting ColorBook Engine Development Server...
echo.
echo Make sure you have Node.js installed!
echo.
cd /d "C:\Users\kajal\build\colorbook-engine-clean"

echo Installing dependencies...
call npm install

echo.
echo Starting development server...
echo Open your browser to http://localhost:3000
echo.
call npm run dev

pause
