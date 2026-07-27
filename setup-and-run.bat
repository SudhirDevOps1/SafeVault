@echo off
rem ============================================================================
rem SafeVault - Automated Setup and Launch Tool
rem ============================================================================

rem Enable ANSI Color sequences in Command Prompt safely
set "ESC="
for /F "tokens=1,2 delims=#" %%a in ('"prompt #$H#$E# & echo on & for %%b in (1) do rem"') do (
    if not defined ESC set "ESC=%%b"
)
if not defined ESC set "ESC= "

rem Color definitions
set "C_RESET=%ESC%[0m"
set "C_CYAN=%ESC%[96m"
set "C_BLUE=%ESC%[94m"
set "C_GREEN=%ESC%[92m"
set "C_YELLOW=%ESC%[93m"
set "C_RED=%ESC%[91m"
set "C_MAGENTA=%ESC%[95m"
set "C_WHITE=%ESC%[97m"
set "C_BOLD=%ESC%[1m"

title SafeVault - Automated Setup and Launch Tool

rem Check Administrator status
net session >nul 2>&1
if %errorlevel% == 0 (
    set "ADMIN_STATUS=%C_GREEN%[ADMINISTRATOR OK]%C_RESET%"
) else (
    set "ADMIN_STATUS=%C_YELLOW%[STANDARD USER - Run as Admin recommended]%C_RESET%"
)

:header
cls
echo %C_CYAN%========================================================================================%C_RESET%
echo %C_CYAN%                      SafeVault Setup and Launch Assistant                            %C_RESET%
echo %C_CYAN%========================================================================================%C_RESET%
echo %C_GREEN%   [SafeVault] - ALL-IN-ONE SECURE VAULT PLATFORM LAUNCHER and AUTO-REPAIR STUDIO      %C_RESET%
echo %C_CYAN%========================================================================================%C_RESET%
echo.
echo   %C_BOLD%Privilege Level :%C_RESET% %ADMIN_STATUS%
echo   %C_BOLD%Working Dir     :%C_RESET% %CD%
echo.

rem Checking Node.js Environment
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

rem Installing and Auto-Healing Dependencies
echo %C_CYAN%[2/3] Checking and Installing project dependencies...%C_RESET%
if not exist "node_modules\" (
    echo   %C_YELLOW%[INFO] node_modules not detected. Running fresh npm install...%C_RESET%
) else (
    echo   %C_GREEN%[INFO] node_modules present. Verifying package integrity...%C_RESET%
)

call npm install --no-audit --no-fund <nul
if %errorlevel% neq 0 (
    echo %C_YELLOW%[WARNING] npm install had issues. Running Auto-Repair...%C_RESET%
    echo   %C_MAGENTA%---> Cleaning npm cache and retrying...%C_RESET%
    call npm cache clean --force >nul 2>&1
    call npm install --legacy-peer-deps --no-audit --no-fund <nul
    if %errorlevel% neq 0 (
        echo %C_RED%[ERROR] Failed to install dependencies. Try: npm install --force%C_RESET%
        pause
        exit /b 1
    )
)
echo   %C_GREEN%[SUCCESS] Dependencies verified and ready.%C_RESET%
echo.

rem Setting up CLI tool globally
echo %C_CYAN%[3/3] Setting up SafeVault CLI tool globally...%C_RESET%
call npm link --force >nul 2>&1 <nul
if %errorlevel% neq 0 (
    echo   %C_YELLOW%[WARNING] Could not link CLI globally - requires Administrator rights.%C_RESET%
    echo   %C_YELLOW%          Local npm run commands remain 100%% operational.%C_RESET%
) else (
    echo   %C_GREEN%[SUCCESS] CLI linked globally.%C_RESET%
)
echo.
echo %C_GREEN%========================================================================================%C_RESET%
echo %C_BOLD%                  SETUP COMPLETE - SELECT A COMMAND BELOW                             %C_RESET%
echo %C_GREEN%========================================================================================%C_RESET%
echo.

