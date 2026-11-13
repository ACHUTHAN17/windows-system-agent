# Running WinAgent on a Linux server

The server install runs the WinAgent control dashboard as a restartable user service. It is intentionally bound to `127.0.0.1:8080`: expose it only through an SSH tunnel or an authenticated reverse proxy you operate.

## Install

```bash
cd ~/winagent
mkdir -p ~/.config/systemd/user
cp deploy/server/winagent-dashboard.service ~/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user enable --now winagent-dashboard.service
systemctl --user status winagent-dashboard.service --no-pager
curl -fsS http://127.0.0.1:8080/api/status
```

Open it safely from your own computer with:

```bash
ssh -L 8080:127.0.0.1:8080 user@your-server
```

Then browse to `http://127.0.0.1:8080` locally. The dashboard supports chat tasks, live logs, stop, self-test, and one-time or always-allow approvals.

## Server capabilities and boundaries

- It runs the Linux implementations of WinAgent's file, process, shell, package, service, screenshot, and browser-related tools when the host provides the relevant binaries.
- It starts with its writable scope limited to `~/winagent`; normal file-system actions outside that folder are rejected.
- Every destructive action still needs dashboard approval. The service does not set `AUTO_YES` or `MCP_AUTO_YES`.
- It runs as the ordinary server user, with no `sudo`, root, kernel, BIOS, or cross-machine access. Package installation succeeds only when the server account already has the necessary privilege.
- The dashboard is loopback-only, so it must not be published directly to the internet.

For a command-line MCP client, run `node src/mcp-server.js` from a client process; MCP uses standard input/output and is not a network daemon.
