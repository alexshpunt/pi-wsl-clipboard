import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, posix } from "node:path";

const POWERSHELL_TIMEOUT_MS = 5000;
const WSLPATH_TIMEOUT_MS = 1000;
const MAX_CLIPBOARD_BYTES = 50 * 1024 * 1024;

/** The small part of a child-process result used by the clipboard bridge. */
export interface CommandResult {
  status: number | null;
  stdout: Buffer | string | null;
  error?: Error;
}

/** A command runner used by the bridge and replaceable in tests. */
export type CommandRunner = (
  command: string,
  args: string[],
  options: { timeout: number; maxBuffer?: number },
) => CommandResult;

/** The clipboard operations needed by the Pi shortcut handler. */
export interface ClipboardBridge {
  readImage(): string | null;
  readText(): string | null;
}

/** The result of one clipboard paste attempt. */
export type PasteResult = "image" | "text" | "empty";

const runCommand: CommandRunner = (command, args, options) => {
  const result = spawnSync(command, args, options);
  return {
    status: result.status,
    stdout: result.stdout,
    error: result.error,
  };
};

function outputBuffer(result: CommandResult): Buffer {
  if (Buffer.isBuffer(result.stdout)) return result.stdout;
  return Buffer.from(result.stdout ?? "");
}

function outputText(result: CommandResult): string {
  return outputBuffer(result).toString("utf8");
}

function runPowerShell(script: string, runner: CommandRunner): Buffer | null {
  for (const executable of ["powershell.exe", "pwsh.exe"]) {
    const result = runner(executable, ["-NoProfile", "-STA", "-Command", script], {
      timeout: POWERSHELL_TIMEOUT_MS,
      maxBuffer: MAX_CLIPBOARD_BYTES,
    });
    if (!result.error && result.status === 0) return outputBuffer(result);
  }
  return null;
}

function removeFile(path: string): void {
  try {
    unlinkSync(path);
  } catch {
    // The file may not have been created.
  }
}

/**
 * Create a bridge to the native Windows clipboard from WSL or native Windows.
 *
 * The optional runner and platform are public so the PowerShell boundary can
 * be tested without requiring a Windows host.
 */
export function createWindowsClipboardBridge(
  runner: CommandRunner = runCommand,
  fileExists: (path: string) => boolean = existsSync,
  temporaryDirectory: string = tmpdir(),
  platform: NodeJS.Platform = process.platform,
): ClipboardBridge {
  return {
    readImage(): string | null {
      const filePath = platform === "win32"
        ? join(temporaryDirectory, `pi-wsl-clipboard-${randomUUID()}.png`)
        : posix.join(temporaryDirectory, `pi-wsl-clipboard-${randomUUID()}.png`);
      const windowsPathResult = platform === "win32"
        ? { status: 0, stdout: filePath, error: undefined }
        : runner("wslpath", ["-w", filePath], { timeout: WSLPATH_TIMEOUT_MS });
      if (windowsPathResult.error || windowsPathResult.status !== 0) return null;

      const escapedPath = outputText(windowsPathResult).trim().replaceAll("'", "''");
      const script = [
        "$ErrorActionPreference = 'Stop'",
        "Add-Type -AssemblyName System.Windows.Forms",
        "Add-Type -AssemblyName System.Drawing",
        `$path = '${escapedPath}'`,
        "$image = [System.Windows.Forms.Clipboard]::GetImage()",
        "if ($image) { $image.Save($path, [System.Drawing.Imaging.ImageFormat]::Png); $image.Dispose(); [Console]::Write('ok') } else { [Console]::Write('empty') }",
      ].join("; ");
      const result = runPowerShell(script, runner);
      if (!result || result.toString("utf8").trim() !== "ok" || !fileExists(filePath)) {
        removeFile(filePath);
        return null;
      }
      return filePath;
    },

    readText(): string | null {
      const script = [
        "$utf8 = New-Object System.Text.UTF8Encoding($false)",
        "[Console]::OutputEncoding = $utf8",
        "$OutputEncoding = $utf8",
        "$text = Get-Clipboard -Raw -ErrorAction SilentlyContinue",
        "if ($null -ne $text) { [Console]::Write($text) }",
      ].join("; ");
      const result = runPowerShell(script, runner);
      if (!result) return null;
      const text = result.toString("utf8");
      return text.length > 0 ? text : null;
    },
  };
}

/**
 * Paste an image when one exists, otherwise paste clipboard text.
 *
 * Image-first ordering prevents an image's fallback text representation from
 * being inserted into the editor.
 */
export function pasteClipboard(
  clipboard: ClipboardBridge,
  paste: (value: string) => void,
): PasteResult {
  const imagePath = clipboard.readImage();
  if (imagePath) {
    paste(imagePath);
    return "image";
  }

  const text = clipboard.readText();
  if (text) {
    paste(text);
    return "text";
  }

  return "empty";
}

/** Return true when the current process is running under WSL. */
export function isWsl(): boolean {
  if (process.env.WSL_DISTRO_NAME || process.env.WSLENV) return true;
  try {
    return /microsoft|wsl/i.test(readFileSync("/proc/version", "utf8"));
  } catch {
    return false;
  }
}
