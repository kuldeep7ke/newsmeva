@echo off
title Remove NEWS MEVA Autostart
set "LNK=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\NEWS MEVA.lnk"
if exist "%LNK%" (
  del "%LNK%"
  echo Autostart removed.
) else (
  echo No autostart entry found.
)
pause
