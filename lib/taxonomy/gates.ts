/**
 * Gates and the stage transition matrix — mirrors TAXONOMY.md §13–14.
 * Pure functions, shared by server services and client UI.
 */

import { normalizeEmail } from "./enums";

export type ProspectLike = {
  stage: string;
  industry_slug?: string | null;
  business_type_id?: string | null;
  company_size?: string | null;
  fit?: string | null;
  priority?: string | null;
  country_code?: string | null;
  contact_name?: string | null;
  contact_role?: string | null;
  contact_email?: string | null;
  contact_quality?: string | null;
  contactability?: string | null;
  opportunities?: string[];
  services?: string[];
  suppressed?: boolean;
  active_enrollment?: boolean | { id: string; sequence_id: string; status: string } | null;
};

export type Requirement = { key: string; label: string; ok: boolean };

const hasRealOpportunity = (o: string[] = []) =>
  o.length > 0 && o.some((x) => x !== "UNKNOWN");

export function researchChecklist(p: ProspectLike): Requirement[] {
  return [
    { key: "industry", label: "Industry set", ok: !!p.industry_slug },
    { key: "business_type", label: "Business type set", ok: !!p.business_type_id },
    { key: "company_size", label: "Company size known", ok: !!p.company_size && p.company_size !== "UNKNOWN" },
    { key: "opportunity", label: "At least one real opportunity", ok: hasRealOpportunity(p.opportunities) },
    { key: "fit", label: "Fit assessed", ok: !!p.fit && p.fit !== "UNKNOWN" },
    { key: "country", label: "Country set", ok: !!p.country_code },
    { key: "contact_name", label: "Contact name", ok: !!p.contact_name?.trim() },
    { key: "role", label: "Contact role", ok: !!p.contact_role },
  ];
}

export function qualificationChecklist(p: ProspectLike): Requirement[] {
  return [
    ...researchChecklist(p),
    { key: "fit_strong", label: "Fit is Strong or Good", ok: p.fit === "STRONG" || p.fit === "GOOD" },
    { key: "service", label: "At least one potential service", ok: !!p.services?.length },
    { key: "priority", label: "Priority is High or Medium", ok: p.priority === "HIGH" || p.priority === "MEDIUM" },
    { key: "email", label: "Contact email present", ok: !!normalizeEmail(p.contact_email) },
    { key: "quality", label: "Contact quality is not Bounced", ok: p.contact_quality !== "BOUNCED" },
    { key: "contactability", label: "Contactability is OK", ok: p.contactability === "OK" },
    { key: "suppressed", label: "Not on the suppression list", ok: !p.suppressed },
  ];
}

export function enrollmentChecklist(p: ProspectLike): Requirement[] {
  return [
    {
      key: "stage",
      label: "Stage is Qualified, Contacted or Follow-up",
      ok: ["QUALIFIED", "CONTACTED", "FOLLOW_UP"].includes(p.stage),
    },
    { key: "priority", label: "Priority is not Low or Disqualified", ok: !["LOW", "DISQUALIFIED"].includes(p.priority ?? "") },
    { key: "fit", label: "Fit is not Poor or Unknown", ok: !["POOR", "UNKNOWN"].includes(p.fit ?? "") },
    { key: "email", label: "Email present", ok: !!normalizeEmail(p.contact_email) },
    { key: "contactability", label: "Contactability is OK", ok: p.contactability === "OK" },
    { key: "suppressed", label: "Not suppressed", ok: !p.suppressed },
    { key: "enrollment", label: "Not in another active sequence", ok: !p.active_enrollment },
  ];
}

export const missing = (list: Requirement[]) => list.filter((r) => !r.ok);

export const researchMissing = (p: ProspectLike) => missing(researchChecklist(p));
export const qualificationMissing = (p: ProspectLike) => missing(qualificationChecklist(p));
export const enrollmentMissing = (p: ProspectLike) => missing(enrollmentChecklist(p));

export function gateState(p: ProspectLike): "research-ready" | "qualification-ready" | "blocked" | "working" {
  if (p.stage === "NEW") return researchMissing(p).length === 0 ? "research-ready" : "blocked";
  if (p.stage === "RESEARCHED") return qualificationMissing(p).length === 0 ? "qualification-ready" : "blocked";
  if (["NEW", "RESEARCHED"].includes(p.stage)) return "blocked";
  return "working";
}

export const MATRIX: Record<string, string[]> = {
  NEW: ["RESEARCHED", "DISQUALIFIED"],
  RESEARCHED: ["QUALIFIED", "NEW", "LOST", "DISQUALIFIED"],
  QUALIFIED: ["CONTACTED", "NEW", "RESEARCHED", "MEETING", "LOST", "DISQUALIFIED"],
  CONTACTED: ["FOLLOW_UP", "REPLIED", "MEETING", "PROPOSAL", "LOST", "DISQUALIFIED"],
  FOLLOW_UP: ["REPLIED", "MEETING", "PROPOSAL", "LOST", "DISQUALIFIED"],
  REPLIED: ["CONTACTED", "MEETING", "PROPOSAL", "LOST", "DISQUALIFIED"],
  MEETING: ["PROPOSAL", "WON", "LOST", "DISQUALIFIED"],
  PROPOSAL: ["WON", "LOST", "DISQUALIFIED"],
  WON: [],
  LOST: ["RESEARCHED"],
  DISQUALIFIED: ["NEW"],
};

export const TERMINAL = ["WON", "LOST", "DISQUALIFIED"];
export const CLOSED = ["LOST", "DISQUALIFIED"];
export const requiresReason = (to: string) => CLOSED.includes(to);

export function allowedTransitions(from: string): string[] {
  return MATRIX[from] ?? [];
}

export function canTransition(from: string, to: string): boolean {
  return allowedTransitions(from).includes(to);
}

/** Gate that must pass for a manual transition, if any. */
export function transitionGate(from: string, to: string): "research" | "qualification" | null {
  if (to === "RESEARCHED" && from === "NEW") return "research";
  if (to === "QUALIFIED" && from === "RESEARCHED") return "qualification";
  return null;
}
