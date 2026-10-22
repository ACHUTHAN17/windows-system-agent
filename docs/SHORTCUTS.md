# WinAgent shortcut profiles

WinAgent interprets a shortcut only in the context of the target operating
system. It does not claim that a Windows shortcut has the same effect on macOS,
Linux, or Android. Application-specific shortcuts remain application-defined
and may be customized by the user.

## Windows

`Win+L` lock session; `Win+I` Settings; `Win+D` show desktop; `Win+E` File
Explorer; `Win+R` Run; `Win+S` Search; `Win+M` minimize all; `Win+Tab` Task
View; `Win+Shift+S` screen snipping; `Alt+Tab` switch app; `Alt+F4` close
focused window; `Ctrl+S` Save; `Ctrl+Shift+S` Save As.

Windows also accepts normal focused-app actions such as `Ctrl+C`, `Ctrl+V`,
`Ctrl+X`, `Ctrl+A`, `Ctrl+Z`, `Ctrl+P`, `Ctrl+N`, function keys, arrows, Tab,
Enter, Escape, and supported media keys. Refer to Microsoft's full reference:
https://support.microsoft.com/windows/keyboard-shortcuts-in-windows-dcc61a57-8ff0-cffe-9796-cb9706c75eec

## macOS

`Command+C/V/X/Z`, `Shift+Command+Z`, `Command+A/S/W/Q`, `Command+Space`,
`Command+Tab`, `Option+Command+Esc`, `Shift+Command+3`, and
`Shift+Command+4` have explicit meanings. WinAgent maps `Cmd`, `Command`, and
the Windows key on a PC keyboard to `Command` for this profile.

macOS must grant the WinAgent app Accessibility permission before it can send
input. The complete Apple reference is:
https://support.apple.com/en-us/102650

## GNOME/Linux

The GNOME profile recognizes `Super+L`, `Super+A`, `Super+Tab`, `Super+V`,
`Super+PageUp`, `Super+PageDown`, `Alt+F2`, `Alt+F4`, `Ctrl+Alt+Delete`, and
Print Screen. Linux desktop environments can rebind these shortcuts; this list
is specifically for GNOME defaults.

Input injection works through `xdotool` on X11. Pure Wayland deliberately
returns an actionable setup error instead of pretending the shortcut ran; use
a compositor-approved bridge such as ydotool. GNOME's reference:
https://help.gnome.org/gnome-help/shell-keyboard-shortcuts.html

## Android

With Termux:API or an authorized ADB device, WinAgent supports Android-native
Home, Back, Recent Apps, Power, volume, navigation keys, text input, taps and
swipes. Modifier chords such as `Ctrl+S` are not sent through the current ADB
bridge because device keyboards and applications interpret them differently.
Android's key codes and meta states are device/input-source specific:
https://developer.android.com/reference/android/view/KeyEvent