:menu
cls
echo %C_CYAN%========================================================================================%C_RESET%
echo %C_WHITE%%C_BOLD%               SAFEVAULT MULTI-PLATFORM LAUNCH and DIAGNOSTICS SUITE                %C_RESET%
echo %C_CYAN%========================================================================================%C_RESET%
echo.
echo %C_GREEN% [1]%C_RESET% Start SafeVault Desktop GUI           - npm run electron:dev
echo %C_GREEN% [2]%C_RESET% Build Desktop Production Installer    - npm run electron:build
echo %C_GREEN% [3]%C_RESET% Sync Web Assets to Mobile App         - npm run mobile:sync
echo %C_GREEN% [4]%C_RESET% Start Web Client Dev Server           - npm run dev
echo %C_GREEN% [5]%C_RESET% Build and Start Production Server     - npm run build + npm start
echo %C_GREEN% [6]%C_RESET% Run CLI Interactive Help              - safevault --help
echo %C_GREEN% [7]%C_RESET% Deep Auto-Repair and Clean Reset      - Purge and Relink
echo %C_BLUE%  [8]%C_RESET% System Health Check and Port Inspector - Check Ports 3000 and 5173
echo %C_YELLOW% [9]%C_RESET% Why Did Previous Batch Script Fail?   - Diagnostic Report
echo %C_RED%  [0]%C_RESET% Exit Launcher
echo.
echo %C_CYAN%========================================================================================%C_RESET%
echo.
echo %C_BOLD%Press a key 1-9 or 0 to exit:%C_RESET%

rem Use CHOICE command - reads direct keypress, immune to stdin pipe issues
choice /C 1234567890 /N >nul 2>&1
set "ERRLVL=%errorlevel%"

rem choice maps: 1->EL1, 2->EL2, ..., 9->EL9, 0->EL10
rem Check from highest to lowest (important for errorlevel chain logic)
if %ERRLVL%==10 goto run0
if %ERRLVL%==9  goto run9
if %ERRLVL%==8  goto run8
if %ERRLVL%==7  goto run7
if %ERRLVL%==6  goto run6
if %ERRLVL%==5  goto run5
if %ERRLVL%==4  goto run4
if %ERRLVL%==3  goto run3
if %ERRLVL%==2  goto run2
if %ERRLVL%==1  goto run1
goto menu

:run1
cls
echo.
echo %C_CYAN%[1] Starting SafeVault Desktop Application - Electron Dev Mode...%C_RESET%
echo.
call npm run electron:dev
echo.
echo %C_GREEN%[DONE] App closed. Press any key to return to menu...%C_RESET%
pause >nul
goto menu

:run2
cls
echo.
echo %C_CYAN%[2] Building Production Desktop Package Installer...%C_RESET%
echo.
call npm run electron:build
echo.
echo %C_GREEN%[DONE] Build finished. Press any key to return to menu...%C_RESET%
pause >nul
goto menu

:run3
cls
echo.
echo %C_CYAN%[3] Syncing Web Assets to Capacitor Mobile App...%C_RESET%
echo.
call npm run mobile:sync
echo.
echo %C_GREEN%[DONE] Sync complete. Press any key to return to menu...%C_RESET%
pause >nul
goto menu

:run4
cls
echo.
echo %C_GREEN%[4] Starting Web Client - Local Dev Server on http://localhost:3000 ...%C_RESET%
echo.
call npm run dev
echo.
echo %C_GREEN%[DONE] Dev server stopped. Press any key to return to menu...%C_RESET%
pause >nul
goto menu

:run5
cls
echo.
echo %C_YELLOW%[5] Building and Starting Optimized Production Server...%C_RESET%
echo.
call npm run build
call npm run start
echo.
echo %C_GREEN%[DONE] Server stopped. Press any key to return to menu...%C_RESET%
pause >nul
goto menu

