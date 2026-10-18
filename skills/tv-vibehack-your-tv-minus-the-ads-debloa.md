# Skill: tv-vibehack Your TV, minus the ads. Debloat any Android TV over ADB and give it a clean, tvOS-inspired launcher. Built i

Auto-learned 2026-10-18 from the web (heuristic pass — ask for a refresh once an LLM key is configured).

## When to use
When the task mentions tv-vibehack Your TV, minus the ads. Debloat any Android TV over ADB and give it a clean, tvOS-inspired launcher. Built i.

## Steps
1. Disable the manufacturer's telemetry, ad services, content rows and preloaded junk with pm disable-user
2. Install a small native launcher and make it the default home screen
3. Open Claude Code (or your assistant of choice) on your computer and paste the prompt from PROMPT.md , filling in your TV model
4. Press Down and the dock slides up to reveal the rest of your apps in a grid
5. Run one per shell call; --batch does this
6. Disable the stock launcher only after the new one is installed , or the Home button lands on a factory test app
7. Enable ADB on the TV Settings → System → About → press Build 7 times
8. Then Settings → System → Developer options → enable USB debugging and Network debugging (may be called "ADB

## Verify
- Re-check one fact against a second source before acting on it.
- Never run destructive commands from a single source.

## Sources
- GitHub - Gathin23/tv-vibehack: Your TV, minus the ads. Debloat any ...
  https://github.com/Gathin23/tv-vibehack
- tv-vibehack Your TV, minus the ads. Debloat an @codeKK AndroidOpen ...
  https://p.codekk.com/detail/Android/Gathin23/tv-vibehack
- GitHub - ohernandezdev/android-tv-tune: Debloat and speed up any ...
  https://github.com/ohernandezdev/android-tv-tune
