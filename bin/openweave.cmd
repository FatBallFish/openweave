@echo off
setlocal

set "SCRIPT_DIR=%~dp0"
set "ENTRY_PATH=%OPENWEAVE_CLI_ENTRY%"
set "RUNTIME_PATH=%OPENWEAVE_CLI_RUNTIME%"

if defined ENTRY_PATH if exist "%ENTRY_PATH%" goto run

set "ENTRY_PATH=%SCRIPT_DIR%..\dist\cli\index.js"
if exist "%ENTRY_PATH%" goto run

set "ENTRY_PATH=%SCRIPT_DIR%..\app\dist\cli\index.js"
if exist "%ENTRY_PATH%" goto run

echo openweave CLI entry not found. 1>&2
exit /b 1

:run
if defined RUNTIME_PATH if exist "%RUNTIME_PATH%" (
  set "ELECTRON_RUN_AS_NODE=1"
  "%RUNTIME_PATH%" --disable-warning=ExperimentalWarning "%ENTRY_PATH%" %*
  exit /b %ERRORLEVEL%
)

where node >nul 2>nul
if %ERRORLEVEL% EQU 0 (
  node --disable-warning=ExperimentalWarning "%ENTRY_PATH%" %*
  exit /b %ERRORLEVEL%
)

echo openweave runtime not found. Set OPENWEAVE_CLI_RUNTIME or install Node.js. 1>&2
exit /b 1
