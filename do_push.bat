@echo off
cd /d "C:\Users\GotHi\alibi-repo-deploy"
echo === FETCHING REMOTE ===
"C:\Program Files\Git\cmd\git.exe" fetch origin
echo.
echo === PULLING REBASE ===
"C:\Program Files\Git\cmd\git.exe" pull --rebase origin main
echo.
echo === ADDING ALL ===
"C:\Program Files\Git\cmd\git.exe" add -A
echo.
echo === COMMITTING ===
"C:\Program Files\Git\cmd\git.exe" commit -m "04-16-26 deploy: v19 app fixes, live_apex clean, all pages updated" --allow-empty
echo.
echo === PUSHING ===
"C:\Program Files\Git\cmd\git.exe" push origin main
echo.
echo === LOG (last 3) ===
"C:\Program Files\Git\cmd\git.exe" log --oneline -3
echo.
echo === DONE ===
