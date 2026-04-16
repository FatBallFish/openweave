@echo off
setlocal
pushd "%~dp0\.."
node deploy\package-release.mjs windows
set EXIT_CODE=%ERRORLEVEL%
popd
exit /b %EXIT_CODE%