:run6
cls
echo.
echo %C_MAGENTA%[6] Running SafeVault CLI Help...%C_RESET%
echo.
safevault --help 2>nul
if %errorlevel% neq 0 (
    echo %C_YELLOW%[INFO] CLI not in PATH. Running via npx...%C_RESET%
    call npx safevault --help
)
echo.
echo %C_GREEN%[DONE] Press any key to return to menu...%C_RESET%
pause >nul
goto menu

:run7
cls
echo.
echo %C_RED%[7] Executing Deep Reset and Dependency Cleanup...%C_RESET%
echo.
if exist "node_modules\" (
    echo   Removing node_modules folder...
    rmdir /s /q node_modules >nul 2>&1
)
if exist "package-lock.json" del /f /q package-lock.json >nul 2>&1
echo   Reinstalling fresh packages...
call npm install --no-audit --no-fund <nul
echo   Relinking global CLI with force flag...
call npm link --force <nul
echo.
echo %C_GREEN%[SUCCESS] Deep Auto-Repair completed. Press any key to return to menu...%C_RESET%
pause >nul
goto menu

:run8
cls
echo.
echo %C_BLUE%[8] SafeVault Environment and Port Diagnostics%C_RESET%
echo.
echo   Node Version : %NODE_VER%
echo   npm Version  : %NPM_VER%
echo   Working Dir  : %CD%
echo.
echo   Checking Port 3000 - Web Client...
netstat -ano | findstr :3000 >nul 2>&1
if %errorlevel%==0 (
    echo     %C_YELLOW%[BUSY] Port 3000 is in use%C_RESET%
) else (
    echo     %C_GREEN%[FREE] Port 3000 is available%C_RESET%
)
echo   Checking Port 5173 - Vite and Electron...
netstat -ano | findstr :5173 >nul 2>&1
if %errorlevel%==0 (
    echo     %C_YELLOW%[BUSY] Port 5173 is in use%C_RESET%
) else (
    echo     %C_GREEN%[FREE] Port 5173 is available%C_RESET%
)
echo.
echo %C_GREEN%[DONE] Diagnostics complete. Press any key to return to menu...%C_RESET%
pause >nul
goto menu

:run9
cls
echo.
echo %C_YELLOW%============================================================================%C_RESET%
echo %C_BOLD%         SAFEVAULT BATCH SCRIPT AUTO-FIX DIAGNOSTIC REPORT                %C_RESET%
echo %C_YELLOW%============================================================================%C_RESET%
echo.
echo %C_BOLD%BUG 1 - Title ampersand crash%C_RESET%
echo    Cause: Unquoted title with ampersand splits cmd execution.
echo    Fix  : Use quoted title string.
echo.
echo %C_BOLD%BUG 2 - npm EEXIST symlink conflict%C_RESET%
echo    Cause: Previous safevault symlink exists in AppData npm folder.
echo    Fix  : Use npm link --force to overwrite existing symlinks.
echo.
echo %C_BOLD%BUG 3 - Garbled Unicode Emojis%C_RESET%
echo    Cause: Default Windows CMD uses Code Page 437 - corrupts emojis.
echo    Fix  : Remove emojis and use ASCII-only characters in bat files.
echo.
echo %C_BOLD%BUG 4 - Parenthesis inside if blocks crash CMD%C_RESET%
echo    Cause: CMD treats closing parenthesis inside echo as block end.
echo    Fix  : Remove parenthesis inside if block echo statements.
echo.
echo %C_BOLD%BUG 5 - Infinite invalid loop after menu selection%C_RESET%
echo    Cause: npm install consumes stdin so set /p reads empty string.
echo    Fix  : Use choice command for menu - reads direct keypress only.
echo.
echo %C_YELLOW%============================================================================%C_RESET%
echo.
echo Press any key to return to menu...
pause >nul
goto menu

:run0
cls
echo.
echo %C_GREEN%Exiting SafeVault Launcher. Stay secure. Goodbye.%C_RESET%
echo.
pause
exit /b 0
