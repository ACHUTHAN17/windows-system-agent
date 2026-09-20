# PowerShell Text Output (Echo)

## When to Use
Use when displaying messages, debugging variables, or returning pipeline data in PowerShell command-line interfaces or scripts.

## Methods

1. **Standard Pipeline Output (`Write-Output` / `echo`):**
   ```powershell
   Write-Output "Hello, World!"
   # Or using built-in alias:
   echo "Hello, World!"
   ```
   - Sends output to the PowerShell pipeline. Output can be piped to other cmdlets or captured in variables (e.g., `$val = Write-Output "Hello"`).

2. **Direct Console Output (`Write-Host`):**
   ```powershell
   Write-Host "Hello, World!"
   ```
   - Writes directly to the host console interface. Does not send data through the standard pipeline stream.

3. **Implicit Expression Output:**
   ```powershell
   "Hello, World!"
   ```

4. **Redirecting Output to a File:**
   ```powershell
   echo "Hello, World!" > log.txt
   ```

## Safety and Best Practices
- Prefer `Write-Output` (or implicit output) inside functions when return values are intended for downstream processing.
- Use `Write-Host` primarily for console UI messaging or when colored text output is explicitly needed (`-ForegroundColor`).