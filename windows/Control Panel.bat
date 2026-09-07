@echo off
title NEWS MEVA Control Panel
powershell -NoProfile -ExecutionPolicy Bypass -Sta -WindowStyle Hidden -File "%~dp0Control Panel.ps1"
exit /b 0