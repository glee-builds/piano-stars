// Tests that sw.js only deletes this app's own old caches. The owner's other
// apps share this web address, so their caches must be left alone.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const sw = readFileSync(new URL("../sw.js", import.meta.url), "utf8");

test("activate deletes only old caches with this app's prefix", async () => {
  const listeners = {};
  const deleted = [];
  let pending;
  const names = ["piano-stars-v1", "piano-stars-v0", "other-app-v2", "piano-stars-v2"];
  vm.runInNewContext(sw, {
    self: {
      addEventListener: (type, fn) => { listeners[type] = fn; },
      skipWaiting() {},
      clients: { claim: () => Promise.resolve() },
    },
    caches: {
      keys: async () => names,
      delete: async (name) => { deleted.push(name); return true; },
    },
  });
  listeners.activate({ waitUntil: (promise) => { pending = promise; } });
  await pending;
  assert.deepEqual(deleted.sort(), ["piano-stars-v0", "piano-stars-v2"]);
});
