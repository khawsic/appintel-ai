import { AppCategory, AppRecord } from "../shared/types.ts";

export const CATEGORY_LIST: Array<{ category: AppCategory; apps: string[] }> = [
  {
    category: "CRM / Sales",
    apps: [
      "Salesforce",
      "HubSpot",
      "Pipedrive",
      "Attio",
      "Twenty",
      "Podio",
      "Zoho CRM",
      "Close",
      "Copper",
      "DealCloud",
    ],
  },
  {
    category: "Support / Helpdesk",
    apps: [
      "Zendesk",
      "Intercom",
      "Freshdesk",
      "Front",
      "Pylon",
      "LiveAgent",
      "Plain",
      "Help Scout",
      "Gorgias",
      "Gladly",
    ],
  },
  {
    category: "Communications / Messaging",
    apps: [
      "Slack",
      "Twilio",
      "Zoho Cliq",
      "Lark",
      "Pumble",
      "Discord",
      "Telegram",
      "WhatsApp Business",
      "Aircall",
      "Vonage",
    ],
  },
  {
    category: "Marketing / Ads / Email / Social",
    apps: [
      "Google Ads",
      "Meta Ads",
      "LinkedIn Ads",
      "GoHighLevel",
      "Mailchimp",
      "Klaviyo",
      "systeme.io",
      "Pinterest",
      "Threads",
      "SendGrid",
    ],
  },
  {
    category: "Ecommerce",
    apps: [
      "Shopify",
      "WooCommerce",
      "BigCommerce",
      "Salesforce Commerce Cloud",
      "Magento / Adobe Commerce",
      "Squarespace",
      "Ecwid",
      "Gumroad",
      "Amazon Selling Partner",
      "fanbasis",
    ],
  },
  {
    category: "Data / SEO / Scraping",
    apps: [
      "DataForSEO",
      "SE Ranking",
      "Ahrefs",
      "MrScraper",
      "Apify",
      "Firecrawl",
      "Bright Data",
      "Sherlock",
      "Waterfall.io",
      "Clay",
    ],
  },
  {
    category: "Developer / Infrastructure / Data",
    apps: [
      "GitHub",
      "Vercel",
      "Netlify",
      "Cloudflare",
      "Supabase",
      "Neo4j",
      "Snowflake",
      "MongoDB Atlas",
      "Datadog",
      "Sentry",
    ],
  },
  {
    category: "Productivity / Project Management",
    apps: [
      "Notion",
      "Airtable",
      "Linear",
      "Jira",
      "Asana",
      "Monday.com",
      "ClickUp",
      "Coda",
      "Smartsheet",
      "Harvest",
    ],
  },
  {
    category: "Finance / Fintech",
    apps: [
      "Stripe",
      "Plaid",
      "Binance",
      "Paygent Connect (NMI-powered)",
      "iPayX",
      "QuickBooks",
      "Xero",
      "Brex",
      "Ramp",
      "PitchBook",
    ],
  },
  {
    category: "AI / Research / Media-native",
    apps: [
      "NotebookLM",
      "Otter AI",
      "Fathom",
      "Consensus",
      "Reducto",
      "Devin",
      "higgsfield",
      "Mermaid CLI",
      "YouTube Transcript",
      "Grain",
    ],
  },
];

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function createInitial100Apps(): AppRecord[] {
  const records: AppRecord[] = [];
  let index = 1;

  for (const group of CATEGORY_LIST) {
    for (const appName of group.apps) {
      records.push({
        id: toSlug(appName),
        index,
        app_name: appName,
        category: group.category,
        official_website: null,
        description: null,
        primary_purpose: null,
        use_cases: [],
        authentication_methods: [],
        authentication_evidence: [],
        api_available: null,
        api_types: [],
        api_surface: [],
        api_access_model: "unknown",
        access_model_reasoning: null,
        access_restrictions: [],
        api_rate_limits: null,
        api_doc_quality: "unknown",
        mcp_status: "unknown",
        mcp_server_name: null,
        mcp_repository_url: null,
        mcp_ownership: "unknown",
        mcp_capabilities: [],
        mcp_maintained: null,
        mcp_limitations: null,
        buildability: "unknown",
        buildability_reasoning: null,
        buildability_score: null,
        blockers: [],
        commercial_restrictions: [],
        evidence: [],
        research_status: "pending",
        verification_status: "unverified",
        verification_items: [],
        first_pass_snapshot: null,
        composio_check: null,
        confidence: null,
        last_researched: null,
        error_message: null,
        notes: [],
      });
      index += 1;
    }
  }

  return records;
}
