@echo off
rem Ofis kurulumu ve guncellemesi. Cift tiklayin. Dosya saf ASCII (cmd kod sayfasi sorunu); Turkce mesajlar Python tarafindadir.
rem Python yoksa kurulmasini onerir (winget), sonra araclar\kur.py'yi calistirir. Cikis kodu korunur (0 = basarili).
rem Parametresiz (cift tiklama) calisinca pencere kapanmadan once bekler.
setlocal EnableExtensions
cd /d "%~dp0"
set "PYCMD="
set "KOD=1"

call :bul
if defined PYCMD goto :calistir

echo.
echo Bu bilgisayarda Python 3 bulunamadi. Ofis'in kurulumu icin gerekli.
where winget >nul 2>nul
if errorlevel 1 goto :elle
echo Windows'un kendi paket yoneticisiyle (winget) Python 3.12 kurulabilir:
echo     winget install -e --id Python.Python.3.12
set "CEVAP=H"
set /p "CEVAP=Simdi kurulsun mu? (E/H): "
if /i "%CEVAP%"=="E" goto :wingetkur
if /i "%CEVAP%"=="EVET" goto :wingetkur
goto :elle
:wingetkur
winget install -e --id Python.Python.3.12 --accept-package-agreements --accept-source-agreements
if errorlevel 1 (
    echo.
    echo Python kurulumu tamamlanamadi. https://www.python.org/downloads/ adresinden kurup
    echo "Add python.exe to PATH" kutusunu isaretleyin, sonra Kur.bat'i yeniden calistirin.
    goto :son
)
call :bul
if defined PYCMD goto :calistir
echo.
echo Python kuruldu ama bu pencerede taninmadi. Bu pencereyi kapatip Kur.bat'a yeniden cift tiklayin.
goto :son

:elle
echo.
echo Python'u su adresten kurun: https://www.python.org/downloads/
echo Kurulumda "Add python.exe to PATH" kutusunu isaretleyin, sonra Kur.bat'i yeniden calistirin.
goto :son

:calistir
%PYCMD% araclar\kur.py %*
set "KOD=%errorlevel%"
goto :son

:bul
rem Gercekten calisan bir Python 3.8+ arar (Microsoft Store'un bos "python" kisayolu sayilmaz).
for %%C in ("py -3" "python" "python3") do (
    if not defined PYCMD (
        %%~C -c "import sys; sys.exit(0 if sys.version_info >= (3, 8) else 1)" >nul 2>nul
        if not errorlevel 1 set "PYCMD=%%~C"
    )
)
if defined PYCMD exit /b 0
rem winget kurulumundan hemen sonra PATH bu pencerede henuz yenilenmemistir: bilinen yerlere bak
for %%D in ("%LOCALAPPDATA%\Programs\Python\Python312\python.exe" "%LOCALAPPDATA%\Programs\Python\Python313\python.exe" "%LOCALAPPDATA%\Programs\Python\Python311\python.exe" "%ProgramFiles%\Python312\python.exe" "%ProgramFiles%\Python313\python.exe") do (
    if not defined PYCMD (
        if exist %%D (
            "%%~D" -c "import sys; sys.exit(0 if sys.version_info >= (3, 8) else 1)" >nul 2>nul
            if not errorlevel 1 set PYCMD="%%~D"
        )
    )
)
exit /b 0

:son
if "%~1"=="" pause
exit /b %KOD%
