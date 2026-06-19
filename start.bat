@echo off
echo 3D Book Viewer -- starting local server at http://localhost:8080
echo Press Ctrl+C to stop.
echo.
start "Browser opener" cmd /k "timeout /t 2 /nobreak >nul && start http://localhost:8080"

REM All options below are fully offline (no downloads). Bundled Python first;
REM otherwise the built-in Windows PowerShell server.
if exist "%~dp0python313\python.exe" "%~dp0python313\python.exe" -m http.server 8080 && goto done
python  --version >nul 2>&1 && python  -m http.server 8080 && goto done
python3 --version >nul 2>&1 && python3 -m http.server 8080 && goto done

echo Using built-in PowerShell server...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0server.ps1" -Port 8080

:done
pause
