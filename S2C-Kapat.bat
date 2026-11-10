@echo off
title S2C kapat
for /f "tokens=5" %%p in ('netstat -ano ^| findstr /r /c:":5199 .*LISTENING"') do taskkill /pid %%p /f >nul 2>nul
echo   S2C kapatildi.
timeout /t 2 >nul
