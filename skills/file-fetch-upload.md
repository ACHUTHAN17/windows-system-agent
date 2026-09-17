# Skill: file-fetch-upload — fetch ANY file (even locked/in-use) and upload it

File Manager parity: if Explorer can see it, you can fetch it. Locked SQLite
stores (browser Cookies/History/Login Data), open documents, live databases.

## Fetch (in-harness: `win_file_fetch`, standalone: `file_fetch`)
1. Normal copy first (`file_copy`). On sharing-violation (error 32 / EBUSY):
2. `robocopy <dir> <tmpdir> <file> /B /R:1 /W:1` — backup mode reads through
   file locks (needs the session's admin rights; silent, no UI).
3. Fallback: Volume Shadow Copy (`vssadmin create shadow /for=C:` → copy from
   `\\?\GLOBALROOT\...` → delete shadow). Needs free disk + elevation.
4. Move the copy out with a unique name (`ck-<profile>.db`), never work in place.

## Read what you fetched
- SQLite: Node `node:sqlite` (`DatabaseSync`, read-only queries) for
  Cookies/History/Login Data copies. Chrome/Edge encrypt secret VALUES:
  unwrap `Local State` → `os_crypt.encrypted_key` (DPAPI `ProtectedData.Unprotect`,
  CurrentUser scope) → AES-256-GCM decrypt `v10/v11` blobs (nonce = bytes 3..15).
- Never log secrets: report metadata only (names, lengths, expiries).

## Upload (GitHub in mind, works for any API)
- Prefer `git push` (Credential Manager auth, silent). No git? No token?
  GitHub REST/GraphQL via `web_post`-style calls: blobs → trees → commit → ref.
- Private repos: 404 means missing OR no access — distinguish by checking the
  authenticated user first (`GET /user`), then request access or switch identity.
- After push: verify via API (`GET /repos/{o}/{r}`, compare SHAs), report the URL.

Safety: fetched copies contain secrets — keep them in `%TEMP%`, delete after use,
never commit (`*.db`, `Cookies*` are gitignored). Uploads: confirm repo URL +
branch before the first push of a session.
