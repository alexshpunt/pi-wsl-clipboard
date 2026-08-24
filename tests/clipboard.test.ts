import assert from "node:assert/strict";
import test from "node:test";
import { createWindowsClipboardBridge, pasteClipboard, type CommandResult } from "../src/clipboard.ts";

function fakeRunner(results: CommandResult[]) {
  const calls: Array<{ command: string; args: string[] }> = [];
  return {
    calls,
    run(command: string, args: string[]): CommandResult {
      calls.push({ command, args });
      return results.shift() ?? { status: 1, stdout: null };
    },
  };
}

test("prefers an image over clipboard text", () => {
  const pasted: string[] = [];
  const result = pasteClipboard(
    {
      readImage: () => "/tmp/clipboard.png",
      readText: () => "should not be used",
    },
    (value) => pasted.push(value),
  );

  assert.equal(result, "image");
  assert.deepEqual(pasted, ["/tmp/clipboard.png"]);
});

test("falls back to text when no image is available", () => {
  const pasted: string[] = [];
  const result = pasteClipboard(
    {
      readImage: () => null,
      readText: () => "Windows text",
    },
    (value) => pasted.push(value),
  );

  assert.equal(result, "text");
  assert.deepEqual(pasted, ["Windows text"]);
});

test("does not paste when both clipboard readers are empty", () => {
  const pasted: string[] = [];
  const result = pasteClipboard(
    { readImage: () => null, readText: () => null },
    (value) => pasted.push(value),
  );

  assert.equal(result, "empty");
  assert.deepEqual(pasted, []);
});

test("reads Windows clipboard text through PowerShell", () => {
  const runner = fakeRunner([
    { status: 0, stdout: Buffer.from("Windows text") },
  ]);
  const bridge = createWindowsClipboardBridge(runner.run, () => false, "/tmp");

  assert.equal(bridge.readText(), "Windows text");
  assert.equal(runner.calls[0]?.command, "powershell.exe");
  assert.match(runner.calls[0]?.args.at(-1) ?? "", /Get-Clipboard -Raw/);
});

test("reads an image through WSL path conversion and PowerShell", () => {
  const runner = fakeRunner([
    { status: 0, stdout: "C:\\tmp\\clipboard.png\n" },
    { status: 0, stdout: "ok" },
  ]);
  const bridge = createWindowsClipboardBridge(runner.run, () => true, "/tmp", "linux");

  const imagePath = bridge.readImage();
  assert.match(imagePath ?? "", /^\/tmp\/pi-wsl-clipboard-/);
  assert.deepEqual(runner.calls.map((call) => call.command), ["wslpath", "powershell.exe"]);
  assert.match(runner.calls[1]?.args.at(-1) ?? "", /Clipboard\]::GetImage/);
});

test("reads an image without WSL path conversion on native Windows", () => {
  const runner = fakeRunner([{ status: 0, stdout: "ok" }]);
  const bridge = createWindowsClipboardBridge(runner.run, () => true, "C:\\Temp", "win32");

  const imagePath = bridge.readImage();

  assert.match(imagePath ?? "", /^C:\\Temp\\pi-wsl-clipboard-/);
  assert.deepEqual(runner.calls.map((call) => call.command), ["powershell.exe"]);
  assert.match(runner.calls[0]?.args.at(-1) ?? "", /Clipboard\]::GetImage/);
});
