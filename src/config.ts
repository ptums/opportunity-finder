// Shared runtime config. Values come from the process environment; agents never read .env files.

// Sent on every outbound request so source operators can identify and contact us (REQUIREMENTS §2).
// Set OF_USER_AGENT to include real contact info before any scheduled run.
export const USER_AGENT = process.env.OF_USER_AGENT ?? "opportunity-finder/0.1 (contact not configured)";

export const DATABASE_URL =
  process.env.DATABASE_URL ?? "postgres://opportunity:opportunity_local_dev_only@localhost:5433/opportunity_finder";
