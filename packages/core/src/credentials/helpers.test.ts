import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { importEncryptionKey } from "./crypto.js";
import { createCredentialHelpers } from "./helpers.js";
import type { CredentialStore } from "./store.js";

interface TestCreds {
  userId: string;
  subscriptionKey: string;
}

function inMemoryStore(): CredentialStore {
  const map = new Map<string, string>();
  return {
    async get(token) {
      return map.get(token);
    },
    async put(token, value) {
      map.set(token, value);
    },
    async delete(token) {
      map.delete(token);
    },
  };
}

describe("createCredentialHelpers", () => {
  it("without storage: resolves from raw fields and reports missing ones", async () => {
    const helpers = createCredentialHelpers<TestCreds>({});
    expect(helpers.storageEnabled).toBe(false);

    const ok = await helpers.resolve({ userId: "u1", subscriptionKey: "s1" }, [
      "userId",
      "subscriptionKey",
    ]);
    expect(ok).toEqual({
      credentials: { userId: "u1", subscriptionKey: "s1" },
    });

    const missing = await helpers.resolve({ userId: "u1" }, [
      "userId",
      "subscriptionKey",
    ]);
    expect(missing).toMatchObject({
      error: expect.stringContaining("credentialToken"),
    });
  });

  it("without storage: rejects a credentialToken with an actionable error", async () => {
    const helpers = createCredentialHelpers<TestCreds>({});
    const result = await helpers.resolve({ credentialToken: "tok" }, [
      "userId",
      "subscriptionKey",
    ]);
    expect(result).toMatchObject({
      error: expect.stringContaining("no credential storage"),
    });
  });

  it("without storage: connect/forget throw since there's nowhere to store", async () => {
    const helpers = createCredentialHelpers<TestCreds>({});
    await expect(
      helpers.connect({ userId: "u1", subscriptionKey: "s1" }),
    ).rejects.toThrow();
    await expect(helpers.forget("tok")).rejects.toThrow();
  });

  it("with storage: connect -> resolve by token -> forget round-trip", async () => {
    const store = inMemoryStore();
    const encryptionKey = await importEncryptionKey(
      randomBytes(32).toString("base64"),
    );
    const helpers = createCredentialHelpers<TestCreds>({
      credentialStore: store,
      encryptionKey,
    });
    expect(helpers.storageEnabled).toBe(true);

    const token = await helpers.connect({
      userId: "u1",
      subscriptionKey: "s1",
    });
    expect(typeof token).toBe("string");

    const resolved = await helpers.resolve({ credentialToken: token }, [
      "userId",
      "subscriptionKey",
    ]);
    expect(resolved).toEqual({
      credentials: { userId: "u1", subscriptionKey: "s1" },
    });

    await helpers.forget(token);
    const afterForget = await helpers.resolve({ credentialToken: token }, [
      "userId",
      "subscriptionKey",
    ]);
    expect(afterForget).toMatchObject({
      error: expect.stringContaining("forgotten"),
    });
  });

  it("with storage: raw fields still work alongside tokens", async () => {
    const store = inMemoryStore();
    const encryptionKey = await importEncryptionKey(
      randomBytes(32).toString("base64"),
    );
    const helpers = createCredentialHelpers<TestCreds>({
      credentialStore: store,
      encryptionKey,
    });

    const resolved = await helpers.resolve(
      { userId: "u2", subscriptionKey: "s2" },
      ["userId", "subscriptionKey"],
    );
    expect(resolved).toEqual({
      credentials: { userId: "u2", subscriptionKey: "s2" },
    });
  });
});
