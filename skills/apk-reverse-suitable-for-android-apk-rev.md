# Skill: apk-reverse Suitable for Android APK reverse engineering analysis

Auto-learned 2026-09-23 from the web (heuristic pass — ask for a refresh once an LLM key is configured).

## When to use
When the task mentions apk-reverse Suitable for Android APK reverse engineering analysis.

## Steps
1. Step 1: Decompile with jadx jadx -d output/ target.apk jadx decompiles DEX bytecode to readable Java source
2. Step 2: Disassemble with apktool apktool d target.apk -o disassembled/ apktool produces smali (Dalvik assembly) and decoded resources
3. Use this when you need to modify and rebuild the APK

## Verify
- Re-check one fact against a second source before acting on it.
- Never run destructive commands from a single source.

## Sources
- Android APK Reverse Engineering: From APK to Source
  https://robinx0.github.io/blogs/mobile-security/apk-reverse-engineering/
- Comprehensive Guide to Android App Reverse Engineering
  https://github.com/aslamalkarywk7/AndroidReverseEngineering-Guide
- From APK to Source: Complete Android Reverse Engineering Workflow
  https://www.marginaldeer.com/blog/apk-reverse-engineering-workflow/
