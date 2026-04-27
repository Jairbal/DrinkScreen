param(
  [string]$TaskName = "DrinkScreen"
)

$ErrorActionPreference = "Stop"

if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
  Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
  Write-Host "Tarea programada '$TaskName' eliminada."
} else {
  Write-Host "No existe una tarea llamada '$TaskName'."
}
