# Skill: php2shell-checker

Auto-learned 2026-10-23 from the web (heuristic pass — ask for a refresh once an LLM key is configured).

## When to use
When the task mentions php2shell-checker.

## Steps
1. Run it in your own pipeline on as many sites as you need
2. How to find your PHP version, and which versions are still supported Emergency patch: 21 Oct 2026 SEVERITY (CVSS v4.0) 9.2 / 10 · CRITICAL Know someone who runs a website? Most owners have no idea which PHP version they are on
3. Then get one review and one price for the whole lot
4. To see the version the web server uses, check the PHP-FPM service, for example php-fpm -v or the versioned binary such as php-fpm8.3 -v
5. Step 3: update and restart Install the update through your package manager or hosting panel, then restart every PHP worker
6. Set session.upload_progress.enabled=0 in php.ini or the FPM pool configuration (not through ini_set() or .user.ini ), and on PHP 8.5 also fatal_error_backtraces=0 , then restart the workers
7. Step 4: check whether you were hit Exploitation attempts were recorded before the fixes were public, so a server that was exposed before patching should be checked

## Verify
- Re-check one fact against a second source before acting on it.
- Never run destructive commands from a single source.

## Sources
- PHP2Shell checker: free website and PHP version check
  https://php2shell.uk/checker
- PHP2Shell checker: is your site exposed? Free check · Kyle Clouthier
  https://simgen.dev/php-patch-check/
- PHP2Shell: How to Check Whether Your Server Is Vulnerable and Patch It
  https://cybersecurityasean.com/learning-guides/php2shell-how-to-check-and-patch
