@echo off
TITLE PersonalClaw v12.8

echo.
echo   ========================================================
echo        PersonalClaw v12.8 - Starting System
echo   ========================================================
echo.

:: Check dependencies
if not exist node_modules (
    echo [ERROR] Dependencies not found! Run setup.bat first.
    pause
    exit /b 1
)

if not exist .env (
    echo [ERROR] .env file not found! Run setup.bat first.
    pause
    exit /b 1
)

:: Ensure required directories exist
if not exist screenshots mkdir screenshots
if not exist memory mkdir memory
if not exist outputs mkdir outputs
if not exist logs mkdir logs
if not exist data mkdir data

:: Launch Backend
echo [1/2] Starting Backend (port 3000)...
start "PersonalClaw Backend" cmd /c "npm run dev"

:: Wait for backend to initialize
timeout /t 3 >nul

:: Launch Dashboard
echo [2/2] Starting Dashboard (port 5173)...
start "PersonalClaw Dashboard" cmd /c "npm run dashboard"

echo.
echo   ========================================================
echo        System Running
echo   ========================================================
echo.
echo   Dashboard:        http://localhost:5173
echo   Backend API:      http://localhost:3000/status
echo.
echo   Android App:      Connect to http://{your-local-ip}:3000
echo                     or your Cloudflare Tunnel URL
echo.
echo   Close the Backend and Dashboard terminal windows to stop.
echo.
timeout /t 5
