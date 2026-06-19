@echo off
echo 3D Book Viewer -- starting local server at http://localhost:8080
echo Press Ctrl+C to stop.
echo.
start "Browser opener" cmd /k "timeout /t 2 /nobreak >nul && start http://localhost:8080"

if exist "%~dp0python313\python.exe" "%~dp0python313\python.exe" -m http.server 8080 && goto done
python  --version >nul 2>&1 && python  -m http.server 8080 && goto done
python3 --version >nul 2>&1 && python3 -m http.server 8080 && goto done
node    --version >nul 2>&1 && npx serve -l 8080 .         && goto done

echo No Python or Node found. Falling back to PowerShell server...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0server.ps1"

:done
pause
