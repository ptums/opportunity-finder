// Apps whose App Store reviews the scout reads (ADR-005). Operator-facing tools in Peter's target
// industries (docs/TARGETS.md). Ids from the iTunes Search API, 2026-10-05. Edit freely; customer-facing
// apps (tenant, member, resident apps) are left out because their reviewers aren't the buyer.

export type Industry = "trades" | "property" | "events" | "associations" | "nonprofit";

export interface AppEntry {
  id: number;
  name: string;
  industry: Industry;
  /** "mixed" = both operators and their customers review it. */
  audience: "operator" | "mixed";
}

export const APPS: AppEntry[] = [
  { id: 692833651, name: "Housecall Pro", industry: "trades", audience: "operator" },
  { id: 1014146758, name: "Jobber", industry: "trades", audience: "operator" },
  { id: 592163563, name: "Joist", industry: "trades", audience: "operator" },
  { id: 1469769810, name: "Workiz", industry: "trades", audience: "operator" },
  { id: 1037989976, name: "ServiceTitan Mobile", industry: "trades", audience: "operator" },
  { id: 1590868801, name: "DoorLoop", industry: "property", audience: "operator" },
  { id: 1288105237, name: "Buildium", industry: "property", audience: "operator" },
  { id: 6473832748, name: "TenantCloud", industry: "property", audience: "mixed" },
  { id: 1187683543, name: "RentRedi", industry: "property", audience: "mixed" },
  { id: 368260521, name: "Eventbrite Organizer", industry: "events", audience: "operator" },
  { id: 1104772757, name: "HoneyBook", industry: "events", audience: "operator" },
  { id: 327370808, name: "Planning Center Services", industry: "associations", audience: "operator" },
  { id: 1159372401, name: "Breeze ChMS", industry: "associations", audience: "operator" },
  { id: 1631051209, name: "Givebutter", industry: "nonprofit", audience: "operator" },
  { id: 1314654833, name: "SignUpGenius", industry: "nonprofit", audience: "mixed" },
  { id: 1445454149, name: "My Impact (Better Impact)", industry: "nonprofit", audience: "mixed" },
];
