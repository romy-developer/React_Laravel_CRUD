@echo off
setlocal
set "PROJECT_DIR=%~dp0"
set "UPLOAD_TMP=%PROJECT_DIR%storage\framework\uploads"
set "ROUTER=%PROJECT_DIR%vendor\laravel\framework\src\Illuminate\Foundation\resources\server.php"

if exist "D:\xampp\php\php.exe" (
    set "PHP_EXE=D:\xampp\php\php.exe"
) else (
    set "PHP_EXE=php"
)

if not exist "%ROUTER%" (
    echo Laravel dependencies are missing. Run composer install from the backend folder first.
    exit /b 1
)

if not exist "%UPLOAD_TMP%" mkdir "%UPLOAD_TMP%"
echo Laravel API: http://127.0.0.1:8000
echo PHP upload temp: %UPLOAD_TMP%
cd /d "%PROJECT_DIR%public"
"%PHP_EXE%" -d "upload_tmp_dir=%UPLOAD_TMP%" -S 127.0.0.1:8000 "%ROUTER%"
endlocal
