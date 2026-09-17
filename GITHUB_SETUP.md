# Push to GitHub (copy-paste, ~5 min, once per machine)

## 1. Install git + gh (Windows PowerShell — paste the whole block)

```powershell
winget install Git.Git -e --silent --accept-source-agreements --accept-package-agreements
winget install GitHub.cli -e --silent --accept-source-agreements --accept-package-agreements
```

Close and **reopen** the terminal (new installs only join PATH in new shells),
then verify — both lines must print versions, no red errors:

```powershell
git --version
gh --version
```

## 2. Log in (browser, 20 seconds — paste one line at a time)

```powershell
gh auth login --web --scopes "repo,read:org,workflow"
```

A code + link (`github.com/login/device`) appears — open it, enter the code,
click **Authorize**. Then wire git to it:

```powershell
gh auth setup-git --hostname github.com
```

If setup-git says "git not found", run this first and retry:

```powershell
$env:PATH += ";C:\Program Files\Git\cmd"
```

Proof both layers work (expect a hash, not an error):

```powershell
git ls-remote https://github.com/ACHUTHAN17/windows-system-agent.git HEAD
```

## 3. Push (every time — one line)

```bat
push.bat "describe the change"
```

That's add + commit + push in one step. First push in a folder also sets the
upstream, so later pushes are just `push.bat "msg"`.

## If the repo was created WITH a README (copy-paste fix)

GitHub's starter commit and yours share no history — join them once, keeping
your files, then push:

```powershell
git fetch origin
git merge origin/main --no-edit -X ours --allow-unrelated-histories
git push -u origin main
```

## If push says "Repository not found"

That means "no access with this identity", not "no repo". Fix identity, don't
retry blindly: `gh auth status` must show an account that owns (or
collaborates on) the repo — otherwise log in as the right account
(`gh auth login`) or get added via repo Settings → Collaborators.
