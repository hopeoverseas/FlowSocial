@echo off
setlocal
cd /d "%~dp0apps\flowsocial"
echo Starting FlowSocial with model preflight...
call npm.cmd run start
if errorlevel 1 (
  echo.
  echo FlowSocial did not start. Read the message above, fix the model service, and run this file again.
  pause
)
