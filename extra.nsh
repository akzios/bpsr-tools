; Custom NSIS script for BPSR Tools installer
; This ensures proper cleanup of AppData on uninstall

; Custom uninstall macro - executed during uninstallation
!macro customUnInstall
  ; Remove application data directory from user's AppData\Roaming
  ; This includes logs, settings, and cached data
  RMDir /r "$APPDATA\bpsr-tools"

  ; Also remove from Local AppData if any cache exists there
  RMDir /r "$LOCALAPPDATA\bpsr-tools"
!macroend
