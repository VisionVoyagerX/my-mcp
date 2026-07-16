import { fetchJson } from "../http.js";

/**
 * Confirmed against github.com/withlogicco/ergani-python-sdk (maintained
 * open-source client): base URL, the `/Authentication` login flow
 * (Username/Password/UserType -> Bearer accessToken), and
 * `/WebServices/ServicesList`. Not live-verified from this environment.
 *
 * Bring-your-own-credential per CLAUDE.md: Ergani credentials belong to an
 * individual employer/software house, so this client never reads them from
 * the environment — every call takes them as explicit parameters.
 *
 * Deliberately does NOT implement Ergani's write endpoints (work-card
 * submission, overtime declarations, etc.) — those are real filings to the
 * Greek labor ministry and this client only has confirmed evidence for
 * their URL paths, not their request payload schemas. Guessing a
 * regulatory-filing payload shape wrong is a materially worse failure mode
 * than a wrong GET, so v1 stays read-only pending a confirmed schema.
 */
const DEFAULT_BASE_URL = "https://trialeservices.yeka.gr/WebServicesAPI/api";

export interface ErganiCredentials {
  username: string;
  password: string;
}

export interface ErganiService {
  [key: string]: unknown;
}

export class ErganiClient {
  private readonly baseUrl: string;

  constructor(options: { baseUrl?: string } = {}) {
    this.baseUrl = options.baseUrl ?? process.env.ERGANI_BASE_URL ?? DEFAULT_BASE_URL;
  }

  private async authenticate(credentials: ErganiCredentials): Promise<string> {
    const response = await fetchJson<{ accessToken?: string }>(
      `${this.baseUrl}/Authentication`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          Username: credentials.username,
          Password: credentials.password,
          UserType: "01",
        }),
      },
    );
    if (!response.accessToken) {
      throw new Error("Ergani authentication succeeded but no accessToken was returned.");
    }
    return response.accessToken;
  }

  /** List the Ergani web services available to this account. Read-only. */
  async listServices(credentials: ErganiCredentials): Promise<ErganiService[]> {
    const accessToken = await this.authenticate(credentials);
    return fetchJson<ErganiService[]>(`${this.baseUrl}/WebServices/ServicesList`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  }
}
