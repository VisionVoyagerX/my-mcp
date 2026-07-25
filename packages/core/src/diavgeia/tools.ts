import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { DiavgeiaClient, toolErrorResult } from "../index.js";
import type {
  DiavgeiaOrganizationSearchParams,
  DiavgeiaSearchParams,
  DiavgeiaSimpleSearchParams,
} from "./client.js";

function formatDate(epochMillis: number): string {
  return new Date(epochMillis).toISOString().slice(0, 10);
}

function formatDecisionLine(d: {
  ada: string;
  issueDate: number;
  organizationId: string;
  subject: string;
  documentUrl: string;
}): string {
  const pdfLink = d.documentUrl ? ` | [📄 PDF](${d.documentUrl})` : "";
  return `- **${d.ada}** (${formatDate(d.issueDate)}, org ${d.organizationId}): ${d.subject}${pdfLink}`;
}

export interface RegisterDiavgeiaToolsOptions {
  framing?: string;
}

export function registerDiavgeiaTools(
  server: McpServer,
  options?: RegisterDiavgeiaToolsOptions,
): void {
  const client = new DiavgeiaClient();
  const framingNote = options?.framing ? ` ${options.framing}` : "";

  server.registerTool(
    "diavgeia_search_decisions",
    {
      title: "Αναζήτηση αποφάσεων Διαύγειας / Search Diavgeia Decisions",
      description:
        "Αναζήτηση δημόσιων αποφάσεων, διατάγματος και νόμων προϋπολογισμού από τη Διαύγεια " +
        "(το κυβερνητικό portal διαφάνειας) με σύνταξη Lucene. Φιλτράρισμα κατά φορέα, τύπο απόφασης, " +
        "υπογράφοντα ή/και ημερομηνία έκδοσης. Απαιτείται τουλάχιστον ένα φίλτρο. Χωρίς fromDate/toDate, " +
        "η Διαύγεια επιστρέφει μόνο αποφάσεις των τελευταίων ~6 μηνών. ΣΗΜΑΝΤΙΚΟ: το εύρος fromDate/toDate " +
        "δεν μπορεί να ξεπερνά τις 180 ημέρες σε ένα κάλεσμα — η Διαύγεια το κόβει σιωπηλά αν προσπαθήσετε· " +
        "για μεγαλύτερα διαστήματα κάντε διαδοχικά καλέσματα των 180 ημερών. Για αναζήτηση με απλές λέξεις-" +
        "κλειδιά αντί για Lucene, ή για ξεχωριστό φιλτράρισμα κατά ημερομηνία υποβολής vs έκδοσης, δείτε το " +
        "diavgeia_simple_search_decisions. | Search Greek public-sector decisions from Diavgeia (government " +
        "transparency portal) using Lucene syntax. Filter by organization, decision type, signer, and/or issue-" +
        "date range (10 results per page by default). At least one filter required. Without fromDate/toDate, " +
        "Diavgeia only returns decisions from the last ~6 months. IMPORTANT: a single call's fromDate/toDate " +
        "span cannot exceed 180 days — Diavgeia silently truncates a wider request instead of erroring; issue " +
        "sequential 180-day calls to cover a longer period. For plain-keyword search instead of Lucene, or to " +
        "filter by submission date separately from issue date, see diavgeia_simple_search_decisions." +
        framingNote,
      inputSchema: z.object({
        query: z
          .string()
          .optional()
          .describe(
            "Όρος αναζήτησης ελεύθερου κειμένου / Free-text search term (searched in decision subject/text).",
          ),
        organizationUid: z
          .string()
          .optional()
          .describe(
            'UID φορέα Διαύγειας για φιλτράρισμα / Organization UID to filter by (e.g., "100037417").',
          ),
        decisionTypeUid: z
          .string()
          .optional()
          .describe(
            'UID τύπου απόφασης / Decision-type UID to filter by (e.g., "Β.1.1").',
          ),
        signerUid: z
          .string()
          .optional()
          .describe("UID υπογράφοντα / Signer UID to filter by."),
        fromDate: z
          .string()
          .optional()
          .describe(
            "Μόνο αποφάσεις από αυτή την ημερομηνία / Decisions issued on/after this date (YYYY-MM-DD).",
          ),
        toDate: z
          .string()
          .optional()
          .describe(
            "Μόνο αποφάσεις μέχρι αυτή την ημερομηνία / Decisions issued on/before this date (YYYY-MM-DD).",
          ),
        page: z
          .number()
          .int()
          .min(0)
          .optional()
          .describe(
            "Αριθμός σελίδας (0-based) / Page number (0-based). Defaults to 0.",
          ),
        size: z
          .number()
          .int()
          .min(1)
          .max(100)
          .optional()
          .describe(
            "Αποτελέσματα ανά σελίδα / Results per page (1-100). Defaults to 10.",
          ),
      }),
      // @ts-expect-error examples not yet in SDK types
      examples: [
        {
          description:
            "Αναζήτηση αποφάσεων από το Υπουργείο Εσωτερικών (UID: 100037417) | Search decisions from Ministry of Interior",
          input: { organizationUid: "100037417" },
        },
        {
          description:
            "Αναζήτηση αποφάσεων σε χρονικό εύρος (Μάιο - Ιούλιο 2026) | Search decisions within date range",
          input: {
            organizationUid: "100037417",
            fromDate: "2026-05-01",
            toDate: "2026-07-23",
          },
        },
        {
          description:
            "Αναζήτηση ελεύθερου κειμένου για προμήθειες | Free-text search for procurement",
          input: { query: "procurement" },
        },
      ],
    },
    async (params: Record<string, unknown>) => {
      try {
        const result = await client.searchDecisions(
          params as DiavgeiaSearchParams,
        );
        if (result.decisions.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: "Δεν βρέθηκαν αποφάσεις που να ταιριάζουν με τα φίλτρα. / No decisions matched the given filters.",
              },
            ],
          };
        }
        const lines = result.decisions.map(formatDecisionLine);
        const header = `**Αποτελέσματα / Results:** ${result.total} decision(s) found, showing page ${result.page} (${result.decisions.length} shown):\n`;
        return {
          content: [{ type: "text", text: `${header}${lines.join("\n")}` }],
        };
      } catch (error) {
        return toolErrorResult(
          error,
          "Αποτυχία αναζήτησης αποφάσεων Διαύγειας / Failed to search Diavgeia decisions",
        );
      }
    },
  );

  server.registerTool(
    "diavgeia_get_decision",
    {
      title: "Λήψη απόφασης Διαύγειας / Get Diavgeia Decision",
      description:
        "Ανάκτηση του πλήρους αρχείου μιας απόφασης από τη Διαύγεια χρησιμοποιώντας τον κώδικα ADA " +
        "(Αριθμός Διαδικτυακής Ανάρτησης, π.χ. '6ΣΦ4ΩΞΧ-ΑΒΓ') ή, εναλλακτικά, ένα συγκεκριμένο versionId " +
        "(για ανάκτηση μιας παλαιότερης/διορθωμένης έκδοσης — βλ. diavgeia_get_decision_version_log). " +
        "Ακριβώς ένα από τα δύο πρέπει να δοθεί. Χρησιμοποιήστε πρώτα την αναζήτηση αποφάσεων αν δεν " +
        "γνωρίζετε τον ADA. | Fetch the full record for a single Greek decision from Diavgeia, either by " +
        "its ADA (the unique publication code, e.g., '6ΣΦ4ΩΞΧ-ΑΒΓ') or by a specific versionId (to fetch an " +
        "older/corrected version — see diavgeia_get_decision_version_log). Exactly one of the two must be " +
        "given. Use diavgeia_search_decisions first if you need to find the ADA." +
        framingNote,
      inputSchema: z.object({
        ada: z
          .string()
          .min(1)
          .optional()
          .describe(
            'Κωδικός ADA της απόφασης / The decision\'s ADA code (e.g., "6ΣΦ4ΩΞΧ-ΑΒΓ").',
          ),
        versionId: z
          .string()
          .min(1)
          .optional()
          .describe(
            "Αναγνωριστικό συγκεκριμένης έκδοσης / A specific version's versionId (from diavgeia_get_decision_version_log), for fetching a historical/corrected version instead of the current one.",
          ),
      }),
      // @ts-expect-error examples not yet in SDK types
      examples: [
        {
          description:
            "Ανάκτηση λεπτομερειών απόφασης κατά ADA / Fetch decision details by ADA",
          input: { ada: "6ΣΦ4ΩΞΧ-ΑΒΓ" },
        },
      ],
    },
    async ({ ada, versionId }: Record<string, unknown>) => {
      const label =
        (ada as string | undefined) ?? (versionId as string | undefined) ?? "";
      try {
        if ((ada && versionId) || (!ada && !versionId)) {
          throw new Error(
            "Provide exactly one of ada or versionId, not both or neither.",
          );
        }
        const d = ada
          ? await client.getDecision(ada as string)
          : await client.getDecisionVersion(versionId as string);
        const pdfSection = d.documentUrl
          ? `\n\n📄 **Έγγραφο / Document:** [${d.documentUrl}](${d.documentUrl})`
          : "";
        const lines = [
          `**ADA:** ${d.ada}`,
          `**Θέμα / Subject:** ${d.subject}`,
          `**Φορέας / Organization:** ${d.organizationId}`,
          `**Ημερομηνία / Issue date:** ${formatDate(d.issueDate)}`,
          `**Αριθμός Πρωτοκόλλου / Protocol number:** ${d.protocolNumber}`,
          `**Τύπος Απόφασης / Decision type:** ${d.decisionTypeId}`,
          `**Κατάσταση / Status:** ${d.status}`,
          `**Version ID:** ${d.versionId}${d.correctedVersionId ? ` (διόρθωσε / corrects ${d.correctedVersionId})` : ""}`,
        ];
        return {
          content: [{ type: "text", text: lines.join("\n") + pdfSection }],
        };
      } catch (error) {
        return toolErrorResult(
          error,
          `Αποτυχία ανάκτησης απόφασης Διαύγειας / Failed to fetch decision "${label}"`,
        );
      }
    },
  );

  server.registerTool(
    "diavgeia_get_decision_version_log",
    {
      title: "Ιστορικό εκδόσεων απόφασης / Get Decision Version History",
      description:
        "Ανάκτηση του πλήρους ιστορικού εκδόσεων μιας απόφασης κατά ADA: την αρχική δημοσίευση και κάθε " +
        "μεταγενέστερη διόρθωση, με το versionId, την ημερομηνία και την κατάσταση κάθε έκδοσης. " +
        "Χρησιμοποιήστε ένα versionId από εδώ με το diavgeia_get_decision για να ανακτήσετε μια " +
        "συγκεκριμένη παλαιότερη έκδοση. | Fetch the full version history of a decision by ADA: the " +
        "initial publication and every subsequent correction, with each version's versionId, timestamp, " +
        "and status. Use a versionId from here with diavgeia_get_decision to fetch a specific historical version." +
        framingNote,
      inputSchema: z.object({
        ada: z
          .string()
          .min(1)
          .describe("Κωδικός ADA της απόφασης / The decision's ADA code."),
      }),
      // @ts-expect-error examples not yet in SDK types
      examples: [
        {
          description:
            "Ανάκτηση ιστορικού εκδόσεων απόφασης / Fetch a decision's version history",
          input: { ada: "6ΣΦ4ΩΞΧ-ΑΒΓ" },
        },
      ],
    },
    async ({ ada }: Record<string, unknown>) => {
      try {
        const log = await client.getDecisionVersionLog(ada as string);
        const lines = log.versions.map(
          (v) =>
            `- **${v.versionId}** (${formatDate(v.versionTimestamp)}, ${v.status})${
              v.correctedVersionId
                ? ` — διόρθωσε / corrects ${v.correctedVersionId}`
                : ""
            }`,
        );
        return {
          content: [
            {
              type: "text",
              text: `**ADA ${log.ada}** — ${log.versions.length} έκδοση/-εις / version(s):\n${lines.join("\n")}`,
            },
          ],
        };
      } catch (error) {
        return toolErrorResult(
          error,
          `Αποτυχία ανάκτησης ιστορικού εκδόσεων / Failed to fetch version history for ADA "${ada}"`,
        );
      }
    },
  );

  server.registerTool(
    "diavgeia_simple_search_decisions",
    {
      title: "Απλή αναζήτηση αποφάσεων / Simple Keyword Search for Decisions",
      description:
        "Αναζήτηση αποφάσεων με απλές παραμέτρους λέξεων-κλειδιών (χωρίς σύνταξη Lucene) — εναλλακτική του " +
        "diavgeia_search_decisions. Υποστηρίζει αναζήτηση κατά ADA, θέμα, αριθμό πρωτοκόλλου, γενικό όρο, " +
        "φορέα, μονάδα, υπογράφοντα, τύπο, θεματική κατηγορία, και κατάσταση. ΣΗΜΑΝΤΙΚΟ: έχει ΔΥΟ ανεξάρτητα " +
        "φίλτρα ημερομηνίας που ενώνονται με AND — fromDate/toDate (πότε υποβλήθηκε/τροποποιήθηκε) και " +
        "fromIssueDate/toIssueDate (πότε εκδόθηκε αρχικά) — το καθένα προεπιλέγει σε παράθυρο ~6 μηνών αν " +
        "παραλειφθεί. Για αναζήτηση παλαιών αποφάσεων κατά ημερομηνία έκδοσης πρέπει να διευρύνετε ΚΑΙ τα " +
        "δύο ζεύγη, αλλιώς θα επιστραφούν μόνο πρόσφατα τροποποιημένες παλιές αποφάσεις. Απαιτείται " +
        "τουλάχιστον ένα φίλτρο. | Search decisions using plain keyword parameters (no Lucene syntax) — an " +
        "alternative to diavgeia_search_decisions. Supports searching by ADA, subject, protocol number, " +
        "general term, organization, unit, signer, type, thematic tag, and status. IMPORTANT: this endpoint " +
        "has TWO independent date filters ANDed together — fromDate/toDate (when submitted/last edited) and " +
        "fromIssueDate/toIssueDate (when originally issued) — each defaults to a ~6-month window if omitted. " +
        "To find old decisions by issue date you must widen BOTH pairs, or only recently-resubmitted old " +
        "decisions will match. At least one filter is required." +
        framingNote,
      inputSchema: z.object({
        ada: z
          .string()
          .optional()
          .describe("Ακριβής κωδικός ADA / Exact decision ADA."),
        subject: z
          .string()
          .optional()
          .describe(
            "Λέξεις-κλειδιά στο θέμα / Keywords matched against the subject.",
          ),
        protocol: z
          .string()
          .optional()
          .describe("Αριθμός πρωτοκόλλου / Protocol number."),
        term: z
          .string()
          .optional()
          .describe("Γενικός όρος αναζήτησης / General free-text search term."),
        org: z
          .string()
          .optional()
          .describe(
            "UID ή λατινικό όνομα φορέα / Organization UID or latin name.",
          ),
        unit: z
          .string()
          .optional()
          .describe("UID μονάδας έκδοσης / Organization unit UID."),
        signer: z.string().optional().describe("UID υπογράφοντα / Signer UID."),
        type: z
          .string()
          .optional()
          .describe("UID τύπου απόφασης / Decision-type UID."),
        tag: z
          .string()
          .optional()
          .describe("UID θεματικής κατηγορίας / Thematic-category UID."),
        fromDate: z
          .string()
          .optional()
          .describe(
            "Ημερομηνία υποβολής/τροποποίησης (από) / Submitted/edited on or after this date (YYYY-MM-DD).",
          ),
        toDate: z
          .string()
          .optional()
          .describe(
            "Ημερομηνία υποβολής/τροποποίησης (έως) / Submitted/edited on or before this date (YYYY-MM-DD).",
          ),
        fromIssueDate: z
          .string()
          .optional()
          .describe(
            "Ημερομηνία έκδοσης (από) / Issued on or after this date (YYYY-MM-DD).",
          ),
        toIssueDate: z
          .string()
          .optional()
          .describe(
            "Ημερομηνία έκδοσης (έως) / Issued on or before this date (YYYY-MM-DD).",
          ),
        status: z
          .enum(["published", "revoked", "pending_revocation", "all"])
          .optional()
          .describe(
            'Κατάσταση απόφασης / Decision status filter. Defaults to "all".',
          ),
        page: z
          .number()
          .int()
          .min(0)
          .optional()
          .describe(
            "Αριθμός σελίδας (0-based) / Page number (0-based). Defaults to 0.",
          ),
        size: z
          .number()
          .int()
          .min(1)
          .max(100)
          .optional()
          .describe(
            "Αποτελέσματα ανά σελίδα / Results per page (1-100). Defaults to 10.",
          ),
      }),
      // @ts-expect-error examples not yet in SDK types
      examples: [
        {
          description:
            "Αναζήτηση κατά αριθμό πρωτοκόλλου / Search by protocol number",
          input: { protocol: "2633807", org: "100037417" },
        },
        {
          description:
            "Αναζήτηση παλαιών αποφάσεων εύρους έκδοσης, διευρύνοντας και τα δύο ζεύγη ημερομηνιών | " +
            "Search old decisions by issue-date range, widening both date pairs",
          input: {
            org: "100037417",
            fromDate: "2010-01-01",
            toDate: "2026-12-31",
            fromIssueDate: "2020-01-01",
            toIssueDate: "2020-12-31",
          },
        },
      ],
    },
    async (params: Record<string, unknown>) => {
      try {
        const result = await client.simpleSearchDecisions(
          params as DiavgeiaSimpleSearchParams,
        );
        if (result.decisions.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: "Δεν βρέθηκαν αποφάσεις που να ταιριάζουν με τα φίλτρα. / No decisions matched the given filters.",
              },
            ],
          };
        }
        const lines = result.decisions.map(formatDecisionLine);
        const header = `**Αποτελέσματα / Results:** ${result.total} decision(s) found, showing page ${result.page} (${result.decisions.length} shown):\n`;
        return {
          content: [{ type: "text", text: `${header}${lines.join("\n")}` }],
        };
      } catch (error) {
        return toolErrorResult(
          error,
          "Αποτυχία απλής αναζήτησης αποφάσεων / Failed to simple-search Diavgeia decisions",
        );
      }
    },
  );

  server.registerTool(
    "diavgeia_get_organization",
    {
      title: "Λήψη δεδομένων φορέα / Get Organization Details",
      description:
        "Ανάκτηση λεπτομερών μεταδεδομένων ενός φορέα κατά UID. Επιστρέφει επίσημη ονομασία (ελληνικά και λατινικά), " +
        "κατηγορία, νομική κατάσταση, ΑΦΜ, ιστοσελίδα και email επικοινωνίας. Χρήσιμο για κατανόηση ποιος φορέας " +
        "εξέδωσε μια απόφαση ή επαλήθευση του επίσημου status ενός φορέα. Για μονάδες, υπογράφοντες, θέσεις και " +
        "εποπτευόμενους φορείς, δείτε το diavgeia_get_organization_details. | Resolve an organization UID to its " +
        "full metadata: official name (Greek and Latin), category, legal status, VAT number, website, contact email. " +
        "Useful for understanding which organization issued a decision or verifying official status. For units, " +
        "signers, positions, and supervised organizations, see diavgeia_get_organization_details." +
        framingNote,
      inputSchema: z.object({
        organizationUid: z
          .string()
          .min(1)
          .describe(
            'UID του φορέα Διαύγειας / The organization\'s Diavgeia UID (e.g., "100037417").',
          ),
      }),
      // @ts-expect-error examples not yet in SDK types
      examples: [
        {
          description:
            "Ανάκτηση λεπτομερειών φορέα κατά UID / Get organization details by UID",
          input: { organizationUid: "100037417" },
        },
      ],
    },
    async ({ organizationUid }: Record<string, unknown>) => {
      try {
        const org = await client.getOrganization(organizationUid as string);
        const lines = [
          `## ${org.label}`,
          `**UID:** ${org.uid} | **Slug:** ${org.latinName}`,
          `**Κατηγορία / Category:** ${org.category}`,
          `**Κατάσταση / Status:** ${org.status}`,
          org.abbreviation
            ? `**Ακρώνυμο / Abbreviation:** ${org.abbreviation}`
            : undefined,
          `**ΑΦΜ / VAT Number:** ${org.vatNumber}`,
          org.fekNumber
            ? `**ΦΕΚ / FEK:** ${org.fekNumber} (τεύχος ${org.fekIssue}/${org.fekYear})`
            : undefined,
          org.odeManagerEmail
            ? `**Email (ODE Manager):** ${org.odeManagerEmail}`
            : undefined,
          org.website
            ? `**Ιστοσελίδα / Website:** [${org.website}](${org.website})`
            : undefined,
          org.supervisorLabel
            ? `**Επόπτης / Supervisor:** ${org.supervisorLabel}`
            : undefined,
          org.organizationDomains && org.organizationDomains.length > 0
            ? `**Domains:** ${org.organizationDomains.join(", ")}`
            : undefined,
        ]
          .filter((line) => line !== undefined)
          .join("\n");
        return { content: [{ type: "text", text: lines }] };
      } catch (error) {
        return toolErrorResult(
          error,
          `Αποτυχία ανάκτησης δεδομένων φορέα / Failed to fetch organization metadata for UID "${organizationUid}"`,
        );
      }
    },
  );

  server.registerTool(
    "diavgeia_get_organization_details",
    {
      title: "Πλήρη στοιχεία φορέα / Get Full Organization Details",
      description:
        "Ανάκτηση πλήρων στοιχείων ενός φορέα κατά UID σε ένα κάλεσμα: ταυτότητα (όπως το " +
        "diavgeia_get_organization), όλες οι μονάδες του (descendants=all), όλοι οι υπογράφοντες, όλες οι " +
        "θέσεις, και οι φορείς που εποπτεύει. Χρησιμοποιήστε το αντί για ξεχωριστά καλέσματα όταν χρειάζεστε " +
        "παραπάνω από απλή ταυτότητα φορέα. | Fetch full details for an organization by UID in one call: " +
        "identity (as in diavgeia_get_organization), all of its units (descendants=all), all its signers, all " +
        "its positions, and any organizations it supervises. Use this instead of separate calls when you need " +
        "more than plain organization identity." +
        framingNote,
      inputSchema: z.object({
        organizationUid: z
          .string()
          .min(1)
          .describe(
            'UID του φορέα Διαύγειας / The organization\'s Diavgeia UID (e.g., "100037417").',
          ),
      }),
      // @ts-expect-error examples not yet in SDK types
      examples: [
        {
          description:
            "Ανάκτηση πλήρων στοιχείων φορέα / Fetch full organization details",
          input: { organizationUid: "100037417" },
        },
      ],
    },
    async ({ organizationUid }: Record<string, unknown>) => {
      try {
        const org = await client.getOrganizationDetails(
          organizationUid as string,
        );
        // Large ministries have 300+ units and 200+ signers (verified live 2026-07-23) — cap the
        // displayed list so one call can't flood an agent's context, but keep the true counts above.
        const LIST_CAP = 25;
        const capped = <T>(items: T[], render: (item: T) => string): string => {
          const shown = items.slice(0, LIST_CAP).map(render).join("\n");
          return items.length > LIST_CAP
            ? `${shown}\n- … και ${items.length - LIST_CAP} ακόμα / and ${items.length - LIST_CAP} more`
            : shown;
        };
        const lines = [
          `## ${org.label}`,
          `**UID:** ${org.uid} | **Κατηγορία / Category:** ${org.category} | **Κατάσταση / Status:** ${org.status}`,
          `**Μονάδες / Units:** ${org.units.length}`,
          `**Υπογράφοντες / Signers:** ${org.signers.length}`,
          `**Θέσεις / Positions:** ${org.positions.length}`,
          `**Εποπτευόμενοι φορείς / Supervised organizations:** ${org.supervisedOrganizations.length}`,
          "",
          org.units.length > 0
            ? `**Μονάδες / Units${org.units.length > LIST_CAP ? ` (πρώτες ${LIST_CAP} / first ${LIST_CAP})` : ""}:**\n${capped(org.units, (u) => `- \`${u.uid}\`: ${u.label}`)}`
            : undefined,
          org.signers.length > 0
            ? `\n**Υπογράφοντες / Signers${org.signers.length > LIST_CAP ? ` (πρώτοι ${LIST_CAP} / first ${LIST_CAP})` : ""}:**\n${capped(org.signers, (s) => `- \`${s.uid}\`: ${s.firstName} ${s.lastName}`.trim())}`
            : undefined,
          org.supervisedOrganizations.length > 0
            ? `\n**Εποπτευόμενοι φορείς / Supervised organizations:**\n${capped(org.supervisedOrganizations, (o) => `- \`${o.uid}\`: ${o.label}`)}`
            : undefined,
        ]
          .filter((line) => line !== undefined)
          .join("\n");
        return { content: [{ type: "text", text: lines }] };
      } catch (error) {
        return toolErrorResult(
          error,
          `Αποτυχία ανάκτησης πλήρων στοιχείων φορέα / Failed to fetch full organization details for UID "${organizationUid}"`,
        );
      }
    },
  );

  server.registerTool(
    "diavgeia_get_organization_units",
    {
      title: "Μονάδες φορέα / List Organization Units",
      description:
        'Λίστα οργανικών μονάδων ενός φορέα κατά UID. Με descendants="children" (προεπιλογή) επιστρέφει ' +
        'μόνο τις άμεσες υπο-μονάδες· με descendants="all" επιστρέφει και τις μονάδες των μονάδων. | List ' +
        'the organizational units belonging to an organization by UID. With descendants="children" ' +
        '(default) returns only direct sub-units; with descendants="all" also includes units of units.' +
        framingNote,
      inputSchema: z.object({
        organizationUid: z
          .string()
          .min(1)
          .describe("UID του φορέα / The organization's Diavgeia UID."),
        descendants: z
          .enum(["children", "all"])
          .optional()
          .describe(
            'Βάθος αναζήτησης μονάδων / How deep to include descendant units. Defaults to "children".',
          ),
      }),
      // @ts-expect-error examples not yet in SDK types
      examples: [
        {
          description: "Λίστα άμεσων μονάδων / List direct units",
          input: { organizationUid: "100037417" },
        },
      ],
    },
    async ({ organizationUid, descendants }: Record<string, unknown>) => {
      try {
        const units = await client.getOrganizationUnits(
          organizationUid as string,
          descendants as "children" | "all" | undefined,
        );
        if (units.length === 0) {
          return {
            content: [
              { type: "text", text: "Δεν βρέθηκαν μονάδες. / No units found." },
            ],
          };
        }
        // Large ministries have 300+ units with descendants="all" (verified live 2026-07-23) — cap
        // the displayed list so one call can't flood an agent's context.
        const LIST_CAP = 50;
        const shown = units.slice(0, LIST_CAP);
        const lines = shown.map(
          (u) =>
            `- \`${u.uid}\`: ${u.label}${u.active ? "" : " (ανενεργή / inactive)"}`,
        );
        const truncNote =
          units.length > LIST_CAP
            ? `\n- … και ${units.length - LIST_CAP} ακόμα / and ${units.length - LIST_CAP} more`
            : "";
        return {
          content: [
            {
              type: "text",
              text: `**${units.length} μονάδα/-ες / unit(s):**\n${lines.join("\n")}${truncNote}`,
            },
          ],
        };
      } catch (error) {
        return toolErrorResult(
          error,
          `Αποτυχία ανάκτησης μονάδων φορέα / Failed to fetch units for organization UID "${organizationUid}"`,
        );
      }
    },
  );

  server.registerTool(
    "diavgeia_get_unit",
    {
      title: "Λήψη μονάδας / Get Organizational Unit",
      description:
        "Ανάκτηση μιας οργανικής μονάδας κατά UID — χρήσιμο για να αποκωδικοποιήσετε τα unitIds μιας " +
        "απόφασης. | Fetch a single organizational unit by its unit UID — useful for resolving a decision's " +
        "unitIds entries to a human-readable name." +
        framingNote,
      inputSchema: z.object({
        unitId: z.string().min(1).describe("UID της μονάδας / The unit's UID."),
      }),
      // @ts-expect-error examples not yet in SDK types
      examples: [
        {
          description: "Ανάκτηση μονάδας κατά UID / Fetch a unit by UID",
          input: { unitId: "73040" },
        },
      ],
    },
    async ({ unitId }: Record<string, unknown>) => {
      try {
        const u = await client.getUnit(unitId as string);
        const lines = [
          `**${u.label}**`,
          `**UID:** ${u.uid} | **Κατηγορία / Category:** ${u.category}`,
          `**Φορέας / Organization:** ${u.parentId}`,
          `**Κατάσταση / Status:** ${u.active ? "ενεργή / active" : "ανενεργή / inactive"}`,
        ];
        return { content: [{ type: "text", text: lines.join("\n") }] };
      } catch (error) {
        return toolErrorResult(
          error,
          `Αποτυχία ανάκτησης μονάδας / Failed to fetch unit "${unitId}"`,
        );
      }
    },
  );

  server.registerTool(
    "diavgeia_get_signer",
    {
      title: "Λήψη υπογράφοντα / Get Signer",
      description:
        "Ανάκτηση στοιχείων ενός υπογράφοντα κατά UID — χρήσιμο για να αποκωδικοποιήσετε τα signerIds μιας " +
        "απόφασης. | Fetch a single signer by their signer UID — useful for resolving a decision's signerIds " +
        "entries to a name and position." +
        framingNote,
      inputSchema: z.object({
        signerId: z
          .string()
          .min(1)
          .describe("UID του υπογράφοντα / The signer's UID."),
      }),
      // @ts-expect-error examples not yet in SDK types
      examples: [
        {
          description: "Ανάκτηση υπογράφοντα κατά UID / Fetch a signer by UID",
          input: { signerId: "102984" },
        },
      ],
    },
    async ({ signerId }: Record<string, unknown>) => {
      try {
        const s = await client.getSigner(signerId as string);
        const positions = s.units
          .map((u) => `${u.positionLabel} (μονάδα/unit ${u.uid})`)
          .join(", ");
        const lines = [
          `**${s.firstName} ${s.lastName}**`.trim(),
          `**UID:** ${s.uid} | **Φορέας / Organization:** ${s.organizationId}`,
          `**Κατάσταση / Status:** ${s.active ? "ενεργός / active" : "ανενεργός / inactive"}`,
          `**Δικαίωμα υπογραφής φορέα / Org-wide sign rights:** ${s.hasOrganizationSignRights ? "ναι / yes" : "όχι / no"}`,
          positions ? `**Θέσεις / Positions:** ${positions}` : undefined,
        ].filter((line) => line !== undefined);
        return { content: [{ type: "text", text: lines.join("\n") }] };
      } catch (error) {
        return toolErrorResult(
          error,
          `Αποτυχία ανάκτησης υπογράφοντα / Failed to fetch signer "${signerId}"`,
        );
      }
    },
  );

  server.registerTool(
    "diavgeia_list_decision_types",
    {
      title: "Λίστα τύπων αποφάσεων / List Diavgeia Decision Types",
      description:
        "Επιστρέφει όλους τους έγκυρους κωδικούς τύπου απόφασης (decisionTypeUid) που μπορούν να " +
        "χρησιμοποιηθούν ως φίλτρο στο diavgeia_search_decisions, ομαδοποιημένους ανά κατηγορία " +
        "(π.χ. Β.1.1 = 'ΕΓΚΡΙΣΗ ΠΡΟΥΠΟΛΟΓΙΣΜΟΥ'). Χρησιμοποιήστε το πριν μαντέψετε έναν κωδικό τύπου. " +
        "| Returns every valid decisionTypeUid code usable as a filter in diavgeia_search_decisions, " +
        "grouped by category (e.g. Β.1.1 = procurement/budget approval). Use this before guessing a " +
        "decision-type code — Diavgeia has ~35 of them and they aren't otherwise discoverable." +
        framingNote,
      inputSchema: z.object({}),
      // @ts-expect-error examples not yet in SDK types
      examples: [
        {
          description:
            "Λίστα όλων των τύπων αποφάσεων / List all decision types",
          input: {},
        },
      ],
    },
    async () => {
      try {
        const types = await client.getDecisionTypes();
        const categories = new Map<string | null, string>();
        for (const t of types) {
          if (!t.allowedInDecisions) categories.set(t.uid, t.label);
        }
        const leaves = types.filter((t) => t.allowedInDecisions);
        const byParent = new Map<string | null, typeof leaves>();
        for (const t of leaves) {
          const group = byParent.get(t.parent) ?? [];
          group.push(t);
          byParent.set(t.parent, group);
        }
        const lines: string[] = [];
        for (const [parentUid, group] of byParent) {
          const categoryLabel = parentUid
            ? (categories.get(parentUid) ?? parentUid)
            : "—";
          lines.push(`\n**${categoryLabel}**`);
          for (const t of group) {
            lines.push(`- \`${t.uid}\`: ${t.label}`);
          }
        }
        return {
          content: [
            {
              type: "text",
              text: `**${leaves.length} τύποι αποφάσεων / decision types:**${lines.join("\n")}`,
            },
          ],
        };
      } catch (error) {
        return toolErrorResult(
          error,
          "Αποτυχία ανάκτησης τύπων αποφάσεων / Failed to fetch Diavgeia decision types",
        );
      }
    },
  );

  server.registerTool(
    "diavgeia_get_decision_type_details",
    {
      title: "Λεπτομέρειες τύπου απόφασης / Get Decision Type Details",
      description:
        "Ανάκτηση του σχήματος extraFieldValues για έναν συγκεκριμένο τύπο απόφασης (decisionTypeUid): ποια " +
        "πρόσθετα πεδία απαιτούνται/επιτρέπονται, ο τύπος δεδομένων τους, τυχόν λίστα έγκυρων τιμών ή σχετικό " +
        "λεξικό, και το searchTerm που τα φιλτράρει στην αναζήτηση. Χρήσιμο για να καταλάβετε τι περιέχει μια " +
        "απόφαση αυτού του τύπου πριν τη διαβάσετε, ή ποιο searchTerm να χρησιμοποιήσετε. | Fetch the extra-" +
        "field schema for a specific decision type (decisionTypeUid): which extra fields are required/allowed, " +
        "their data type, any fixed value list or dictionary they draw from, and the searchTerm that filters " +
        "each one. Useful for understanding what a decision of this type contains before reading it, or which " +
        "searchTerm to use." +
        framingNote,
      inputSchema: z.object({
        decisionTypeUid: z
          .string()
          .min(1)
          .describe('UID τύπου απόφασης / Decision-type UID (e.g., "Β.1.1").'),
      }),
      // @ts-expect-error examples not yet in SDK types
      examples: [
        {
          description:
            "Λεπτομέρειες τύπου έγκρισης προϋπολογισμού / Budget-approval type details",
          input: { decisionTypeUid: "Β.1.1" },
        },
      ],
    },
    async ({ decisionTypeUid }: Record<string, unknown>) => {
      try {
        const details = await client.getDecisionTypeDetails(
          decisionTypeUid as string,
        );
        const formatField = (
          f: (typeof details.extraFields)[number],
          indent = "",
        ): string[] => {
          const flags = [
            f.required ? "υποχρεωτικό/required" : "προαιρετικό/optional",
            f.multiple ? "multiple" : undefined,
          ]
            .filter(Boolean)
            .join(", ");
          const extra = [
            f.dictionary ? `dictionary=${f.dictionary}` : undefined,
            f.fixedValueList
              ? `values=[${f.fixedValueList.join(" | ")}]`
              : undefined,
            f.searchTerm ? `searchTerm=${f.searchTerm}` : undefined,
          ]
            .filter(Boolean)
            .join(", ");
          const line = `${indent}- \`${f.uid}\` (${f.type}, ${flags}): ${f.label ?? f.uid}${extra ? ` [${extra}]` : ""}`;
          return [
            line,
            ...f.nestedFields.flatMap((nf) => formatField(nf, indent + "  ")),
          ];
        };
        const lines = details.extraFields.flatMap((f) => formatField(f));
        return {
          content: [
            {
              type: "text",
              text:
                `**${details.uid}**: ${details.label}\n**${details.extraFields.length} πρόσθετα πεδία / extra field(s):**\n` +
                (lines.length > 0 ? lines.join("\n") : "(κανένα / none)"),
            },
          ],
        };
      } catch (error) {
        return toolErrorResult(
          error,
          `Αποτυχία ανάκτησης λεπτομερειών τύπου απόφασης / Failed to fetch decision type details for "${decisionTypeUid}"`,
        );
      }
    },
  );

  server.registerTool(
    "diavgeia_list_search_terms",
    {
      title: "Λίστα πεδίων αναζήτησης / List Search Terms",
      description:
        "Λίστα των πεδίων (search terms) που μπορούν να χρησιμοποιηθούν σε αναζήτηση αποφάσεων στη Διαύγεια — " +
        "όλα τα πεδία, μόνο τα κοινά σε κάθε τύπο απόφασης (commonOnly=true), ή μόνο όσα ισχύουν για έναν " +
        "συγκεκριμένο τύπο (decisionTypeUid). | List the search terms (fields) usable when searching Diavgeia " +
        "decisions — every field, only the ones common to every decision type (commonOnly=true), or only the " +
        "ones valid for one specific decision type (decisionTypeUid)." +
        framingNote,
      inputSchema: z.object({
        decisionTypeUid: z
          .string()
          .optional()
          .describe(
            "Προαιρετικό: μόνο πεδία αναζήτησης έγκυρα για αυτόν τον τύπο απόφασης / Optional: only search terms valid for this decision type.",
          ),
        commonOnly: z
          .boolean()
          .optional()
          .describe(
            "Προαιρετικό: μόνο τα κοινά πεδία σε κάθε τύπο / Optional: only fields common to every decision type. Ignored if decisionTypeUid is set.",
          ),
      }),
      // @ts-expect-error examples not yet in SDK types
      examples: [
        {
          description:
            "Λίστα όλων των πεδίων αναζήτησης / List every search term",
          input: {},
        },
        {
          description:
            "Λίστα κοινών πεδίων αναζήτησης / List common search terms",
          input: { commonOnly: true },
        },
      ],
    },
    async ({ decisionTypeUid, commonOnly }: Record<string, unknown>) => {
      try {
        const terms = await client.getSearchTerms({
          typeUid: decisionTypeUid as string | undefined,
          commonOnly: commonOnly as boolean | undefined,
        });
        const lines = terms.map((t) => `- \`${t.term}\`: ${t.label}`);
        return {
          content: [
            {
              type: "text",
              text: `**${terms.length} πεδίο/-α αναζήτησης / search term(s):**\n${lines.join("\n")}`,
            },
          ],
        };
      } catch (error) {
        return toolErrorResult(
          error,
          "Αποτυχία ανάκτησης πεδίων αναζήτησης / Failed to fetch Diavgeia search terms",
        );
      }
    },
  );

  server.registerTool(
    "diavgeia_get_dictionary",
    {
      title: "Λεξικά αναφοράς / Get Reference Dictionary",
      description:
        "Χωρίς παράμετρο name: λίστα όλων των διαθέσιμων λεξικών αναφοράς της Διαύγειας (π.χ. ORG_CATEGORY, " +
        "CPV, CURRENCY). Με name: τα στοιχεία (uid/label/parent) αυτού του συγκεκριμένου λεξικού — τις έγκυρες " +
        'τιμές για πεδία που βασίζονται σε αυτό το λεξικό (π.χ. validation="dictionary" σε ένα extraField). ' +
        "| Without a name parameter: list every reference dictionary Diavgeia has (e.g. ORG_CATEGORY, CPV, " +
        "CURRENCY). With name: the items (uid/label/parent) of that specific dictionary — the accepted values " +
        'for fields backed by it (e.g. an extraField with validation="dictionary").' +
        framingNote,
      inputSchema: z.object({
        name: z
          .string()
          .optional()
          .describe(
            'UID του λεξικού / The dictionary\'s uid (e.g., "ORG_CATEGORY"). Omit to list all dictionaries.',
          ),
      }),
      // @ts-expect-error examples not yet in SDK types
      examples: [
        {
          description: "Λίστα όλων των λεξικών / List all dictionaries",
          input: {},
        },
        {
          description:
            "Στοιχεία λεξικού κατηγοριών φορέα / Items of the org-category dictionary",
          input: { name: "ORG_CATEGORY" },
        },
      ],
    },
    async ({ name }: Record<string, unknown>) => {
      try {
        if (!name) {
          const dictionaries = await client.getDictionaries();
          const lines = dictionaries.map((d) => `- \`${d.uid}\`: ${d.label}`);
          return {
            content: [
              {
                type: "text",
                text: `**${dictionaries.length} λεξικό/-ά / dictionary/-ies):**\n${lines.join("\n")}`,
              },
            ],
          };
        }
        const dict = await client.getDictionary(name as string);
        const lines = dict.items.map(
          (i) =>
            `- \`${i.uid}\`: ${i.label}${i.parent ? ` (parent: ${i.parent})` : ""}`,
        );
        return {
          content: [
            {
              type: "text",
              text: `**${dict.name}** — ${dict.items.length} στοιχείο/-α / item(s):\n${lines.join("\n")}`,
            },
          ],
        };
      } catch (error) {
        return toolErrorResult(
          error,
          `Αποτυχία ανάκτησης λεξικού / Failed to fetch dictionary${name ? ` "${name}"` : " list"}`,
        );
      }
    },
  );

  server.registerTool(
    "diavgeia_list_positions",
    {
      title: "Λίστα θέσεων / List All Positions",
      description:
        "Λίστα όλων των θέσεων (positions) που ορίζονται σε όλους τους φορείς της Διαύγειας — ένα επίπεδο " +
        "λεξικό ετικετών (~25.000 εγγραφές), όχι περιορισμένο σε έναν φορέα. Το API επιστρέφει ολόκληρο το " +
        "σύνολο χωρίς server-side pagination, οπότε εφαρμόζεται client-side σελιδοποίηση. Αν χρειάζεστε μόνο " +
        "τις θέσεις ενός συγκεκριμένου φορέα, χρησιμοποιήστε το diavgeia_get_organization_details. | List every " +
        "position defined across all Diavgeia organizations — a flat label dictionary (~25,000 entries), not " +
        "scoped to one organization. The API returns its entire set with no server-side pagination, so " +
        "pagination is applied client-side. If you only need the positions within one organization, use " +
        "diavgeia_get_organization_details instead." +
        framingNote,
      inputSchema: z.object({
        page: z
          .number()
          .int()
          .min(0)
          .optional()
          .describe(
            "Αριθμός σελίδας (0-based) / Page number (0-based). Defaults to 0.",
          ),
        size: z
          .number()
          .int()
          .min(1)
          .max(100)
          .optional()
          .describe(
            "Αποτελέσματα ανά σελίδα / Results per page (1-100). Defaults to 10.",
          ),
      }),
      // @ts-expect-error examples not yet in SDK types
      examples: [
        {
          description:
            "Λίστα πρώτης σελίδας θέσεων / List the first page of positions",
          input: {},
        },
      ],
    },
    async (params: Record<string, unknown>) => {
      try {
        const result = await client.listPositions(
          params as { page?: number; size?: number },
        );
        const lines = result.positions.map((p) => `- \`${p.uid}\`: ${p.label}`);
        const header = `**${result.total} θέση/-εις συνολικά / total position(s)**, showing page ${result.page} (${result.positions.length} shown):\n`;
        return {
          content: [{ type: "text", text: `${header}${lines.join("\n")}` }],
        };
      } catch (error) {
        return toolErrorResult(
          error,
          "Αποτυχία ανάκτησης θέσεων / Failed to fetch Diavgeia positions",
        );
      }
    },
  );

  server.registerTool(
    "diavgeia_search_organizations",
    {
      title: "Αναζήτηση φορέων / Browse Diavgeia Organizations",
      description:
        "Περιήγηση δημόσιων φορέων κατά κατάσταση (status) ή/και κατηγορία (category, π.χ. MINISTRY, " +
        "MUNICIPALITY, NPDD, UNIVERSITY, HOSPITAL). Απαιτείται τουλάχιστον ένα από τα δύο. Σημείωση: Το " +
        "API της Διαύγειας ΔΕΝ υποστηρίζει αναζήτηση ελεύθερου κειμένου κατά όνομα φορέα σε αυτό το " +
        "endpoint — αν γνωρίζετε ήδη το UID ενός φορέα, χρησιμοποιήστε diavgeia_get_organization. | " +
        "Browse public-sector organizations by status and/or category (e.g. MINISTRY, MUNICIPALITY, " +
        "NPDD, UNIVERSITY, HOSPITAL — see Diavgeia's ORG_CATEGORY dictionary). At least one of status or " +
        "category is required — Diavgeia's /organizations endpoint returns its entire ~5,400-organization " +
        "index unfiltered otherwise. Note: Diavgeia's API has no free-text name search on this endpoint — " +
        "if you already know an organization's UID, use diavgeia_get_organization instead. Even filtered, " +
        "some categories are large (e.g. NPDD alone has ~2,660); results are paginated client-side since " +
        "Diavgeia's endpoint itself does not paginate." +
        framingNote,
      inputSchema: z.object({
        status: z
          .string()
          .optional()
          .describe(
            'Κατάσταση φορέα / Organization status filter (e.g., "active", "inactive").',
          ),
        category: z
          .string()
          .optional()
          .describe(
            'Κατηγορία φορέα / Organization category filter (e.g., "MINISTRY", "MUNICIPALITY", "NPDD", "UNIVERSITY", "HOSPITAL", "COURT").',
          ),
        page: z
          .number()
          .int()
          .min(0)
          .optional()
          .describe(
            "Αριθμός σελίδας (0-based) / Page number (0-based). Defaults to 0.",
          ),
        size: z
          .number()
          .int()
          .min(1)
          .max(100)
          .optional()
          .describe(
            "Αποτελέσματα ανά σελίδα / Results per page (1-100). Defaults to 10.",
          ),
      }),
      // @ts-expect-error examples not yet in SDK types
      examples: [
        {
          description: "Λίστα όλων των υπουργείων / List all ministries",
          input: { category: "MINISTRY" },
        },
        {
          description: "Λίστα ενεργών δήμων / List active municipalities",
          input: { category: "MUNICIPALITY", status: "active" },
        },
      ],
    },
    async (params: Record<string, unknown>) => {
      try {
        const result = await client.searchOrganizations(
          params as DiavgeiaOrganizationSearchParams,
        );
        if (result.organizations.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: "Δεν βρέθηκαν φορείς που να ταιριάζουν με τα φίλτρα. / No organizations matched the given filters.",
              },
            ],
          };
        }
        const lines = result.organizations.map(
          (o) => `- **${o.uid}** (${o.category}, ${o.status}): ${o.label}`,
        );
        const header = `**Αποτελέσματα / Results:** ${result.total} organization(s) found, showing page ${result.page} (${result.organizations.length} shown):\n`;
        return {
          content: [{ type: "text", text: `${header}${lines.join("\n")}` }],
        };
      } catch (error) {
        return toolErrorResult(
          error,
          "Αποτυχία αναζήτησης φορέων / Failed to search Diavgeia organizations",
        );
      }
    },
  );
}
