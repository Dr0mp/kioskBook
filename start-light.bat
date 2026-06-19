@echo off
echo Book (light) -- starting local server at http://localhost:8081/book-light.html
echo Press Ctrl+C to stop.
echo.
start "Browser opener" cmd /k "timeout /t 2 /nobreak >nul && start http://localhost:8081/book-light.html"

if exist "%~dp0python313\python.exe" "%~dp0python313\python.exe" -m http.server 8081 && goto done
python  --version >nul 2>&1 && python  -m http.server 8081 && goto done
python3 --version >nul 2>&1 && python3 -m http.server 8081 && goto done
node    --version >nul 2>&1 && npx serve -l 8081 .         && goto done

echo No Python or Node found. Falling back to PowerShell server...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0server.ps1" -Port 8081

:done
pause
