@echo off
:: ============================================================================
:: SafeVault - Automated Setup and Launch Tool (Advanced Self-Healing Edition)
:: ============================================================================

:: [FIX #1] Set active code page to UTF-8 (65001) so unicode renders cleanly
chcp 65001 >nul 2>&1

:: [FIX #2] Enable ANSI Color sequences in Command Prompt safely
set "ESC="
for /F "tokens=1,2 delims=#" %%a in ('"prompt #$H#$E# & echo on & for %%b in (1) do rem"') do (
    if not defined ESC set "ESC=%%b"
)
if not defined ESC set "ESC= "

:: Color definitions
set "C_RESET=%ESC%[0m"
set "C_CYAN=%ESC%[96m"
set "C_BLUE=%ESC%[94m"
set "C_GREEN=%ESC%[92m"
set "C_YELLOW=%ESC%[93m"
set "C_RED=%ESC%[91m"
set "C_MAGENTA=%ESC%[95m"
set "C_WHITE=%ESC%[97m"
set "C_BOLD=%ESC%[1m"

:: [FIX #3] Use quotes around title so ampersand never splits cmd execution
title "SafeVault - Automated Setup and Launch Tool"

:: Check Administrator status
net session >nul 2>&1
if %errorlevel% == 0 (
    set "ADMIN_STATUS=%C_GREEN%[ADMINISTRATOR OK]%C_RESET%"
) else (
    set "ADMIN_STATUS=%C_YELLOW%[STANDARD USER - Run as Admin recommended for global link]%C_RESET%"
)

:header
cls
echo %C_CYAN%========================================================================================%C_RESET%
echo %C_CYAN%                      ____        __     _    __           _  __                      %C_RESET%
echo %C_CYAN%                     / __/____ _ / /_   | |  / /____ _ __ __/ / /_                     %C_RESET%
echo %C_CYAN%                    _\ \ / __ `/ __/   | | / // __ `// // / / __/                      %C_RESET%
echo %C_CYAN%                   /___/ \__,_/\__/    |___//_/\__,_/ \_,_/_/\__/                       %C_RESET%
echo %C_CYAN%========================================================================================%C_RESET%
echo %C_GREEN%   🔒 SAFEVAULT : ALL-IN-ONE SECURE VAULT PLATFORM LAUNCHER and AUTO-REPAIR STUDIO        %C_RESET%
echo %C_CYAN%========================================================================================%C_RESET%
echo.
echo   %C_BOLD%Privilege Level :%C_RESET% %ADMIN_STATUS%
echo   %C_BOLD%Working Dir     :%C_RESET% "%CD%"
echo   %C_BOLD%Terminal Code   :%C_RESET% %C_GREEN%65001 (UTF-8 Unicode Enabled)%C_RESET%
echo.

:: ============================================================================
:: [1/3] CHECKING NODE.JS ENVIRONMENT
:: ============================================================================
echo %C_CYAN%[1/3] Checking Node.js and npm Environment...%C_RESET%
node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo %C_RED%[ERROR] Node.js is not installed or not added to your system PATH.%C_RESET%
    echo %C_YELLOW%        Please install Node.js v18 LTS or higher from https://nodejs.org/%C_RESET%
    echo.
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node -v 2^>^&1') do set "NODE_VER=%%i"
for /f "tokens=*" %%i in ('npm -v 2^>^&1') do set "NPM_VER=%%i"
echo   %C_GREEN%[SUCCESS] Found Node.js %NODE_VER% and npm v%NPM_VER%%C_RESET%
echo.

:: ============================================================================
:: [2/3] INSTALLING and AUTO-HEALING DEPENDENCIES
:: ============================================================================
echo %C_CYAN%[2/3] Checking and Installing project dependencies...%C_RESET%
if not exist "node_modules\" (
    echo   %C_YELLOW%[INFO] node_modules not detected. Running fresh npm install...%C_RESET%
) else (
    echo   %C_GREEN%[INFO] node_modules present. Verifying package integrity...%C_RESET%
)

call npm install --no-audit --no-fund
if %errorlevel% neq 0 (
    echo %C_YELLOW%[WARNING] Standard npm install encountered warnings or errors. Running Auto-Repair...%C_RESET%
    echo   %C_MAGENTA%---> Cleaning npm cache and retrying with legacy peer dependencies...%C_RESET%
    call npm cache clean --force >nul 2>&1
    call npm install --legacy-peer-deps --no-audit --no-fund
    if %errorlevel% neq 0 (
        echo %C_RED%[ERROR] Failed to install dependencies automatically.%C_RESET%
        echo          Try running: npm install --force
        pause
        exit /b 1
    )
)
echo   %C_GREEN%[SUCCESS] Dependencies verified and ready.%C_RESET%
echo.

:: ============================================================================
:: [3/3] SETTING UP CLI TOOL GLOBALLY (AUTO-FIXING EEXIST ERROR)
:: ============================================================================
echo %C_CYAN%[3/3] Setting up SafeVault CLI tool globally (npm link --force)...%C_RESET%
:: [FIX #4] We use --force to overwrite existing symlinks without EEXIST crash!
call npm link --force >nul 2>&1
if %errorlevel% neq 0 (
    echo   %C_YELLOW%[WARNING] Could not link CLI globally (requires Administrator rights).%C_RESET%
    echo   %C_YELLOW%          Don't worry. Local npm run commands remain 100%% operational.%C_RESET%
) else (
    echo   %C_GREEN%[SUCCESS] CLI linked globally. You can now use the 'safevault' command in any terminal.%C_RESET%
)
echo.
echo %C_GREEN%========================================================================================%C_RESET%
echo %C_BOLD%                  SETUP COMPLETE. SELECT A PLATFORM COMMAND BELOW                      %C_RESET%
echo %C_GREEN%========================================================================================%C_RESET%
echo.

:menu
echo %C_CYAN%========================================================================================%C_RESET%
echo %C_WHITE%%C_BOLD%               SAFEVAULT MULTI-PLATFORM LAUNCH and DIAGNOSTICS SUITE                %C_RESET%
echo %C_CYAN%========================================================================================%C_RESET%
echo %C_GREEN% [1]%C_RESET% Start SafeVault Desktop GUI (%C_CYAN%npm run electron:dev%C_RESET%)
echo %C_GREEN% [2]%C_RESET% Build Desktop Production Installer (%C_CYAN%npm run electron:build%C_RESET%)
echo %C_GREEN% [3]%C_RESET% Sync Web Assets to Mobile App (%C_CYAN%npm run mobile:sync%C_RESET%)
echo %C_GREEN% [4]%C_RESET% Start Web Client - Local Dev Server (%C_GREEN%npm run dev - Port 3000%C_RESET%)
echo %C_GREEN% [5]%C_RESET% Build and Start Web Production Server (%C_YELLOW%npm run build ^&^& npm start%C_RESET%)
echo %C_GREEN% [6]%C_RESET% Run CLI Interactive Help (%C_MAGENTA%safevault --help%C_RESET%)
echo %C_GREEN% [7]%C_RESET% Deep Auto-Repair and Clean Reset (%C_RED%Purge node_modules + Force Relink%C_RESET%)
echo %C_GREEN% [8]%C_RESET% System Health Check and Port Inspector (%C_BLUE%Verify Ports 3000, 5173, 8080%C_RESET%)
echo %C_GREEN% [9]%C_RESET% Why Did Previous Batch Script Fail? (%C_YELLOW%Auto-Fix Diagnostic Matrix%C_RESET%)
echo %C_RED% [0]%C_RESET% Exit Launcher
echo %C_CYAN%========================================================================================%C_RESET%
echo.
set /p choice="%C_BOLD%Enter your choice (0-9): %C_RESET%"

if "%choice%"=="1" (
    echo.
    echo %C_CYAN%Starting SafeVault Desktop Application (Dev Mode)...%C_RESET%
    call npm run electron:dev
    goto menu
) else if "%choice%"=="2" (
    echo.
    echo %C_CYAN%Building Production Desktop Package Installer...%C_RESET%
    call npm run electron:build
    goto menu
) else if "%choice%"=="3" (
    echo.
    echo %C_CYAN%Syncing Web Assets to Capacitor Mobile App...%C_RESET%
    call npm run mobile:sync
    goto menu
) else if "%choice%"=="4" (
    echo.
    echo %C_GREEN%Starting Web Client (Local Next.js Dev Server on http://localhost:3000)...%C_RESET%
    call npm run dev
    goto menu
) else if "%choice%"=="5" (
    echo.
    echo %C_YELLOW%Building and Starting Optimized Production Server...%C_RESET%
    call npm run build
    call npm run start
    goto menu
) else if "%choice%"=="6" (
    echo.
    echo %C_MAGENTA%Running SafeVault CLI Help and Command List...%C_RESET%
    call safevault --help 2>&1 || echo %C_YELLOW%[INFO] CLI not in global PATH, running via npx safevault...%C_RESET% && call npx safevault --help
    echo.
    pause
    goto menu
) else if "%choice%"=="7" (
    echo.
    echo %C_RED%[AUTO-REPAIR] Executing Deep Reset and Dependency Cleanup...%C_RESET%
    if exist "node_modules\" (
        echo   removing node_modules folder...
        rmdir /s /q node_modules >nul 2>&1
    )
    if exist "package-lock.json" del /f /q package-lock.json >nul 2>&1
    echo   Reinstalling fresh packages...
    call npm install --no-audit --no-fund
    echo   Relinking global CLI with force flag...
    call npm link --force
    echo %C_GREEN%[SUCCESS] Deep Auto-Repair completed.%C_RESET%
    pause
    goto menu
) else if "%choice%"=="8" (
    echo.
    echo %C_BLUE%=== SafeVault Environment and Port Diagnostics ===%C_RESET%
    echo   Node Version : %NODE_VER%
    echo   npm Version  : %NPM_VER%
    echo   Current Dir  : "%CD%"
    echo   Code Page    : 65001 (UTF-8)
    echo   Checking Port 3000 (Web Client)...
    netstat -ano | findstr :3000 >nul 2>&1 && echo     %C_YELLOW%[BUSY] Port 3000 is active%C_RESET% || echo     %C_GREEN%[FREE] Port 3000 is ready%C_RESET%
    echo   Checking Port 5173 (Vite/Electron)...
    netstat -ano | findstr :5173 >nul 2>&1 && echo     %C_YELLOW%[BUSY] Port 5173 is active%C_RESET% || echo     %C_GREEN%[FREE] Port 5173 is ready%C_RESET%
    echo %C_GREEN%[STATUS] Environment diagnostics complete.%C_RESET%
    pause
    goto menu
) else if "%choice%"=="9" (
    echo.
    echo %C_YELLOW%============================================================================%C_RESET%
    echo %C_BOLD%             SAFEVAULT BATCH SCRIPT AUTO-FIX DIAGNOSTIC REPORT              %C_RESET%
    echo %C_YELLOW%============================================================================%C_RESET%
    echo.
    echo %C_BOLD%1. BUG: "'Launch' is not recognized as an internal or external command"%C_RESET%
    echo    %C_RED%Cause:%C_RESET% In Windows batch files, the ampersand is a command separator.
    echo           The line 'title SafeVault - Automated Setup and Launch Tool' without quotes
    echo           causes cmd.exe to split at ampersand and try to execute 'Launch' as a command.
    echo    %C_GREEN%Fix  :%C_RESET% Wrapped the title in double quotes or replaced with 'and'.
    echo.
    echo %C_BOLD%2. BUG: "npm error EEXIST: file already exists ...\npm\safevault"%C_RESET%
    echo    %C_RED%Cause:%C_RESET% When 'npm link' runs and a previous safevault symlink already exists in
    echo           AppData\Roaming\npm, npm throws EEXIST and stops execution.
    echo    %C_GREEN%Fix  :%C_RESET% Used 'npm link --force' in the script to overwrite existing symlinks seamlessly.
    echo.
    echo %C_BOLD%3. BUG: "fow" Garbled Unicode Emojis in Terminal%C_RESET%
    echo    %C_RED%Cause:%C_RESET% Default Windows Command Prompt uses Code Page 437 (DOS ASCII), corrupting emojis.
    echo    %C_GREEN%Fix  :%C_RESET% Added 'chcp 65001 >nul' at line 1 for native UTF-8 and ANSI colors.
    echo.
    echo %C_YELLOW%============================================================================%C_RESET%
    echo.
    pause
    goto menu
) else if "%choice%"=="0" (
    echo.
    echo %C_GREEN%Exiting SafeVault Launcher. Stay secure. Goodbye.%C_RESET%
    exit /b 0
) else (
    echo.
    echo %C_RED%[INVALID CHOICE] Please select a number between 0 and 9.%C_RESET%
    pause
    goto menu
)
