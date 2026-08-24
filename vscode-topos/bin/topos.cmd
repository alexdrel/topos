@echo off
setlocal
if not defined TOPOS_RUNTIME set "TOPOS_RUNTIME={{TOPOS_RUNTIME}}"
if not defined TOPOS_SCRIPT set "TOPOS_SCRIPT={{TOPOS_SCRIPT}}"

if not exist "%TOPOS_RUNTIME%" (
  echo topos: extension runtime is unavailable; reload or reinstall the Topos extension 1>&2
  exit /b 1
)

if not exist "%TOPOS_SCRIPT%" (
  echo topos: extension CLI is unavailable; reload or reinstall the Topos extension 1>&2
  exit /b 1
)

set "ELECTRON_RUN_AS_NODE=1"
"%TOPOS_RUNTIME%" "%TOPOS_SCRIPT%" %*
exit /b %ERRORLEVEL%
