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

echo.
echo ===================================================
echo Setup complete! What would you like to do?
echo ===================================================
echo 1. Start SafeVault Desktop (GUI)
echo 2. Show CLI Command list (Help)
echo 3. Exit
echo.
set /p choice="Enter your choice (1-3): "

if "%choice%"=="1" (
    echo Starting Desktop Application...
    npm run dev
) else if "%choice%"=="2" (
    echo.
    echo Running CLI Help...
    call safevault
    pause
) else (
    echo Exiting. Goodbye!
)
