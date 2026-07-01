@echo off
title StoryForge Launcher
color 0E

echo.
echo   ============================================
echo      StoryForge  Launcher
echo   ============================================
echo.
echo   Keep this black window OPEN while you use the app.
echo   Close it when you are done.
echo.

:: ---- Step 1/3: check Node.js ----
echo   [1/3] Checking Node.js ...
where node >nul 2>&1
if %ERRORLEVEL% equ 0 goto NODE_OK

echo.
echo   [!] Node.js is NOT installed. You only need to install it once.
where winget >nul 2>&1
if %ERRORLEVEL% neq 0 goto NO_WINGET
echo       Installing Node.js via winget (Windows Package Manager)...
echo       If a "Do you want to allow changes?" dialog pops up, click Yes.
echo.
pause
winget install OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements
echo.
echo   [Done] Node.js installed.
echo   Please CLOSE this window, then double-click the launcher again.
echo.
pause
exit /b 0

:NO_WINGET
echo       Cannot auto-install. Please install Node.js manually:
echo         1. A download page will open next.
echo         2. Click the green "LTS" button and download.
echo         3. Run the installer, click Next until it finishes.
echo         4. RESTART your PC, then run this launcher again.
echo.
pause
start https://nodejs.org/en/download
exit /b 0

:NODE_OK
for /f "tokens=*" %%i in ('node -v') do set NODE_VER=%%i
echo   [1/3] Node.js OK ^(%NODE_VER%^)
echo.

:: ---- Step 2/3: install dependencies (first run only) ----
if exist "node_modules" goto DEPS_OK
echo   [2/3] First run: downloading dependencies (about 1-2 min, needs internet)...
echo.
call npm install
if %ERRORLEVEL% equ 0 goto DEPS_OK
echo.
echo   [!] Download failed (usually a network issue). Switching to a China mirror and retrying...
call npm config set registry https://registry.npmmirror.com
call npm install
if %ERRORLEVEL% equ 0 goto DEPS_OK
echo.
echo   [X] Still failed. Check your internet, then run the launcher again.
echo.
pause
exit /b 1

:DEPS_OK
echo   [2/3] Dependencies ready.
echo.

:: ---- port check: avoid ERR_TOO_MANY_REDIRECTS caused by a stale instance ----
netstat -ano | findstr ":1111" | findstr "LISTENING" >nul 2>&1
if %ERRORLEVEL% neq 0 goto PORT_FREE
echo   [!] Port 1111 is already in use.
echo       You probably already have StoryForge running (another window, or StoryForge.exe).
echo       Close the other one first; otherwise the browser may show
echo       "127.0.0.1 redirected you too many times (ERR_TOO_MANY_REDIRECTS)".
echo.
echo       Press any key to continue anyway, or close this window.
pause >nul
:PORT_FREE

:: ---- Step 3/3: start ----
echo   [3/3] Starting StoryForge ...
echo.
echo   When it is running, open this address in your browser:
echo.
echo        http://localhost:1111/storyforge/
echo.
echo   ( If the browser does not open by itself, copy the line above. )
echo   To STOP: press Ctrl+C here, or just close this window.
echo.
call npm run dev
