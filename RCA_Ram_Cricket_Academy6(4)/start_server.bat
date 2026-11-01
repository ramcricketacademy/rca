@echo off
title RCA (Ram Cricket Academy) - Local Server
echo ========================================================
echo   Launching RCA (RAM CRICKET ACADEMY) Demo Server
echo ========================================================
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0server.ps1"
pause
