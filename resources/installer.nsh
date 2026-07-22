!macro customInstall
  DetailPrint "Adding SafeVault to PATH..."
  ReadRegStr $0 HKCU "Environment" "PATH"
  
  ; Check if already in path to avoid duplicate entries
  Push $0
  Push "$INSTDIR"
  Call StrContains
  Pop $1
  
  StrCmp $1 "true" path_done
  
  ; Append directory to PATH
  WriteRegStr HKCU "Environment" "PATH" "$0;$INSTDIR"
  
  ; Broadcast settings change so terminal sees it instantly
  SendMessage 0x001A 0 "STR:Environment" /TIMEOUT=5000
  
path_done:
!macroend

; Helper function to check if string contains substring
Function StrContains
  Exch $R0 ; Substring
  Exch
  Exch $R1 ; Main string
  Push $R2
  Push $R3
  Push $R4
  Push $R5
 
  StrLen $R2 $R0
  StrLen $R3 $R1
  StrCpy $R4 0
 
  loop:
    StrCpy $R5 $R1 $R2 $R4
    StrCmp $R5 $R0 found
    IntOp $R4 $R4 + 1
    IntCmp $R4 $R3 loop loop found
 
  not_found:
    StrCpy $R0 "false"
    Goto done
 
  found:
    StrCpy $R0 "true"
 
  done:
    Pop $R5
    Pop $R4
    Pop $R3
    Pop $R2
    Pop $R1
    Exch $R0
FunctionEnd
