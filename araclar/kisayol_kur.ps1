# Ofis kisayolu (Windows): masaustu + Baslat menusune "Ofis" kurar; ofis.pyw'yi pythonw ile acar.
# Calistir: powershell -ExecutionPolicy Bypass -File araclar\kisayol_kur.ps1
# Not: PowerShell 5.1 icin dosya saf ASCII tutulur; yollar betigin konumundan hesaplanir.
$ErrorActionPreference = 'Stop'
$kok = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$hedef = Join-Path $kok 'ofis.pyw'
$ico = Join-Path $kok 'varliklar\ofis.ico'

$py = $null
foreach ($aday in @('pythonw.exe', 'pyw.exe')) {
    $k = Get-Command $aday -ErrorAction SilentlyContinue
    if ($k -and $k.Source -notmatch 'WindowsApps') { $py = $k.Source; break }
}
if (-not $py) {
    $yerel = Get-ChildItem "$env:LOCALAPPDATA\Programs\Python" -Filter pythonw.exe -Recurse -ErrorAction SilentlyContinue | Sort-Object FullName -Descending | Select-Object -First 1
    if ($yerel) { $py = $yerel.FullName }
}
if (-not $py) { Write-Host 'pythonw bulunamadi.' -ForegroundColor Yellow; exit 1 }

$sh = New-Object -ComObject WScript.Shell
foreach ($yer in @([Environment]::GetFolderPath('Desktop'), (Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs'))) {
    $s = $sh.CreateShortcut((Join-Path $yer 'Ofis.lnk'))
    $s.TargetPath = $py
    $s.Arguments = '"' + $hedef + '"'
    $s.WorkingDirectory = $kok
    if (Test-Path $ico) { $s.IconLocation = "$ico,0" }
    $s.Description = 'Ofis: ikinci beynin pikselli ofisi (gercek beyin sohbeti)'
    $s.Save()
    Write-Host ('Kuruldu: ' + (Join-Path $yer 'Ofis.lnk'))
}
Write-Host ('Python: ' + $py)
