!macro StrContains mainStr subStr resultVar labelId
  Push $R2
  Push $R3
  Push $R4
  Push $R5
  
  StrLen $R2 "${subStr}"
  StrLen $R3 "${mainStr}"
  StrCpy $R4 0
  StrCpy ${resultVar} "false"
 
  loop_${labelId}:
    StrCpy $R5 "${mainStr}" $R2 $R4
    StrCmp $R5 "${subStr}" found_${labelId}
    IntOp $R4 $R4 + 1
    IntCmp $R4 $R3 loop_${labelId} loop_${labelId} found_${labelId}
    Goto done_${labelId}
 
  found_${labelId}:
    StrCpy ${resultVar} "true"
 
  done_${labelId}:
    Pop $R5
    Pop $R4
    Pop $R3
    Pop $R2
!macroend

!macro customInstall
  DetailPrint "Adding SafeVault to PATH..."
  ReadRegStr $0 HKCU "Environment" "PATH"
  
  ; Check if already in path to avoid duplicate entries
  !insertmacro StrContains $0 "$INSTDIR" $1 "pathcheck"
  
  StrCmp $1 "true" path_done
  
  ; Append directory to PATH
  WriteRegStr HKCU "Environment" "PATH" "$0;$INSTDIR"
  
  ; Broadcast settings change so terminal sees it instantly
  SendMessage 0xFFFF 0x001A 0 "STR:Environment" /TIMEOUT=5000
  
path_done:
!macroend
