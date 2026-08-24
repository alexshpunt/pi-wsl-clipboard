import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { createWindowsClipboardBridge, isWsl, pasteClipboard } from "./clipboard.ts";

/** Register the WSL Windows-clipboard paste shortcut in Pi. */
export default function register(pi: ExtensionAPI): void {
  if (!isWsl()) return;

  const clipboard = createWindowsClipboardBridge();
  pi.registerShortcut("ctrl+v", {
    description: "Paste Windows clipboard image or text in WSL",
    handler: (ctx) => {
      pasteClipboard(clipboard, (value) => ctx.ui.pasteToEditor(value));
    },
  });
}

export { createWindowsClipboardBridge, isWsl, pasteClipboard } from "./clipboard.ts";
export type { ClipboardBridge, CommandResult, CommandRunner, PasteResult } from "./clipboard.ts";
