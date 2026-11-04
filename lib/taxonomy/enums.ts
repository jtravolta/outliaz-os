/**
 * Canonical taxonomy — mirrors TAXONOMY.md.
 * Pure data + helpers. Safe to import from client and server.
 */

export type Slug = string;

export const INDUSTRIES = [
  ["PROFESSIONAL_SERVICES", "Professional Services"],
  ["HEALTHCARE", "Healthcare"],
  ["HOME_SERVICES", "Home Services"],
  ["CONSTRUCTION_TRADES", "Construction & Trades"],
  ["PROPERTY_REAL_ESTATE", "Property & Real Estate"],
  ["HOSPITALITY_FOOD", "Hospitality & Food"],
  ["BEAUTY_WELLNESS", "Beauty & Wellness"],
  ["RETAIL_ECOMMERCE", "Retail & E-commerce"],
  ["AUTOMOTIVE", "Automotive"],
  ["EDUCATION_TRAINING", "Education & Training"],
  ["TECHNOLOGY", "Technology"],
  ["FINANCE_INSURANCE", "Finance & Insurance"],
  ["CREATIVE_MEDIA", "Creative & Media"],
  ["TRAVEL_TOURISM", "Travel & Tourism"],
  ["AGRICULTURE", "Agriculture"],
  ["MANUFACTURING", "Manufacturing"],
  ["OTHER", "Other"],
] as const;

export const BUSINESS_TYPES: Record<string, string[]> = {
  PROFESSIONAL_SERVICES: ["Law Firm", "Accounting Firm", "Consultancy", "Recruitment Agency"],
  HEALTHCARE: ["Dentist", "Physiotherapy Clinic", "Medical Clinic", "Optician", "Private Practice"],
  HOME_SERVICES: ["Plumbing Company", "Electrical Contractor", "Cleaning Company", "Landscaper", "Pest Control"],
  CONSTRUCTION_TRADES: ["Building Contractor", "Roofer", "Renovation Company", "Groundworks"],
  PROPERTY_REAL_ESTATE: ["Estate Agency", "Property Manager", "Property Developer"],
  HOSPITALITY_FOOD: ["Restaurant", "Café", "Hotel", "Catering Company"],
  BEAUTY_WELLNESS: ["Hair Salon", "Barber Shop", "Spa", "Gym", "Wellness Centre"],
  RETAIL_ECOMMERCE: ["Retail Store", "Boutique", "Online Shop"],
  AUTOMOTIVE: ["Auto Repair Shop", "Car Dealership", "Detailing Studio", "Car Rental"],
  EDUCATION_TRAINING: ["Training Company", "Tutoring Service", "Academy", "School"],
  TECHNOLOGY: ["SaaS Company", "IT Services", "Software Company"],
  FINANCE_INSURANCE: ["Financial Adviser", "Insurance Broker", "Insurance Company"],
  CREATIVE_MEDIA: ["Marketing Agency", "Design Studio", "Photography Studio", "Production Company"],
  TRAVEL_TOURISM: ["Tour Operator", "Travel Agency", "Accommodation Provider"],
  AGRICULTURE: ["Farm", "Agricultural Services", "Agricultural Supplier", "Food Processor"],
  MANUFACTURING: ["Manufacturer", "Fabricator", "Industrial Supplier"],
  OTHER: ["Other"],
};

export const SIZES = [
  ["SOLO", "Solo"],
  ["MICRO", "Micro"],
  ["SMALL", "Small"],
  ["SMALL_MEDIUM", "Small–Medium"],
  ["MEDIUM", "Medium"],
  ["LARGE", "Large"],
  ["UNKNOWN", "Unknown"],
] as const;

export const SIZE_RANGES: Record<string, string> = {
  SOLO: "1",
  MICRO: "2–5",
  SMALL: "6–20",
  SMALL_MEDIUM: "21–50",
  MEDIUM: "51–200",
  LARGE: "201+",
  UNKNOWN: "—",
};

export const OPPORTUNITIES = [
  ["NO_WEBSITE", "No website"],
  ["OUTDATED_WEBSITE", "Outdated website"],
  ["POOR_MOBILE_EXPERIENCE", "Poor mobile experience"],
  ["POOR_USER_EXPERIENCE", "Poor user experience"],
  ["WEAK_BRANDING", "Weak branding"],
  ["WEAK_CONVERSION", "Weak conversion"],
  ["NO_LEAD_CAPTURE", "No lead capture"],
  ["NO_ONLINE_BOOKING", "No online booking"],
  ["ECOMMERCE_OPPORTUNITY", "E-commerce opportunity"],
  ["NEEDS_AUTOMATION", "Needs automation"],
  ["NEEDS_WEB_APPLICATION", "Needs web application"],
  ["WEBSITE_PERFORMANCE", "Website performance"],
  ["SEO_DISCOVERABILITY", "SEO discoverability"],
  ["UNKNOWN", "Unknown"],
] as const;

