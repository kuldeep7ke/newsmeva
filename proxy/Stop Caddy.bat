@echo off
title NEWS MEVA - Stop Caddy
taskkill /im caddy.exe /f >nul 2>nul
echo Caddy stopped.
pause
