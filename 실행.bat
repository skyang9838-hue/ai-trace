@echo off
cd /d "%~dp0"
where python >nul 2>nul
if %errorlevel%==0 (
  start "AI TRACE server" /min python -m http.server 8765
  timeout /t 2 /nobreak >nul
  start "" http://localhost:8765/index.html
) else (
  start "" "%~dp0index.html"
)