export const SERVICES = [
  ["WEBSITE_DESIGN", "Website design"],
  ["WEBSITE_REDESIGN", "Website redesign"],
  ["WEBSITE_DEVELOPMENT", "Website development"],
  ["LANDING_PAGE", "Landing page"],
  ["ECOMMERCE", "E-commerce"],
  ["BRAND_IDENTITY", "Brand identity"],
  ["BRAND_REFRESH", "Brand refresh"],
  ["UI_UX_DESIGN", "UI/UX design"],
  ["WEB_APPLICATION", "Web application"],
  ["BOOKING_SYSTEM", "Booking system"],
  ["LEAD_GENERATION_SYSTEM", "Lead generation system"],
  ["BUSINESS_AUTOMATION", "Business automation"],
  ["WEBSITE_OPTIMISATION", "Website optimisation"],
  ["ONGOING_SUPPORT", "Ongoing support"],
  ["OTHER", "Other"],
] as const;

export const SERVICE_SUGGESTIONS: Record<string, string[]> = {
  NO_WEBSITE: ["WEBSITE_DESIGN"],
  OUTDATED_WEBSITE: ["WEBSITE_REDESIGN"],
  POOR_MOBILE_EXPERIENCE: ["WEBSITE_REDESIGN", "WEBSITE_OPTIMISATION"],
  POOR_USER_EXPERIENCE: ["UI_UX_DESIGN"],
  WEAK_BRANDING: ["BRAND_IDENTITY", "BRAND_REFRESH"],
  WEAK_CONVERSION: ["LANDING_PAGE", "WEBSITE_OPTIMISATION"],
  NO_LEAD_CAPTURE: ["LEAD_GENERATION_SYSTEM"],
  NO_ONLINE_BOOKING: ["BOOKING_SYSTEM"],
  ECOMMERCE_OPPORTUNITY: ["ECOMMERCE"],
  NEEDS_AUTOMATION: ["BUSINESS_AUTOMATION"],
  NEEDS_WEB_APPLICATION: ["WEB_APPLICATION"],
  WEBSITE_PERFORMANCE: ["WEBSITE_OPTIMISATION"],
  SEO_DISCOVERABILITY: ["WEBSITE_OPTIMISATION"],
};

export const ROLES = [
  ["OWNER", "Owner"],
  ["FOUNDER", "Founder"],
  ["MANAGING_DIRECTOR", "Managing Director"],
  ["CEO", "CEO"],
  ["MARKETING_DIRECTOR", "Marketing Director"],
  ["MARKETING_MANAGER", "Marketing Manager"],
  ["OPERATIONS_DIRECTOR", "Operations Director"],
  ["OPERATIONS_MANAGER", "Operations Manager"],
  ["GENERAL_MANAGER", "General Manager"],
  ["OTHER_DECISION_MAKER", "Other decision maker"],
] as const;

export const QUALITY = [
  ["VERIFIED", "Verified"],
  ["UNVERIFIED", "Unverified"],
  ["RISKY", "Risky"],
  ["BOUNCED", "Bounced"],
  ["UNKNOWN", "Unknown"],
] as const;

export const FITS = [
  ["STRONG", "Strong"],
  ["GOOD", "Good"],
  ["POSSIBLE", "Possible"],
  ["POOR", "Poor"],
  ["UNKNOWN", "Unknown"],
] as const;

export const PRIORITIES = [
  ["HIGH", "High"],
  ["MEDIUM", "Medium"],
  ["LOW", "Low"],
  ["DISQUALIFIED", "Disqualified"],
] as const;

export const STAGES = [
  ["NEW", "New"],
  ["RESEARCHED", "Researched"],
  ["QUALIFIED", "Qualified"],
  ["CONTACTED", "Contacted"],
  ["FOLLOW_UP", "Follow-up"],
  ["REPLIED", "Replied"],
  ["MEETING", "Meeting"],
  ["PROPOSAL", "Proposal"],
  ["WON", "Won"],
  ["LOST", "Lost"],
  ["DISQUALIFIED", "Disqualified"],
] as const;

export const CONTACTABILITY = [
  ["OK", "OK"],
  ["BOUNCED", "Bounced"],
  ["UNSUBSCRIBED", "Unsubscribed"],
  ["DO_NOT_CONTACT", "Do not contact"],
] as const;

export const SUPPRESSION_REASONS = [
  ["UNSUBSCRIBED", "Unsubscribed"],
  ["HARD_BOUNCE", "Hard bounce"],
  ["COMPLAINT", "Complaint"],
  ["MANUAL", "Manual"],
  ["INVALID", "Invalid address"],
] as const;

export const SEQUENCE_STATUSES = [
  ["DRAFT", "Draft"],
  ["ACTIVE", "Active"],
  ["PAUSED", "Paused"],
  ["ARCHIVED", "Archived"],
] as const;

export const ENROLLMENT_STATUSES = [
  ["ACTIVE", "Active"],
  ["PAUSED", "Paused"],
  ["COMPLETED", "Completed"],
  ["STOPPED", "Stopped"],
  ["FAILED", "Failed"],
] as const;

export const MESSAGE_STATUSES = [
  ["QUEUED", "Queued"],
  ["SENT", "Sent"],
  ["DELIVERED", "Delivered"],
  ["BOUNCED", "Bounced"],
  ["COMPLAINED", "Complained"],
  ["FAILED", "Failed"],
] as const;

