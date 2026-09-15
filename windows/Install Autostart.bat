@echo off
title Install NEWS MEVA Autostart
cd /d "%~dp0"

set "STARTUP_DIR=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "LNK=%STARTUP_DIR%\NEWS MEVA.lnk"

powershell -NoProfile -Command "$ws = New-Object -ComObject WScript.Shell; $sc = $ws.CreateShortcut('%LNK%'); $sc.TargetPath = 'wscript.exe'; $q = [char]34; $sc.Arguments = $q + '%~dp0Start Server Hidden.vbs' + $q; $sc.WorkingDirectory = '%~dp0'; $sc.Description = 'NEWS MEVA server'; $sc.Save()"

if errorlevel 1 (
  echo.
  echo FAILED to install autostart.
) else (
  echo.
  echo Autostart installed. The server will start silently at every login.
  echo It starts on http://localhost:3002 and is also reachable over LAN.
)
pause
