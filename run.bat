@echo off
echo ========================================
echo   راه‌اندازی مهاجرت‌یاب (Backend + Frontend)
echo ========================================
echo.

:: اجرای بک‌اند در یک پنجره جدید
start "Backend" cmd /k "cd /d F:\migration_analysis\backend && python main.py"

:: صبر ۳ ثانیه تا بک‌اند بالا بیاید
timeout /t 3 /nobreak >nul

:: اجرای فرانت‌ند در همان پنجره
echo Starting Frontend on http://localhost:5500
python -m http.server 5500

pause