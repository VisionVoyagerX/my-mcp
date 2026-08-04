import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ErganiClient, type ErganiCredentials } from "./client.js";
import { toolErrorResult, type ToolTextResult } from "../tool-result.js";
import {
  createCredentialHelpers,
  type CreateCredentialHelpersOptions,
} from "../credentials/helpers.js";

export interface RegisterErganiToolsOptions extends CreateCredentialHelpersOptions {
  framing?: string;
  /** Overrides the `ERGANI_BASE_URL` env var. */
  baseUrl?: string;
}

export function registerErganiTools(
  server: McpServer,
  options?: RegisterErganiToolsOptions,
): void {
  const client = new ErganiClient({ baseUrl: options?.baseUrl });
  const framingNote = options?.framing ? ` ${options.framing}` : "";
  const helpers = createCredentialHelpers<ErganiCredentials>({
    credentialStore: options?.credentialStore,
    encryptionKey: options?.encryptionKey,
  });

  const credentialNote = helpers.storageEnabled
    ? "This is a bring-your-own-credential tool: Ergani credentials belong to an individual employer, " +
      "so the server never holds a shared credential. Either pass your own username and password, or " +
      "call ergani_connect once and pass the returned credentialToken instead."
    : "This is a bring-your-own-credential tool: Ergani credentials belong to an individual employer, " +
      "so the server never holds a shared credential — pass your own username and password with every call.";

  async function resolveCredentials(args: {
    credentialToken?: string;
    username?: string;
    password?: string;
  }): Promise<
    | { ok: true; credentials: ErganiCredentials }
    | { ok: false; result: ToolTextResult }
  > {
    const resolved = await helpers.resolve(args, ["username", "password"]);
    if ("error" in resolved) {
      return {
        ok: false,
        result: {
          content: [{ type: "text", text: resolved.error }],
          isError: true,
        },
      };
    }
    return { ok: true, credentials: resolved.credentials };
  }

  server.registerTool(
    "ergani_list_services",
    {
      title: "List Ergani web services",
      description:
        "List the Ergani (Greek labor ministry) web services available to your employer/" +
        "software-house account, after authenticating with your own credentials. " +
        credentialNote +
        " Read-only: this tool set deliberately does not expose Ergani's write endpoints " +
        "(work-card submission, overtime/schedule declarations) since those are real filings " +
        "to the labor ministry and their exact request payload shape hasn't been confirmed " +
        "against a live environment." +
        framingNote,
      inputSchema: {
        credentialToken: z
          .string()
          .optional()
          .describe(
            "A token from ergani_connect, in place of username+password.",
          ),
        username: z
          .string()
          .optional()
          .describe(
            "Your Ergani account username. Omit if using credentialToken.",
          ),
        password: z
          .string()
          .optional()
          .describe(
            "Your Ergani account password. Omit if using credentialToken.",
          ),
      },
    },
    async ({ credentialToken, username, password }) => {
      const resolved = await resolveCredentials({
        credentialToken,
        username,
        password,
      });
      if (!resolved.ok) return resolved.result;
      try {
        const services = await client.listServices(resolved.credentials);
        return {
          content: [{ type: "text", text: JSON.stringify(services, null, 2) }],
        };
      } catch (error) {
        return toolErrorResult(error, "Failed to list Ergani services");
      }
    },
  );

  if (helpers.storageEnabled) {
    server.registerTool(
      "ergani_connect",
      {
        title: "Save Ergani credentials for reuse",
        description:
          "Encrypts and stores your Ergani username+password server-side, returning a " +
          "credentialToken you can pass to other ergani_* tools instead of resending your " +
          "raw credentials every call. Call ergani_forget to revoke it." +
          framingNote,
        inputSchema: {
          username: z.string().min(1).describe("Your Ergani account username."),
          password: z.string().min(1).describe("Your Ergani account password."),
        },
      },
      async ({ username, password }) => {
        const token = await helpers.connect({ username, password });
        return {
          content: [
            {
              type: "text",
              text:
                `Saved. Use this as credentialToken on other ergani_* calls:\n\n${token}\n\n` +
                "Save it now — it will not be shown again. Call ergani_forget with this token to revoke it.",
            },
          ],
        };
      },
    );

    server.registerTool(
      "ergani_forget",
      {
        title: "Delete saved Ergani credentials",
        description:
          "Deletes the credentials stored under a credentialToken previously returned by " +
          "ergani_connect." +
          framingNote,
        inputSchema: {
          credentialToken: z
            .string()
            .min(1)
            .describe("The token to revoke, from a prior ergani_connect call."),
        },
      },
      async ({ credentialToken }) => {
        await helpers.forget(credentialToken);
        return {
          content: [
            {
              type: "text",
              text: "Credentials for that token have been deleted.",
            },
          ],
        };
      },
    );
  }
}
