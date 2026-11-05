import assert from "node:assert/strict";
import test from "node:test";

import { listShellNotifications } from "../../lib/services/shell-notifications";

test("listShellNotifications returns the supported empty feed", async () => {
  assert.deepEqual(await listShellNotifications(), []);
});
