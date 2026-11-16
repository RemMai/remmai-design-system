@echo off
node "%~dp0scripts\bootstrap.mjs" %*
if not "%~1"=="" exit /b %errorlevel%
pause
