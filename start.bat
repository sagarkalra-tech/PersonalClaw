@echo off
TITLE PersonalClaw v11.1 - Runner

echo.
echo   ╔══════════════════════════════════════════════════════╗
echo   ║         PersonalClaw v11.1 - Starting System         ║
echo   ╚══════════════════════════════════════════════════════╝
echo.

:: Check if node_modules exists
if not exist node_modules (
    echo [ERROR] Dependencies not found! Please run setup.bat first.
    pause
    exit /b 1
)

:: Check if .env exists
if not exist .env (
    echo [ERROR] .env file not found! Please run setup.bat first.
    pause
    exit /b 1
)

echo [Server] Dashboard will be at http://localhost:5173
echo [Relay]  Ensure Chrome Extension is loaded in Developer Mode.
echo [System] Launching Backend and Dashboard in separate terminals...
echo.

:: Launch Backend
echo [1/2] Launching Backend Agent...
start "PersonalClaw Backend" cmd /c "npm run dev"

:: Small delay to let backend start
timeout /t 2 >nul

:: Launch Dashboard
echo [2/2] Launching Dashboard UI...
start "PersonalClaw Dashboard" cmd /c "npm run dashboard"

echo.
echo   ╔══════════════════════════════════════════════════════╗
echo   ║            System Launched Successfully!             ║
echo   ╠══════════════════════════════════════════════════════╣
echo   ║   - Backend terminal: Process logic and tools        ║
echo   ║   - Dashboard terminal: React UI and Vite            ║
echo   ║                                                      ║
echo   ║   To stop, close the individual terminals.            ║
echo   ╚══════════════════════════════════════════════════════╝
echo.
timeout /t 5
