@echo off
setlocal enabledelayedexpansion

TITLE PersonalClaw v11.1 - Setup Wizard

echo.
echo   ╔══════════════════════════════════════════════════════╗
echo   ║          PersonalClaw v11.1 - Installation           ║
echo   ╚══════════════════════════════════════════════════════╝
echo.

:: Check for Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed! 
    echo Please download and install it from: https://nodejs.org/
    pause
    exit /b 1
)

:: Core Dependencies
set /p SETUP_CORE="Install Core Backend dependencies? (y/n) [y]: "
if "%SETUP_CORE%"=="" set SETUP_CORE=y
if /i "%SETUP_CORE%"=="y" (
    echo [1/5] Installing Brain dependencies...
    call npm install || (
        echo [WARNING] Root npm install failed or partially failed. 
        echo Check if you have build tools installed for native modules.
    )
) else (
    echo [SKIP] Core dependencies skipped.
)

:: Playwright (Browser Skill)
set /p SETUP_PLAYWRIGHT="Install Playwright Browser (required for Browser/Vision)? (y/n) [y]: "
if "%SETUP_PLAYWRIGHT%"=="" set SETUP_PLAYWRIGHT=y
if /i "%SETUP_PLAYWRIGHT%"=="y" (
    echo [2/5] Installing Browser Chromium...
    call npx playwright install chromium || echo [WARNING] Playwright install failed. Browser skills may not work.
) else (
    echo [SKIP] Playwright Browser skipped.
)

:: Dashboard
set /p SETUP_DASHBOARD="Install Dashboard UI dependencies? (y/n) [y]: "
if "%SETUP_DASHBOARD%"=="" set SETUP_DASHBOARD=y
if /i "%SETUP_DASHBOARD%"=="y" (
    echo [3/5] Installing Dashboard dependencies...
    if exist dashboard (
        cd dashboard
        call npm install || echo [WARNING] Dashboard npm install failed. UI may not work.
        cd ..
    ) else (
        echo [ERROR] Dashboard directory not found!
    )
) else (
    echo [SKIP] Dashboard UI skipped.
)

:: Python Skill Dependency
echo.
set /p SETUP_PYTHON="Check/Install Python for script execution skill? (y/n) [n]: "
if "%SETUP_PYTHON%"=="" set SETUP_PYTHON=n
if /i "%SETUP_PYTHON%"=="y" (
    where python >nul 2>nul
    if %errorlevel% neq 0 (
        echo [WARNING] Python is not installed or not in PATH. 
        echo Python skill will not work unless you install it from https://www.python.org/
    ) else (
        echo [OK] Python detected.
        python --version
    )
) else (
    echo [SKIP] Python check skipped.
)

:: Config
echo.
echo [4/5] Configuring Environment Variables...
if not exist .env (
    if exist .env.example (
        echo Creating .env from .env.example...
        copy .env.example .env >nul
    ) else (
        echo [WARNING] .env.example not found. Creating empty .env...
        echo GEMINI_API_KEY=> .env
        echo TELEGRAM_BOT_TOKEN=>> .env
        echo AUTHORIZED_CHAT_ID=>> .env
    )
)

:: Prompt for Gemini Key
set /p GEMINI_KEY="Enter your Google Gemini API Key (get it at aistudio.google.com): "
if not "!GEMINI_KEY!"=="" (
    powershell -Command "^(gc .env^) -replace 'GEMINI_API_KEY=.*', 'GEMINI_API_KEY=!GEMINI_KEY!' | Out-File -encoding ASCII .env"
    echo [OK] Gemini API Key updated.
) else (
    echo [SKIP] Gemini API Key not updated.
)

:: Telegram (Optional)
set /p SETUP_TG="Do you want to set up Telegram now? (y/n) [n]: "
if "%SETUP_TG%"=="" set SETUP_TG=n
if /i "%SETUP_TG%"=="y" (
    set /p TG_TOKEN="Enter your Telegram Bot Token (from @BotFather): "
    if not "!TG_TOKEN!"=="" (
        powershell -Command "^(gc .env^) -replace 'TELEGRAM_BOT_TOKEN=.*', 'TELEGRAM_BOT_TOKEN=!TG_TOKEN!' | Out-File -encoding ASCII .env"
        
        set /p TG_ID="Enter your Authorized Telegram Chat ID (optional): "
        if not "!TG_ID!"=="" (
            powershell -Command "^(gc .env^) -replace 'AUTHORIZED_CHAT_ID=.*', 'AUTHORIZED_CHAT_ID=!TG_ID!' | Out-File -encoding ASCII .env"
        )
        echo [OK] Telegram configured.
    )
) else (
    echo [SKIP] Telegram setup skipped.
)

echo.
echo [5/5] Finalizing...
if not exist screenshots mkdir screenshots
if not exist memory mkdir memory

echo [6/6] Chrome Extension Setup...
echo.
echo   To use the Browser Relay (control your real tabs), you MUST:
echo   1. Open Chrome and go to: chrome://extensions
echo   2. Enable "Developer mode" (top right)
echo   3. Click "Load unpacked"
echo   4. Select the 'extension' folder in this directory:
echo      %~dp0extension
echo.

echo   ╔══════════════════════════════════════════════════════╗
echo   ║            Setup Complete! PersonalClaw is ready.     ║
echo   ╠══════════════════════════════════════════════════════╣
echo   ║   1. Ensure Chrome Extension is loaded (see above)    ║
echo   ║   2. To start the system, run: start.bat             ║
echo   ╚══════════════════════════════════════════════════════╝
echo.
pause
