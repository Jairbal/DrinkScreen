Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
cmdPath = fso.BuildPath(scriptDir, "start-hidden.cmd")

If fso.FileExists(cmdPath) Then
  shell.Run """" & cmdPath & """", 0, False
Else
  MsgBox "No se encontro start-hidden.cmd. Ejecuta install-autostart.ps1 primero.", 48, "DrinkScreen"
End If
