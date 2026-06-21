@echo off
chcp 437 >nul
cd /d "%~dp0"
title ZhiXu ACOP - Starting

echo.
echo ================================================
echo   ZhiXu ACOP - Startup Script
echo ================================================
echo.

:: ========== Step 1: Check Node.js ==========
echo [1/4] Checking environment...
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js not found. Please install Node.js 18+
    echo   Download: https://nodejs.org/
    echo.
    pause
    exit /b 1
)

for /f "delims=" %%A in ('node -v') do set "NODE_VERSION=%%A"
echo [OK] Node.js %NODE_VERSION% detected

:: ========== Step 2: Install Dependencies ==========
echo.
echo [2/4] Checking dependencies...

if not exist "node_modules" (
    echo   First run detected, installing dependencies...
    echo   This may take 2-5 minutes...
    echo.
    call npm install
    if %errorlevel% neq 0 (
        echo [ERROR] Dependency installation failed
        echo.
        pause
        exit /b 1
    )
    echo [OK] Dependencies installed successfully
) else (
    echo [OK] Dependencies ready
)

:: ========== Step 3: Start Services ==========
echo.
echo [3/4] Starting services...
echo.

echo   [Backend] Starting service (port 3001)...
start "ZhiXu-ACOP-Backend" /min cmd /c "npm run dev:server"
timeout /t 3 /nobreak >nul

echo   [Frontend] Starting service (port 3000)...
start "ZhiXu-ACOP-Frontend" /min cmd /c "npm run dev:client"
timeout /t 6 /nobreak >nul

:: ========== Step 4: Open Browser ==========
echo.
echo [4/4] Opening dashboard...
echo.

powershell -NoProfile -WindowStyle Hidden -Command "Start-Process 'http://localhost:3000'"

echo ================================================
echo   Startup Complete!
echo.
echo   Frontend:    http://localhost:3000
echo   Dashboard:   http://localhost:3000/dashboard
echo   Backend API: http://localhost:3001
echo.
echo   Notes:
echo     - Services run in minimized background windows
echo     - Closing this window won't stop the services
echo     - To stop, close windows titled "ZhiXu-ACOP-"
echo ================================================
echo.
pause
