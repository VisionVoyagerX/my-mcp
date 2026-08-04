/**
 * Storage abstraction for the connect-once credential-token system used by
 * myDATA/Ergani tools. `core` depends only on this interface, never on a
 * concrete backend (e.g. Cloudflare KV) — the same injection pattern
 * already used for GEMI's `checkRateLimit` (see `gemi/tools.ts`). Values
 * are already-encrypted strings; this interface has no knowledge of the
 * encryption happening in `crypto.ts`.
 */
export interface CredentialStore {
  get(token: string): Promise<string | undefined>;
  put(token: string, value: string): Promise<void>;
  delete(token: string): Promise<void>;
}
