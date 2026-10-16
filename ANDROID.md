# Android control

WinAgent uses one agent loop and the same tool names across Windows, Linux/macOS,
and Android. Android is exposed through an optional bridge because a desktop
process cannot access an Android phone's private storage or UI by magic.

## Run inside Termux

Install Node.js and the Termux:API companion app, then install its package:

```sh
pkg install nodejs
pkg install termux-api
termux-setup-storage
node src/index.js
```

The GitHub release also includes `WinAgent-Android-Termux-<version>.zip` and
`.tar.gz`. Extract the bundle in Termux and run `./termux-install.sh`; this is
the supported phone package and does not require an API key or local LLM.

The agent can use Android app launch/open, screenshots, taps, swipes, keyboard
input, clipboard, package listing, and the normal file/shell tools. Shared
storage is exposed under `~/storage/` after `termux-setup-storage`.

## Control a phone from Windows/Linux/macOS with adb

Enable USB debugging (or pair wireless debugging), install platform-tools, and
set the device serial before starting WinAgent:

```powershell
$env:ANDROID_SERIAL = "DEVICE_SERIAL"
node src/index.js "open the Android settings"
```

The same works in bash with `export ANDROID_SERIAL=DEVICE_SERIAL`. The first
request should be `check Android status`; it must report `state=device` before
UI actions can run. Android private app data remains protected by Android's own
permissions; WinAgent does not bypass the OS or root a device.

## Capability contract

The model decides whether a request is LOCAL, AGENT, or IMAGE before acting.
LOCAL Android actions are routed directly to the bridge without an LLM call.
Multi-step tasks use the normal planner/tool loop, memory, skills, verification,
and audit trail. Bridge credentials and device-specific session data must never
be committed to GitHub.
