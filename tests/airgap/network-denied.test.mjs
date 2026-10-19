import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { networkInterfaces } from "node:os";
import test from "node:test";

test("CMD-AIRGAP runs rootless with no egress and a read-only application mount", async () => {
  assert.equal(process.env.AIRGAP_PROFILE, "1");
  assert.notEqual(process.getuid?.(), 0);
  const externalAddresses = Object.values(networkInterfaces()).flat().filter((address) => address !== undefined && !address.internal);
  assert.deepEqual(externalAddresses, []);
  await assert.rejects(
    fetch("https://example.com", { signal: AbortSignal.timeout(1_500) }),
    /fetch failed|aborted|timeout/i
  );
  await assert.rejects(
    writeFile("/workspace/.airgap-write-probe", "blocked", "utf8"),
    (error) => error?.code === "EROFS" || error?.code === "EACCES"
  );
});
