@echo off
REM Batch script to increment cache version and push to public repo
REM Usage: push_public.bat

echo ========================================
echo Push to Public with Cache Busting
echo ========================================
echo.

REM Check if we're in a git repo
git rev-parse --git-dir >nul 2>&1
if errorlevel 1 (
    echo ERROR: Not in a git repository!
    pause
    exit /b 1
)

REM Get current version from index.html
echo Reading current cache version...
for /f "tokens=*" %%i in ('grep -oP "v=\K\d+" docs/index.html ^| head -1') do set CURRENT_VERSION=%%i
if "%CURRENT_VERSION%"=="" (
    echo WARNING: Could not find version number, defaulting to 0
    set CURRENT_VERSION=0
)

echo Current version: v=%CURRENT_VERSION%

REM Increment version
set /a NEW_VERSION=%CURRENT_VERSION%+1
echo New version: v=%NEW_VERSION%
echo.

REM Update version in index.html (both CSS and JS)
echo Updating cache version in docs/index.html...
sed -i "s/style\.css?v=[0-9]\+/style.css?v=%NEW_VERSION%/g" docs/index.html
sed -i "s/eq_designer\.js?v=[0-9]\+/eq_designer.js?v=%NEW_VERSION%/g" docs/index.html

echo.
echo Updated files:
git diff --name-only docs/index.html
echo.

REM Show git status
echo Current git status:
git status --short
echo.

REM Ask for confirmation
set /p CONFIRM="Continue with commit and push? (y/n): "
if /i not "%CONFIRM%"=="y" (
    echo Aborted.
    echo Restoring docs/index.html...
    git checkout docs/index.html
    pause
    exit /b 0
)

REM Add all changes
echo.
echo Adding all changes...
git add -A

REM Commit
set /p COMMIT_MSG="Enter commit message: "
if "%COMMIT_MSG%"=="" (
    echo ERROR: Commit message required!
    git reset
    pause
    exit /b 1
)

echo.
echo Committing...
git commit -m "%COMMIT_MSG%"

if errorlevel 1 (
    echo.
    echo Commit failed or nothing to commit!
    pause
    exit /b 1
)

REM Push to origin
echo.
echo Pushing to origin (private)...
git push origin main

if errorlevel 1 (
    echo ERROR: Push to origin failed!
    pause
    exit /b 1
)

REM Push to public
echo.
echo Pushing to public...
git push public main

if errorlevel 1 (
    echo ERROR: Push to public failed!
    pause
    exit /b 1
)

echo.
echo ========================================
echo SUCCESS!
echo ========================================
echo Cache version updated: v=%CURRENT_VERSION% -^> v=%NEW_VERSION%
echo Pushed to both origin and public repositories
echo.
echo GitHub Pages will update in 1-2 minutes
echo Users may need to hard refresh: Ctrl+Shift+R
echo ========================================
echo.
pause
