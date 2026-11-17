@echo off
REM Local end-to-end check for dsh-view-switcher against a throwaway DSH profile.
REM
REM The profile in ..\.test-home is created once by:
REM   set "DSH_HOME=D:\DSHplugin\.test-home"
REM   dsh plugin --profile web add D:\DSHplugin
REM It links this package into a real DSH web profile, so `dsh web` boots the
REM plugin exactly like a user install would.
REM
REM Usage:  test\dev-server.cmd
REM Boot writes only inside the project (never the real ~/.dsh profile).
setlocal
cd /d "%~dp0.."
set "DSH_HOME=%~dp0..\.test-home"
dsh web --port 0 --no-open
