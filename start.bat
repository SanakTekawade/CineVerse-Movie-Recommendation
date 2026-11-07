@echo off
setlocal
cd /d "%~dp0"

echo =================================================================
echo [CineVerse] Starting NLP Movie Recommendation System...
echo =================================================================

:: Add Python directories to PATH
set "PATH=C:\Users\sanak\AppData\Local\Python\bin;C:\Users\sanak\AppData\Local\Python\pythoncore-3.14-64;%PATH%"

:: Check if Python runs
python -c "import sys; sys.exit(0)" >nul 2>nul
if %errorlevel% equ 0 (
    python run.py
) else (
    "C:\Users\sanak\AppData\Local\Python\pythoncore-3.14-64\python.exe" run.py
)

pause

