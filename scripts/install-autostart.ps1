param(
  [string]$TaskName = "DrinkScreen",
  [switch]$AtStartup
)

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$logsDir = Join-Path $projectRoot "logs"
$startCmd = Join-Path $PSScriptRoot "start-hidden.cmd"
$launcherVbs = Join-Path $PSScriptRoot "launch-drinkscreen.vbs"
$nodePath = (Get-Command node -ErrorAction Stop).Source
$wscriptPath = Join-Path $env:WINDIR "System32\wscript.exe"
$cmdExe = $env:ComSpec

New-Item -ItemType Directory -Force -Path $logsDir | Out-Null

$cmdContent = @"
@echo off
timeout /t 15 /nobreak >nul
cd /d "$projectRoot"
echo ==== %date% %time% ==== >> "$logsDir\drinkscreen.log"
"$nodePath" server.js >> "$logsDir\drinkscreen.log" 2>&1
"@

Set-Content -Path $startCmd -Value $cmdContent -Encoding ASCII

$trigger = if ($AtStartup) {
  New-ScheduledTaskTrigger -AtStartup
} else {
  New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
}
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries

if ($AtStartup) {
  $action = New-ScheduledTaskAction -Execute $cmdExe -Argument "/c `"$startCmd`""
  $principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
} else {
  $action = New-ScheduledTaskAction -Execute $wscriptPath -Argument "`"$launcherVbs`""
  $principal = $null
}

$description = if ($AtStartup) {
  "Inicia DrinkScreen de forma silenciosa al arrancar Windows."
} else {
  "Inicia DrinkScreen de forma silenciosa al iniciar sesion."
}

if ($principal) {
  Register-ScheduledTask `
    -TaskName $TaskName `
    -Action $action `
    -Trigger $trigger `
    -Settings $settings `
    -Principal $principal `
    -Description $description `
    -Force | Out-Null
} else {
  Register-ScheduledTask `
    -TaskName $TaskName `
    -Action $action `
    -Trigger $trigger `
    -Settings $settings `
    -Description $description `
    -Force | Out-Null
}

Write-Host "Tarea programada '$TaskName' creada correctamente."
Write-Host "Nodo detectado en: $nodePath"
Write-Host "Lanzador silencioso: $launcherVbs"
Write-Host ("Modo: " + $(if ($AtStartup) { "arranque del sistema" } else { "inicio de sesion" }))
