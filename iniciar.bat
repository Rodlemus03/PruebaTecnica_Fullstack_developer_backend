@echo off
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Necesitas instalar Node.js 22.22 o superior: https://nodejs.org
  pause
  exit /b 1
)

node scripts\runLocal.js
if errorlevel 1 pause