export const OUTCOMES = [
  ["POSITIVE", "Positive"],
  ["NEUTRAL", "Neutral"],
  ["NEGATIVE", "Negative"],
  ["NOT_INTERESTED", "Not interested"],
  ["OOO", "Out of office"],
] as const;

export const JOB_TYPES = [
  "APIFY_START",
  "APIFY_POLL",
  "APIFY_IMPORT",
  "SEND_STEP",
  "IMAP_SYNC",
  "SCHEDULE_SOURCE",
  "IMPORT_BATCH",
  "EXPORT",
] as const;

export const JOB_STATUSES = ["PENDING", "CLAIMED", "DONE", "DEAD"] as const;

export const USER_ROLES = [
  ["OWNER", "Owner"],
  ["ADMIN", "Admin"],
  ["MEMBER", "Member"],
] as const;

export const USER_STATUSES = [
  ["ACTIVE", "Active"],
  ["INVITED", "Invited"],
  ["DISABLED", "Disabled"],
] as const;

/* ── label helpers ─────────────────────────────────────────────────────────── */

type Pair = readonly [string, string];

export const toMap = (pairs: readonly Pair[]): Record<string, string> =>
  Object.fromEntries(pairs.map(([slug, label]) => [slug, label]));

export const LABELS = {
  industry: toMap(INDUSTRIES),
  size: toMap(SIZES),
  opportunity: toMap(OPPORTUNITIES),
  service: toMap(SERVICES),
  role: toMap(ROLES),
  quality: toMap(QUALITY),
  fit: toMap(FITS),
  priority: toMap(PRIORITIES),
  stage: toMap(STAGES),
  contactability: toMap(CONTACTABILITY),
  suppression: toMap(SUPPRESSION_REASONS),
  sequence: toMap(SEQUENCE_STATUSES),
  enrollment: toMap(ENROLLMENT_STATUSES),
  message: toMap(MESSAGE_STATUSES),
  outcome: toMap(OUTCOMES),
  userRole: toMap(USER_ROLES),
};

export const label = (group: keyof typeof LABELS, slug?: string | null) =>
  (slug && LABELS[group][slug]) || slug || "—";

export const slugify = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/* ── derivation ───────────────────────────────────────────────────────────── */

export function deriveSize(employees?: number | null): string {
  if (employees == null || Number.isNaN(employees)) return "UNKNOWN";
  if (employees <= 0) return "UNKNOWN";
  if (employees === 1) return "SOLO";
  if (employees <= 5) return "MICRO";
  if (employees <= 20) return "SMALL";
  if (employees <= 50) return "SMALL_MEDIUM";
  if (employees <= 200) return "MEDIUM";
  return "LARGE";
}

export function deriveSizeFromRange(value?: string | null): string {
  if (!value) return "UNKNOWN";
  const nums = String(value).match(/\d+/g);
  if (!nums?.length) return "UNKNOWN";
  return deriveSize(Number(nums[nums.length - 1]));
}

const COUNTRY_NAMES: Record<string, string> = {
  "united kingdom": "GB", uk: "GB", gb: "GB", england: "GB", scotland: "GB", wales: "GB",
  ireland: "IE", "republic of ireland": "IE", ie: "IE",
  germany: "DE", de: "DE", deutschland: "DE",
  netherlands: "NL", nl: "NL", holland: "NL",
  france: "FR", fr: "FR", spain: "ES", es: "ES", italy: "IT", it: "IT",
  switzerland: "CH", ch: "CH", austria: "AT", at: "AT", belgium: "BE", be: "BE",
  denmark: "DK", dk: "DK", sweden: "SE", se: "SE", norway: "NO", no: "NO",
  poland: "PL", pl: "PL", portugal: "PT", pt: "PT",
  "united states": "US", usa: "US", us: "US", canada: "CA", ca: "CA",
  australia: "AU", au: "AU", "new zealand": "NZ", nz: "NZ",
};

export function normalizeCountry(value?: string | null): string | null {
  if (!value) return null;
  const key = value.trim().toLowerCase();
  if (COUNTRY_NAMES[key]) return COUNTRY_NAMES[key];
  if (/^[a-z]{2}$/.test(key)) return key.toUpperCase();
  return null;
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;
const ROLE_PREFIXES = [
  "info", "sales", "support", "admin", "hello", "contact", "office",
  "noreply", "no-reply", "billing", "jobs", "enquiries", "enquiry", "team", "mail",
];

export const isRoleAddress = (email: string) =>
  ROLE_PREFIXES.includes(email.split("@")[0]?.toLowerCase() ?? "");

export function normalizeEmail(value?: string | null): string | null {
  if (!value) return null;
  const e = value.trim().toLowerCase();
  return EMAIL_RE.test(e) ? e : null;
}

export function normalizeDomain(value?: string | null): string | null {
  if (!value) return null;
  let v = value.trim().toLowerCase();
  if (!v) return null;
  v = v.replace(/^https?:\/\//, "").replace(/^www\./, "").split(/[/?#]/)[0];
  return v.includes(".") ? v : null;
}
