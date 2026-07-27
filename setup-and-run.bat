@echo off
title SafeVault - Automated Setup & Launch Tool
echo ===================================================
echo   🔒 SafeVault: Setup and Launch Assistant
echo ===================================================
echo.
echo [1/3] Checking Node.js environment...
node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed! Please install Node.js from https://nodejs.org/
    pause
    exit /b
)

echo [2/3] Installing dependencies (npm install)...
call npm install
if %errorlevel% neq 0 (
    echo [ERROR] Failed to install dependencies.
    pause
    exit /b
)

echo [3/3] Setting up CLI tool globally (npm link)...
call npm link
if %errorlevel% neq 0 (
    echo [WARNING] Could not link CLI globally. You might need to run this script as Administrator.
) else (
    echo [SUCCESS] CLI linked! You can now use the 'safevault' command in any terminal.
)

:menu
echo.
echo ===================================================
echo Setup complete! What would you like to do?
echo ===================================================
echo 1. Start SafeVault Desktop GUI (Dev Mode)
echo 2. Package / Build Desktop App (Production Installer)
echo 3. Sync Web Assets to Capacitor Mobile App
echo 4. Start SafeVault Web Client (Local Dev Server)
echo 5. Show CLI Command list (Help)
echo 6. Exit
echo.
set /p choice="Enter your choice (1-6): "

if "%choice%"=="1" (
    echo Starting Desktop Application (Dev Mode)...
    npm run electron:dev
    goto menu
) else if "%choice%"=="2" (
    echo Building Production Desktop Package Installer...
    npm run electron:build
    goto menu
) else if "%choice%"=="3" (
    echo Syncing Web Assets to Capacitor Mobile App...
    npm run mobile:sync
    goto menu
) else if "%choice%"=="4" (
    echo Starting Web Client (Local Dev Server)...
    npm run dev
    goto menu
) else if "%choice%"=="5" (
    echo.
    echo Running CLI Help...
    call safevault
    pause
    goto menu
) else if "%choice%"=="6" (
    echo Exiting. Goodbye!
) else (
    echo Invalid choice. Please select between 1 and 6.
    goto menu
)
