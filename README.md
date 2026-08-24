# pi-wsl-clipboard

Paste the Windows clipboard into [Pi](https://pi.dev) when Pi runs inside WSL.

The extension owns `Ctrl+V` in Pi's editor. It checks the Windows clipboard for
an image first, then falls back to Windows clipboard text.

## Install

Install from npm after publication:

```bash
pi install npm:pi-wsl-clipboard
```

Install the local checkout while developing:

```bash
pi install ~/dev/pi/pi-wsl-clipboard
```

Restart Pi or run `/reload` after installing or changing the extension.

## Use

1. Copy text or an image in a Windows application.
2. Focus the Pi prompt running in WSL.
3. Press `Ctrl+V`.

Images are saved as temporary PNG files in WSL and inserted into the prompt.
Text is inserted directly into the prompt.

## Requirements

- WSL (WSL2 with WSLg works).
- `powershell.exe` or `pwsh.exe` available from WSL.
- `wslpath` available from WSL.
- A terminal that sends `Ctrl+V` to Pi instead of handling it as its own paste action.

For Windows Terminal, VS Code's integrated terminal, or another host terminal,
map `Ctrl+V` to send the control character `\u0016` when the terminal consumes
the key before Pi sees it. The extension cannot handle a key that never reaches
Pi.

## Pi keybindings

The extension registers `Ctrl+V` directly. To avoid running Pi's built-in image
paste action at the same time, disable that binding in
`~/.pi/agent/keybindings.json`:

```json
{
  "app.clipboard.pasteImage": []
}
```

Do not add `Ctrl+Shift+V`: it is not needed by this extension.

## Why this exists

On WSL, Linux clipboard tools can expose a different clipboard from the native
Windows clipboard. The image path in Pi has a Windows fallback, but text paste
can still read stale Linux clipboard data. This extension reads both clipboard
kinds from PowerShell so `Ctrl+V` behaves consistently.

## Development

```bash
npm install
npm run check
npm run pack:dry
```

The package contains only the extension source and public documentation. Tests
stay out of the published tarball.


## Release

Maintainers can find the npm and GitHub Actions release steps in
[RELEASING.md](RELEASING.md).
## License

[MIT](LICENSE)
