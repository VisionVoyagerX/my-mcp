import { decryptJson, encryptJson } from "./crypto.js";
import type { CredentialStore } from "./store.js";

export interface CreateCredentialHelpersOptions {
  credentialStore?: CredentialStore;
  encryptionKey?: CryptoKey;
}

export interface CredentialHelpers<T extends object> {
  /** True once both a store and an encryption key are configured — gates whether connect/forget tools should be registered at all. */
  readonly storageEnabled: boolean;
  /**
   * Resolves a tool call's credentials from either `credentialToken`
   * (looked up + decrypted) or the raw fields directly. Returns `error`
   * instead of throwing so callers can turn it into a normal (non-crashing)
   * tool result.
   */
  resolve(
    args: { credentialToken?: string } & Partial<T>,
    requiredKeys: (keyof T)[],
  ): Promise<{ credentials: T } | { error: string }>;
  /** Encrypts and stores `credentials` under a new random token, returning that token. */
  connect(credentials: T): Promise<string>;
  /** Deletes a stored token's credentials. No-op if the token doesn't exist. */
  forget(token: string): Promise<void>;
}

/**
 * Factory behind the myDATA/Ergani "connect once, reuse a token" tools.
 * `core` never touches a concrete storage backend directly — callers
 * (worker packages) inject a `CredentialStore` (e.g. backed by Cloudflare
 * KV) and an AES-GCM `CryptoKey`; when either is omitted, `storageEnabled`
 * is false and only the raw-field path works, which keeps this usable
 * (and independently unit-testable) with zero setup.
 */
export function createCredentialHelpers<T extends object>(
  options: CreateCredentialHelpersOptions,
): CredentialHelpers<T> {
  const { credentialStore, encryptionKey } = options;
  const storageEnabled = Boolean(credentialStore && encryptionKey);

  return {
    storageEnabled,
    async resolve(args, requiredKeys) {
      const { credentialToken, ...raw } = args;
      if (credentialToken) {
        if (!credentialStore || !encryptionKey) {
          return {
            error:
              "credentialToken was provided but this server has no credential storage configured.",
          };
        }
        const stored = await credentialStore.get(credentialToken);
        if (!stored) {
          return {
            error:
              "No stored credentials found for that token — it may have been forgotten, expired, or never existed. Connect again to get a new one.",
          };
        }
        const credentials = await decryptJson<T>(encryptionKey, stored);
        return { credentials };
      }
      const partial = raw as Partial<T>;
      const missing = requiredKeys.filter((key) => partial[key] === undefined);
      if (missing.length > 0) {
        return {
          error: `Provide either credentialToken, or all of: ${requiredKeys.join(", ")}.`,
        };
      }
      return { credentials: partial as T };
    },
    async connect(credentials) {
      if (!credentialStore || !encryptionKey) {
        throw new Error("Credential storage is not configured on this server.");
      }
      const token = crypto.randomUUID();
      const encrypted = await encryptJson(encryptionKey, credentials);
      await credentialStore.put(token, encrypted);
      return token;
    },
    async forget(token) {
      if (!credentialStore) {
        throw new Error("Credential storage is not configured on this server.");
      }
      await credentialStore.delete(token);
    },
  };
}
