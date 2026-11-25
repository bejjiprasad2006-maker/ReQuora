@echo off
cd /d "%~dp0"
npx --yes --package=node@24 --call "npm run dev"
pause
