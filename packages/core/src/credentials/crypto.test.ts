import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { decryptJson, encryptJson, importEncryptionKey } from "./crypto.js";

function randomKey(): Promise<CryptoKey> {
  return importEncryptionKey(randomBytes(32).toString("base64"));
}

describe("encryptJson / decryptJson", () => {
  it("round-trips a JSON value", async () => {
    const key = await randomKey();
    const data = { userId: "12345", subscriptionKey: "abc-def" };

    const encrypted = await encryptJson(key, data);
    expect(encrypted).not.toContain("12345");

    const decrypted = await decryptJson<typeof data>(key, encrypted);
    expect(decrypted).toEqual(data);
  });

  it("produces a different ciphertext each time (random IV)", async () => {
    const key = await randomKey();
    const a = await encryptJson(key, { x: 1 });
    const b = await encryptJson(key, { x: 1 });
    expect(a).not.toBe(b);
  });

  it("fails to decrypt with the wrong key", async () => {
    const key1 = await randomKey();
    const key2 = await randomKey();
    const encrypted = await encryptJson(key1, { secret: "value" });
    await expect(decryptJson(key2, encrypted)).rejects.toThrow();
  });

  it("fails to decrypt tampered ciphertext", async () => {
    const key = await randomKey();
    const encrypted = await encryptJson(key, { secret: "value" });
    const flippedLastChar =
      encrypted.slice(0, -1) + (encrypted.at(-1) === "A" ? "B" : "A");
    await expect(decryptJson(key, flippedLastChar)).rejects.toThrow();
  });
});
