@echo off
setlocal enabledelayedexpansion

TITLE PersonalClaw v12.8 - Setup Wizard

echo.
echo   ========================================================
echo        PersonalClaw v12.8 - Setup Wizard
echo   ========================================================
echo.

:: ─── Check Node.js ───────────────────────────────────────────
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed!
    echo Please download and install it from: https://nodejs.org/
    echo.
    pause
    exit /b 1
)
for /f "tokens=*" %%v in ('node --version') do echo [OK] Node.js %%v detected.
echo.

:: ─── 1. Backend Dependencies ─────────────────────────────────
echo [1/6] Installing backend dependencies...
call npm install
if %errorlevel% neq 0 (
    echo [WARNING] npm install had issues. Some native modules may need build tools.
    echo          Install Visual Studio Build Tools if you see node-gyp errors.
)
echo.

:: ─── 2. Playwright Browser ──────────────────────────────────
set /p SETUP_PLAYWRIGHT="Install Playwright browser for automation? (y/n) [y]: "
if "%SETUP_PLAYWRIGHT%"=="" set SETUP_PLAYWRIGHT=y
if /i "%SETUP_PLAYWRIGHT%"=="y" (
    echo [2/6] Installing Playwright Chromium...
    call npx playwright install chromium
    if %errorlevel% neq 0 echo [WARNING] Playwright install failed. Browser skills won't work.
) else (
    echo [2/6] Skipped Playwright.
)
echo.

:: ─── 3. Dashboard Dependencies ──────────────────────────────
echo [3/6] Installing dashboard dependencies...
if exist dashboard (
    cd dashboard
    call npm install
    if %errorlevel% neq 0 echo [WARNING] Dashboard npm install failed. UI may not work.
    cd ..
) else (
    echo [WARNING] Dashboard directory not found! Skipping.
)
echo.

:: ─── 4. Environment Config ──────────────────────────────────
echo [4/6] Configuring environment...
if not exist .env (
    if exist .env.example (
        copy .env.example .env >nul
        echo        Created .env from .env.example
    ) else (
        echo GEMINI_API_KEY=> .env
        echo PORT=3000>> .env
        echo TELEGRAM_BOT_TOKEN=>> .env
        echo AUTHORIZED_CHAT_ID=>> .env
        echo        Created new .env file
    )
)

set /p GEMINI_KEY="Enter your Google Gemini API Key (get free at aistudio.google.com): "
if not "!GEMINI_KEY!"=="" (
    powershell -Command "(gc .env) -replace 'GEMINI_API_KEY=.*', 'GEMINI_API_KEY=!GEMINI_KEY!' | Out-File -encoding ASCII .env"
    echo [OK] Gemini API Key saved.
) else (
    echo [SKIP] No key entered. Edit .env manually later.
)
echo.

:: ─── 5. Telegram (Optional) ─────────────────────────────────
set /p SETUP_TG="Set up Telegram bot for remote control? (y/n) [n]: "
if "%SETUP_TG%"=="" set SETUP_TG=n
if /i "%SETUP_TG%"=="y" (
    echo.
    echo   Get a bot token from @BotFather on Telegram.
    echo   Get your chat ID from @userinfobot on Telegram.
    echo.
    set /p TG_TOKEN="Telegram Bot Token: "
    if not "!TG_TOKEN!"=="" (
        powershell -Command "(gc .env) -replace 'TELEGRAM_BOT_TOKEN=.*', 'TELEGRAM_BOT_TOKEN=!TG_TOKEN!' | Out-File -encoding ASCII .env"
        set /p TG_ID="Your Telegram Chat ID (optional, locks bot to you): "
        if not "!TG_ID!"=="" (
            powershell -Command "(gc .env) -replace 'AUTHORIZED_CHAT_ID=.*', 'AUTHORIZED_CHAT_ID=!TG_ID!' | Out-File -encoding ASCII .env"
        )
        echo [OK] Telegram configured.
    )
) else (
    echo [5/6] Skipped Telegram setup.
)
echo.

:: ─── 6. Android App (Optional) ──────────────────────────────
set /p SETUP_ANDROID="Set up Android mobile app? (y/n) [n]: "
if "%SETUP_ANDROID%"=="" set SETUP_ANDROID=n
if /i "%SETUP_ANDROID%"=="y" (
    echo [6/6] Installing Android app dependencies...
    if exist PersonalClawApp (
        cd PersonalClawApp
        call npm install
        if %errorlevel% neq 0 (
            echo [WARNING] Android app npm install failed.
        ) else (
            echo [OK] Android app dependencies installed.
            echo.
            echo   Next steps for Android:
            echo   1. Connect your phone via USB with USB debugging enabled
            echo   2. Run: cd PersonalClawApp ^&^& npx expo run:android
            echo   3. Set the server URL in the app's Settings tab
            echo   4. See docs/SETUP_GUIDE.md for push notifications and remote access
        )
        cd ..
    ) else (
        echo [WARNING] PersonalClawApp directory not found! Skipping.
    )
) else (
    echo [6/6] Skipped Android app setup.
)
echo.

:: ─── Create required directories ────────────────────────────
if not exist screenshots mkdir screenshots
if not exist memory mkdir memory
if not exist outputs mkdir outputs
if not exist logs mkdir logs
if not exist data mkdir data

:: ─── Done ────────────────────────────────────────────────────
echo.
echo   ========================================================
echo        Setup Complete!
echo   ========================================================
echo.
echo   To start PersonalClaw:    start.bat
echo   Dashboard:                http://localhost:5173
echo.
echo   Optional:
echo     Chrome Extension:       Load extension/ folder in chrome://extensions
echo     Android App:            cd PersonalClawApp ^&^& npx expo run:android
echo     Remote Access:          See docs/SETUP_GUIDE.md (Cloudflare Tunnel)
echo     Full Documentation:     docs/ARCHITECTURE.md
echo.
pause
