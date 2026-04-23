@echo off
setlocal

set "SCRIPT_DIR=%~dp0"
pushd "%SCRIPT_DIR%\.."

call :resolve_toolchain
if errorlevel 1 goto :fail

echo [package-windows-oneclick] Using Node: %NODE_EXE%
echo [package-windows-oneclick] Using npm: %NPM_CMD%
echo [package-windows-oneclick] Installing dependencies...
call "%NPM_CMD%" ci
if errorlevel 1 goto :fail

echo [package-windows-oneclick] Packaging OpenWeave for Windows...
"%NODE_EXE%" deploy\package-release.mjs windows
if errorlevel 1 goto :fail

echo [package-windows-oneclick] Done: %CD%\deploy\target\windows
popd
exit /b 0

:resolve_toolchain
set "NODE_EXE="
set "NPM_CMD="

for /f "delims=" %%I in ('where npm.cmd 2^>nul') do if not defined NPM_CMD set "NPM_CMD=%%~fI"
if defined NPM_CMD (
  for %%I in ("%NPM_CMD%") do if exist "%%~dpInode.exe" set "NODE_EXE=%%~dpInode.exe"
)
if defined NODE_EXE if defined NPM_CMD exit /b 0

set "PORTABLE_NODE_DIR=%LocalAppData%\Programs\nodejs-portable\node-v22.22.2-win-x64"
if exist "%PORTABLE_NODE_DIR%\node.exe" if exist "%PORTABLE_NODE_DIR%\npm.cmd" (
  set "NODE_EXE=%PORTABLE_NODE_DIR%\node.exe"
  set "NPM_CMD=%PORTABLE_NODE_DIR%\npm.cmd"
  exit /b 0
)

for /f "delims=" %%I in ('where node 2^>nul') do if not defined NODE_EXE set "NODE_EXE=%%~fI"
if defined NODE_EXE (
  for %%I in ("%NODE_EXE%") do if exist "%%~dpInpm.cmd" set "NPM_CMD=%%~dpInpm.cmd"
)
if defined NODE_EXE if defined NPM_CMD exit /b 0

echo [package-windows-oneclick] ERROR: Node.js 22+ with npm was not found.
echo [package-windows-oneclick] Install Node.js or ensure node.exe and npm.cmd are available.
exit /b 1

:fail
set "EXIT_CODE=%ERRORLEVEL%"
echo [package-windows-oneclick] FAILED with exit code %EXIT_CODE%.
popd
exit /b %EXIT_CODE%
