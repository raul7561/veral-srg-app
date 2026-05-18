@echo off
start cmd /k "cd /d "%~dp0backend" && .venv\Scripts\activate && uvicorn app.main:app --reload"
start cmd /k "cd /d "%~dp0frontend" && npm run dev"
timeout /t 3 >nul
start "" "http://localhost:5173"