import assert from "node:assert/strict";
import test from "node:test";
import register from "../src/index.ts";

test("registers Ctrl+V in WSL", () => {
  const previous = process.env.WSL_DISTRO_NAME;
  process.env.WSL_DISTRO_NAME = "test-distro";
  const shortcuts: string[] = [];

  try {
    register({
      registerShortcut(shortcut: string) {
        shortcuts.push(shortcut);
      },
    } as never);
  } finally {
    if (previous === undefined) delete process.env.WSL_DISTRO_NAME;
    else process.env.WSL_DISTRO_NAME = previous;
  }

  assert.deepEqual(shortcuts, ["ctrl+v"]);
});

test("registers Ctrl+V on native Windows", () => {
  const previous = process.env.WSL_DISTRO_NAME;
  delete process.env.WSL_DISTRO_NAME;
  const shortcuts: string[] = [];

  try {
    register({
      registerShortcut(shortcut: string) {
        shortcuts.push(shortcut);
      },
    } as never);
  } finally {
    if (previous !== undefined) process.env.WSL_DISTRO_NAME = previous;
  }

  assert.deepEqual(shortcuts, ["ctrl+v"]);
});
