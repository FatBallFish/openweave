# Windows Runtime Probe

This probe validates the runtime topology that the MVP tech design depends on for future Windows preview support:

- Electron `utilityProcess`
- `MessageChannelMain` / `process.parentPort`
- `node-pty` loaded only inside the worker process
- A PTY smoke command that emits `OPENWEAVE_PTY_OK`

## Why it exists

The main MVP implementation plan focuses on the macOS-first app shell and Portal PoC. This probe stays isolated so Windows runtime validation can move in parallel without touching the production app scaffold.

## Commands

```bash
npm install
npm test
npm run smoke
```

## Windows target behavior

On Windows the worker uses:

- `powershell.exe`
- `-NoLogo -NoProfile -Command`
- `Write-Output 'OPENWEAVE_PTY_OK'; exit 0`

On macOS/Linux the worker falls back to the current shell and runs a POSIX `printf` smoke command so the topology can be verified locally before a real Windows host is available.
