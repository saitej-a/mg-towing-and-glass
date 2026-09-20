@echo off
rem ============================================================
rem  MG Towing & Glass Services - local preview launcher
rem  Double-click this file to view the site with 3D enabled.
rem  (Opening index.html directly blocks ES modules, which is
rem   why the 3D truck did not appear.)
rem ============================================================
title MG Towing - Local Preview
cd /d "C:\Users\Sai Teja Ankam\Downloads\preview.themeforest.net2"

echo Starting local server on http://localhost:8742 ...
start "MG-Towing-Server" /min node server.cjs

timeout /t 2 /nobreak >nul
start "" "http://localhost:8742"

echo.
echo  Site is open in your browser:  http://localhost:8742
echo  Keep this window open while viewing the site.
echo  Close the minimized "MG-Towing-Server" window to stop.
echo.
pause
