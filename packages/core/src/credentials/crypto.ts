/**
 * AES-GCM encrypt/decrypt helpers built entirely on WebCrypto
 * (`globalThis.crypto.subtle`) plus `btoa`/`atob` — all Web Standard APIs
 * available unmodified in both Cloudflare Workers and Node.js 20+, so this
 * file needs no platform-specific code or dependency, matching the rest of
 * `core`.
 */

const IV_LENGTH_BYTES = 12; // AES-GCM's recommended 96-bit IV.

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(base64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Imports a base64-encoded 256-bit key (e.g. from `openssl rand -base64 32`) for use with `encryptJson`/`decryptJson`. */
export async function importEncryptionKey(
  base64Key: string,
): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    base64ToBytes(base64Key),
    "AES-GCM",
    false,
    ["encrypt", "decrypt"],
  );
}

/** Encrypts a JSON-serializable value into a single base64 string (random IV prefixed to the ciphertext). */
export async function encryptJson(
  key: CryptoKey,
  data: unknown,
): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH_BYTES));
  const plaintext = new TextEncoder().encode(JSON.stringify(data));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    plaintext,
  );
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.length);
  return bytesToBase64(combined);
}

/** Reverses `encryptJson`. Throws if `key` doesn't match or `encoded` was tampered with (AES-GCM authentication failure). */
export async function decryptJson<T>(
  key: CryptoKey,
  encoded: string,
): Promise<T> {
  const combined = base64ToBytes(encoded);
  const iv = combined.slice(0, IV_LENGTH_BYTES);
  const ciphertext = combined.slice(IV_LENGTH_BYTES);
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext,
  );
  return JSON.parse(new TextDecoder().decode(plaintext)) as T;
}
