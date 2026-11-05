# Skill: Alpine Linux Security advisory: OpenSSH-server password authentication bypass

Auto-learned 2026-11-05 from the web (heuristic pass — ask for a refresh once an LLM key is configured).

## When to use
When the task mentions Alpine Linux Security advisory: OpenSSH-server password authentication bypass.

## Steps
1. To undo, delete /etc/ssh/sshd_config.d/00-no-passwords.conf and copy /etc/ssh/sshd_config.bak back over /etc/ssh/sshd_config
2. How to mitigate the threat Update and restart sshd
3. Run apk upgrade -U -a , then rc-service sshd restart
4. Disable password logins if you can’t update yet : set PasswordAuthentication no in your sshd configuration and restart sshd
5. How to check if you were attacked Run these two commands on any exposed machine
6. First make sure your SSH key login works, and keep your current session open until a new login succeeds
7. Then set PasswordAuthentication no , check the configuration with

## Verify
- Re-check one fact against a second source before acting on it.
- Never run destructive commands from a single source.

## Sources
- Security advisory: openssh-server password authentication bypass ...
  https://alpinelinux.org/posts/2026-11-05-openssh-password-authentication-bypass/
- Critical vulnerability: OpenSSH authentication bypass on Alpine Linux
  https://blog.detectify.com/product-updates/critical-vulnerability-openssh-authentication-bypass-on-alpine-linux/
- OpenSSH Issues Emergency Fix for Flaw Letting Long Passwords Bypass SSH ...
  https://thehackernews.com/2026/11/openssh-issues-emergency-fix-for-flaw.html
