@echo off
title S2C
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo   S2C icin Node.js gerekli. https://nodejs.org adresinden LTS surumunu kurup tekrar dene.
  echo.
  pause
  exit /b 1
)
node scripts\launch.mjs
if errorlevel 1 pause
