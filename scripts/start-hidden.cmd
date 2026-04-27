@echo off
timeout /t 15 /nobreak >nul
cd /d "C:\Users\USUARIO\Documents\DrinkScreen"
echo ==== %date% %time% ==== >> "C:\Users\USUARIO\Documents\DrinkScreen\logs\drinkscreen.log"
"C:\nvm4w\nodejs\node.exe" server.js >> "C:\Users\USUARIO\Documents\DrinkScreen\logs\drinkscreen.log" 2>&1
