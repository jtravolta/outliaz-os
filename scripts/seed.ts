/**
 * Seeds a believable workspace: taxonomy, team, library, two sources, and a
 * pipeline of ~60 prospects with messages, replies, enrollments and events.
 *
 *   npm run db:seed
 */
import { sql } from "drizzle-orm";

import { db, sqlClient } from "../lib/db/client";
import {
  auditLogs, businessTypes, deletedEmails, dnsCache, emailTemplates, enrollments,
  exportJobs, importBatches, industries, integrationCredentials, jobs, leadSources,
  messages, notifications, offerServices, offers, prospectEvents, prospectNotes,
  prospectOpportunities, prospectServices, prospectTags, prospects, qualificationRules,
  replies, sequenceSteps, sequences, sourceRuns, suppressions, tags, users, workspaces,
} from "../lib/db/schema";
import { BUSINESS_TYPES, deriveSize, INDUSTRIES, slugify } from "../lib/taxonomy/enums";

const day = 86_400_000;
const ago = (d: number) => new Date(Date.now() - d * day);
const ahead = (d: number) => new Date(Date.now() + d * day);
const dateOnly = (d: Date) => d.toISOString().slice(0, 10);

async function reset() {
  await sqlClient.unsafe(`
    truncate table
      export_jobs, notifications, audit_logs, dns_cache, jobs, replies, messages,
      enrollments, sequence_steps, sequences, email_templates, offer_services, offers,
      qualification_rules, suppressions, deleted_emails, prospect_events, prospect_notes,
      prospect_tags, tags, prospect_services, prospect_opportunities, prospects,
      import_batches, source_runs, lead_sources, integration_credentials,
      business_types, industries, users, workspaces
    restart identity cascade;
  `);
}

type SeedCompany = {
  name: string; domain: string; industry: string; type: string;
  city: string; region: string; country: string; market: string;
  employees: number; contact: string; role: string; email: string;
  opps: string[]; services: string[]; fit: string; priority: string; stage: string;
  tags?: string[]; nextAction?: string; dueIn?: number; reason?: string;
  note?: string;
};

const COMPANY_SEEDS: SeedCompany[] = [
  { name: "Harper & Vale Dental", domain: "harpervale.co.uk", industry: "HEALTHCARE", type: "Dentist", city: "Manchester", region: "Greater Manchester", country: "GB", market: "UK", employees: 14, contact: "Ellie Harper", role: "OWNER", email: "ellie@harpervale.co.uk", opps: ["OUTDATED_WEBSITE", "NO_ONLINE_BOOKING"], services: ["WEBSITE_REDESIGN", "BOOKING_SYSTEM"], fit: "STRONG", priority: "HIGH", stage: "QUALIFIED", tags: ["warm", "Q1"], nextAction: "Send step 1 — redesign + booking angle", dueIn: 1, note: "Practice manager confirmed they lose bookings to the clinic 2 streets over." },
  { name: "Northline Roofing", domain: "northlineroofing.com", industry: "CONSTRUCTION_TRADES", type: "Roofer", city: "Leeds", region: "West Yorkshire", country: "GB", market: "UK", employees: 9, contact: "Marek Nowak", role: "FOUNDER", email: "marek@northlineroofing.com", opps: ["NO_WEBSITE", "WEAK_BRANDING"], services: ["WEBSITE_DESIGN", "BRAND_IDENTITY"], fit: "GOOD", priority: "HIGH", stage: "CONTACTED", tags: ["north"], nextAction: "Follow-up 1 (day 3)", dueIn: 1 },
  { name: "Café Lumen", domain: "cafelumen.nl", industry: "HOSPITALITY_FOOD", type: "Café", city: "Utrecht", region: "Utrecht", country: "NL", market: "Benelux", employees: 6, contact: "Sanne de Vries", role: "OWNER", email: "sanne@cafelumen.nl", opps: ["WEAK_CONVERSION", "NO_LEAD_CAPTURE"], services: ["LANDING_PAGE", "LEAD_GENERATION_SYSTEM"], fit: "GOOD", priority: "MEDIUM", stage: "FOLLOW_UP", tags: ["benelux"], nextAction: "Follow-up 2 — send case study", dueIn: -3 },
  { name: "Blake Legal", domain: "blakelegal.co.uk", industry: "PROFESSIONAL_SERVICES", type: "Law Firm", city: "Bristol", region: "South West", country: "GB", market: "UK", employees: 32, contact: "Amelia Blake", role: "MANAGING_DIRECTOR", email: "amelia@blakelegal.co.uk", opps: ["POOR_USER_EXPERIENCE", "SEO_DISCOVERABILITY"], services: ["UI_UX_DESIGN", "WEBSITE_OPTIMISATION"], fit: "STRONG", priority: "HIGH", stage: "REPLIED", tags: ["hot"], nextAction: "Reply — offer a 20-min site audit", dueIn: 0 },
  { name: "Summit Physio", domain: "summitphysio.ie", industry: "HEALTHCARE", type: "Physiotherapy Clinic", city: "Dublin", region: "Leinster", country: "IE", market: "IE", employees: 11, contact: "Cian Murphy", role: "OWNER", email: "cian@summitphysio.ie", opps: ["POOR_MOBILE_EXPERIENCE"], services: ["WEBSITE_REDESIGN", "WEBSITE_OPTIMISATION"], fit: "POSSIBLE", priority: "MEDIUM", stage: "RESEARCHED", nextAction: "Confirm services + budget signal", dueIn: 2 },
  { name: "Petal & Stone Salon", domain: "petalandstone.com", industry: "BEAUTY_WELLNESS", type: "Hair Salon", city: "Brighton", region: "South East", country: "GB", market: "UK", employees: 7, contact: "", role: "", email: "", opps: ["UNKNOWN"], services: [], fit: "UNKNOWN", priority: "MEDIUM", stage: "NEW" },
  { name: "Vantage Analytics", domain: "vantageanalytics.de", industry: "TECHNOLOGY", type: "SaaS Company", city: "Berlin", region: "Berlin", country: "DE", market: "DACH", employees: 64, contact: "Jonas Weber", role: "OPERATIONS_DIRECTOR", email: "jonas@vantageanalytics.de", opps: ["NEEDS_AUTOMATION", "NEEDS_WEB_APPLICATION"], services: ["BUSINESS_AUTOMATION", "WEB_APPLICATION"], fit: "STRONG", priority: "HIGH", stage: "MEETING", tags: ["dach", "enterprise"], nextAction: "Discovery call — Tue 14:00 CET", dueIn: 2 },
  { name: "Fenwick Garden Rooms", domain: "fenwickgardenrooms.co.uk", industry: "CONSTRUCTION_TRADES", type: "Building Contractor", city: "Norwich", region: "East", country: "GB", market: "UK", employees: 4, contact: "Tom Fenwick", role: "OWNER", email: "tom@fenwickgardenrooms.co.uk", opps: ["WEAK_CONVERSION", "WEBSITE_PERFORMANCE"], services: ["LANDING_PAGE", "WEBSITE_OPTIMISATION"], fit: "STRONG", priority: "HIGH", stage: "PROPOSAL", tags: ["proposal"], nextAction: "Chase proposal (sent 6 days ago)", dueIn: -1 },
  { name: "Larkfield Academy", domain: "larkfield.ac.uk", industry: "EDUCATION_TRAINING", type: "Academy", city: "Nottingham", region: "East Midlands", country: "GB", market: "UK", employees: 120, contact: "Priya Shah", role: "OPERATIONS_DIRECTOR", email: "priya@larkfield.ac.uk", opps: ["POOR_USER_EXPERIENCE"], services: ["WEBSITE_REDESIGN"], fit: "STRONG", priority: "HIGH", stage: "WON", tags: ["client"], nextAction: "Handover to delivery", dueIn: 7 },
  { name: "Ironbridge Motors", domain: "ironbridgemotors.co.uk", industry: "AUTOMOTIVE", type: "Auto Repair Shop", city: "Telford", region: "West Midlands", country: "GB", market: "UK", employees: 18, contact: "Dave Pritchard", role: "OWNER", email: "dave@ironbridgemotors.co.uk", opps: ["OUTDATED_WEBSITE"], services: ["WEBSITE_REDESIGN"], fit: "POOR", priority: "LOW", stage: "LOST", reason: "Hard bounce, no working address" },
  { name: "Copper Kettle Catering", domain: "copperkettle.co.uk", industry: "HOSPITALITY_FOOD", type: "Catering Company", city: "Glasgow", region: "Scotland", country: "GB", market: "UK", employees: 23, contact: "", role: "", email: "", opps: ["UNKNOWN"], services: [], fit: "UNKNOWN", priority: "LOW", stage: "NEW" },
  { name: "Aster Design Studio", domain: "asterdesign.io", industry: "CREATIVE_MEDIA", type: "Design Studio", city: "Rotterdam", region: "South Holland", country: "NL", market: "Benelux", employees: 3, contact: "Lotte Bakker", role: "FOUNDER", email: "lotte@asterdesign.io", opps: ["UNKNOWN"], services: [], fit: "POOR", priority: "DISQUALIFIED", stage: "DISQUALIFIED", reason: "In-house design team — no fit" },
  { name: "Marlow & Finch Accounting", domain: "marlowfinch.co.uk", industry: "PROFESSIONAL_SERVICES", type: "Accounting Firm", city: "Reading", region: "South East", country: "GB", market: "UK", employees: 16, contact: "Helen Finch", role: "MANAGING_DIRECTOR", email: "helen@marlowfinch.co.uk", opps: ["NO_LEAD_CAPTURE", "OUTDATED_WEBSITE"], services: ["LEAD_GENERATION_SYSTEM", "WEBSITE_REDESIGN"], fit: "GOOD", priority: "MEDIUM", stage: "CONTACTED", tags: ["south"], nextAction: "Follow-up 2 (day 7)", dueIn: 0 },
  { name: "Tarn Valley Vets", domain: "tarnvalleyvets.co.uk", industry: "HEALTHCARE", type: "Private Practice", city: "Kendal", region: "North West", country: "GB", market: "UK", employees: 26, contact: "Ruth Ainsley", role: "OWNER", email: "ruth@tarnvalleyvets.co.uk", opps: ["NO_ONLINE_BOOKING", "POOR_MOBILE_EXPERIENCE"], services: ["BOOKING_SYSTEM", "WEBSITE_REDESIGN"], fit: "GOOD", priority: "HIGH", stage: "RESEARCHED", nextAction: "Qualify — check service fit", dueIn: 1 },
  { name: "Ellison & Porter", domain: "ellisonporter.co.uk", industry: "PROFESSIONAL_SERVICES", type: "Consultancy", city: "London", region: "Greater London", country: "GB", market: "UK", employees: 48, contact: "Grace Porter", role: "CEO", email: "grace@ellisonporter.co.uk", opps: ["WEAK_BRANDING", "WEAK_CONVERSION"], services: ["BRAND_REFRESH", "LANDING_PAGE"], fit: "STRONG", priority: "HIGH", stage: "MEETING", tags: ["london", "referral"], nextAction: "Send meeting follow-up + scope", dueIn: 1 },
  { name: "Harbour Lane Opticians", domain: "harbourlaneopt.co.uk", industry: "HEALTHCARE", type: "Optician", city: "Portsmouth", region: "South East", country: "GB", market: "UK", employees: 8, contact: "Iris Coleman", role: "OWNER", email: "iris@harbourlaneopt.co.uk", opps: ["NO_ONLINE_BOOKING"], services: ["BOOKING_SYSTEM"], fit: "GOOD", priority: "MEDIUM", stage: "QUALIFIED", nextAction: "Enroll in Dental & Clinics — booking", dueIn: 3 },
  { name: "Bramble & Oak Interiors", domain: "brambleoak.co.uk", industry: "HOME_SERVICES", type: "Landscaper", city: "Oxford", region: "South East", country: "GB", market: "UK", employees: 12, contact: "Freddie Marsh", role: "FOUNDER", email: "freddie@brambleoak.co.uk", opps: ["OUTDATED_WEBSITE", "SEO_DISCOVERABILITY"], services: ["WEBSITE_REDESIGN", "WEBSITE_OPTIMISATION"], fit: "GOOD", priority: "MEDIUM", stage: "FOLLOW_UP", nextAction: "Follow-up 1 — new portfolio link", dueIn: 2 },
  { name: "Trinity Fitness Collective", domain: "trinityfitness.co.uk", industry: "BEAUTY_WELLNESS", type: "Gym", city: "Liverpool", region: "North West", country: "GB", market: "UK", employees: 19, contact: "Kofi Mensah", role: "GENERAL_MANAGER", email: "kofi@trinityfitness.co.uk", opps: ["WEAK_CONVERSION", "NO_LEAD_CAPTURE"], services: ["LANDING_PAGE", "LEAD_GENERATION_SYSTEM"], fit: "STRONG", priority: "HIGH", stage: "REPLIED", tags: ["hot"], nextAction: "Send membership-funnel case study", dueIn: 0 },
  { name: "Nordwind Reisen", domain: "nordwindreisen.de", industry: "TRAVEL_TOURISM", type: "Tour Operator", city: "Hamburg", region: "Hamburg", country: "DE", market: "DACH", employees: 34, contact: "Lena Hoffmann", role: "MARKETING_DIRECTOR", email: "lena@nordwindreisen.de", opps: ["ECOMMERCE_OPPORTUNITY", "POOR_MOBILE_EXPERIENCE"], services: ["ECOMMERCE", "WEBSITE_REDESIGN"], fit: "GOOD", priority: "MEDIUM", stage: "CONTACTED", nextAction: "Follow-up 1 (day 4)", dueIn: 2 },
  { name: "Silver Street Bakery", domain: "silverstreetbakery.co.uk", industry: "HOSPITALITY_FOOD", type: "Café", city: "Bath", region: "South West", country: "GB", market: "UK", employees: 5, contact: "Nadia Osei", role: "OWNER", email: "nadia@silverstreetbakery.co.uk", opps: ["NO_WEBSITE", "ECOMMERCE_OPPORTUNITY"], services: ["WEBSITE_DESIGN", "ECOMMERCE"], fit: "GOOD", priority: "MEDIUM", stage: "RESEARCHED", nextAction: "Check if they ship nationally", dueIn: 4 },
  { name: "Pennine Legal", domain: "penninelegal.co.uk", industry: "PROFESSIONAL_SERVICES", type: "Law Firm", city: "Sheffield", region: "Yorkshire", country: "GB", market: "UK", employees: 22, contact: "Robert Kite", role: "MANAGING_DIRECTOR", email: "robert@penninelegal.co.uk", opps: ["POOR_USER_EXPERIENCE"], services: ["UI_UX_DESIGN"], fit: "POSSIBLE", priority: "LOW", stage: "NEW" },
  { name: "Glow Aesthetics Clinic", domain: "glow-aesthetics.co.uk", industry: "BEAUTY_WELLNESS", type: "Spa", city: "Birmingham", region: "West Midlands", country: "GB", market: "UK", employees: 10, contact: "Amara Nwosu", role: "OWNER", email: "amara@glow-aesthetics.co.uk", opps: ["NO_ONLINE_BOOKING", "WEAK_BRANDING"], services: ["BOOKING_SYSTEM", "BRAND_IDENTITY"], fit: "STRONG", priority: "HIGH", stage: "QUALIFIED", nextAction: "Enroll — beauty booking sequence", dueIn: 2 },
  { name: "Kestrel Property Group", domain: "kestrelproperty.co.uk", industry: "PROPERTY_REAL_ESTATE", type: "Estate Agency", city: "Leicester", region: "East Midlands", country: "GB", market: "UK", employees: 38, contact: "Dan Whitaker", role: "CEO", email: "dan@kestrelproperty.co.uk", opps: ["WEBSITE_PERFORMANCE", "SEO_DISCOVERABILITY"], services: ["WEBSITE_OPTIMISATION"], fit: "GOOD", priority: "MEDIUM", stage: "PROPOSAL", nextAction: "Proposal call booked Thursday", dueIn: 3 },
  { name: "Blue Anchor Marine", domain: "blueanchormarine.co.uk", industry: "RETAIL_ECOMMERCE", type: "Online Shop", city: "Southampton", region: "South East", country: "GB", market: "UK", employees: 15, contact: "Sean Doyle", role: "OWNER", email: "sean@blueanchormarine.co.uk", opps: ["ECOMMERCE_OPPORTUNITY"], services: ["ECOMMERCE"], fit: "GOOD", priority: "MEDIUM", stage: "CONTACTED", nextAction: "Follow-up 1 — migration angle", dueIn: 1 },
  { name: "Fjord Analytics", domain: "fjordanalytics.no", industry: "TECHNOLOGY", type: "Software Company", city: "Oslo", region: "Oslo", country: "NO", market: "Nordics", employees: 27, contact: "Ingrid Dahl", role: "CEO", email: "ingrid@fjordanalytics.no", opps: ["NEEDS_WEB_APPLICATION"], services: ["WEB_APPLICATION"], fit: "POSSIBLE", priority: "MEDIUM", stage: "NEW" },
  { name: "The Walled Garden", domain: "walledgarden.co.uk", industry: "HOSPITALITY_FOOD", type: "Restaurant", city: "Canterbury", region: "South East", country: "GB", market: "UK", employees: 21, contact: "Bea Hollis", role: "OWNER", email: "bea@walledgarden.co.uk", opps: ["NO_LEAD_CAPTURE", "POOR_MOBILE_EXPERIENCE"], services: ["LEAD_GENERATION_SYSTEM", "WEBSITE_REDESIGN"], fit: "GOOD", priority: "MEDIUM", stage: "FOLLOW_UP", nextAction: "Follow-up 2 — booking widget demo", dueIn: 1 },
  { name: "Halcyon Financial", domain: "halcyonfinancial.co.uk", industry: "FINANCE_INSURANCE", type: "Financial Adviser", city: "Edinburgh", region: "Scotland", country: "GB", market: "UK", employees: 45, contact: "Callum Fraser", role: "MANAGING_DIRECTOR", email: "callum@halcyonfinancial.co.uk", opps: ["WEAK_CONVERSION", "WEAK_BRANDING"], services: ["LANDING_PAGE", "BRAND_REFRESH"], fit: "STRONG", priority: "HIGH", stage: "QUALIFIED", tags: ["priority"], nextAction: "Enroll — finance credibility sequence", dueIn: 0 },
  { name: "Rowan Tree Vet Care", domain: "rowantreevets.co.uk", industry: "HEALTHCARE", type: "Private Practice", city: "York", region: "Yorkshire", country: "GB", market: "UK", employees: 13, contact: "Dr Holly Barnes", role: "OWNER", email: "holly@rowantreevets.co.uk", opps: ["OUTDATED_WEBSITE"], services: ["WEBSITE_REDESIGN"], fit: "GOOD", priority: "MEDIUM", stage: "LOST", reason: "Chose a local freelancer on price" },
  { name: "Midsummer Interiors", domain: "midsummerinteriors.co.uk", industry: "HOME_SERVICES", type: "Cleaning Company", city: "Cambridge", region: "East", country: "GB", market: "UK", employees: 30, contact: "Tessa Young", role: "OPERATIONS_DIRECTOR", email: "tessa@midsummerinteriors.co.uk", opps: ["NEEDS_AUTOMATION", "NO_LEAD_CAPTURE"], services: ["BUSINESS_AUTOMATION", "LEAD_GENERATION_SYSTEM"], fit: "STRONG", priority: "HIGH", stage: "WON", tags: ["client"], nextAction: "Quarterly review booked", dueIn: 14 },
  { name: "Atlas Freight Systems", domain: "atlasfreight.nl", industry: "MANUFACTURING", type: "Industrial Supplier", city: "Eindhoven", region: "North Brabant", country: "NL", market: "Benelux", employees: 85, contact: "Willem Vos", role: "GENERAL_MANAGER", email: "willem@atlasfreight.nl", opps: ["NEEDS_WEB_APPLICATION"], services: ["WEB_APPLICATION"], fit: "POSSIBLE", priority: "MEDIUM", stage: "RESEARCHED", nextAction: "Validate budget owner", dueIn: 5 },
  { name: "Pinewood Dental", domain: "pinewooddental.co.uk", industry: "HEALTHCARE", type: "Dentist", city: "Milton Keynes", region: "South East", country: "GB", market: "UK", employees: 11, contact: "Zara Iqbal", role: "OWNER", email: "zara@pinewooddental.co.uk", opps: ["NO_ONLINE_BOOKING", "WEAK_CONVERSION"], services: ["BOOKING_SYSTEM", "WEBSITE_OPTIMISATION"], fit: "STRONG", priority: "HIGH", stage: "CONTACTED", nextAction: "Follow-up 1 (day 3)", dueIn: 1 },
  { name: "Foundry Coffee Roasters", domain: "foundryroasters.co.uk", industry: "RETAIL_ECOMMERCE", type: "Online Shop", city: "Bristol", region: "South West", country: "GB", market: "UK", employees: 9, contact: "Owen Pike", role: "FOUNDER", email: "owen@foundryroasters.co.uk", opps: ["ECOMMERCE_OPPORTUNITY", "WEAK_BRANDING"], services: ["ECOMMERCE", "BRAND_REFRESH"], fit: "STRONG", priority: "HIGH", stage: "MEETING", nextAction: "Send scope + timeline", dueIn: 2 },
  { name: "Speyside Motors", domain: "speysidemotors.co.uk", industry: "AUTOMOTIVE", type: "Car Dealership", city: "Aberdeen", region: "Scotland", country: "GB", market: "UK", employees: 41, contact: "Fiona Grant", role: "GENERAL_MANAGER", email: "fiona@speysidemotors.co.uk", opps: ["OUTDATED_WEBSITE", "WEBSITE_PERFORMANCE"], services: ["WEBSITE_REDESIGN"], fit: "GOOD", priority: "MEDIUM", stage: "DISQUALIFIED", reason: "Group marketing is handled centrally" },
  { name: "Greenfield Learning", domain: "greenfieldlearning.co.uk", industry: "EDUCATION_TRAINING", type: "Training Company", city: "Leeds", region: "Yorkshire", country: "GB", market: "UK", employees: 24, contact: "Marcus Bell", role: "CEO", email: "marcus@greenfieldlearning.co.uk", opps: ["POOR_USER_EXPERIENCE", "NEEDS_AUTOMATION"], services: ["UI_UX_DESIGN", "BUSINESS_AUTOMATION"], fit: "GOOD", priority: "MEDIUM", stage: "REPLIED", nextAction: "Answer pricing question", dueIn: 0 },
  { name: "Loom & Larder", domain: "loomandlarder.co.uk", industry: "HOSPITALITY_FOOD", type: "Restaurant", city: "Bristol", region: "South West", country: "GB", market: "UK", employees: 17, contact: "", role: "", email: "hello@loomandlarder.co.uk", opps: ["UNKNOWN"], services: [], fit: "UNKNOWN", priority: "MEDIUM", stage: "NEW" },
  { name: "Cobalt Security", domain: "cobaltsecurity.co.uk", industry: "TECHNOLOGY", type: "IT Services", city: "Reading", region: "South East", country: "GB", market: "UK", employees: 56, contact: "Priya Raman", role: "MARKETING_DIRECTOR", email: "priya@cobaltsecurity.co.uk", opps: ["WEAK_CONVERSION", "SEO_DISCOVERABILITY"], services: ["WEBSITE_OPTIMISATION", "LANDING_PAGE"], fit: "GOOD", priority: "HIGH", stage: "CONTACTED", nextAction: "Follow-up 2 (day 7)", dueIn: 3 },
  { name: "Wildacre Landscapes", domain: "wildacrelandscapes.co.uk", industry: "HOME_SERVICES", type: "Landscaper", city: "Guildford", region: "South East", country: "GB", market: "UK", employees: 6, contact: "Jamie Corr", role: "OWNER", email: "jamie@wildacrelandscapes.co.uk", opps: ["NO_WEBSITE"], services: ["WEBSITE_DESIGN"], fit: "GOOD", priority: "MEDIUM", stage: "QUALIFIED", nextAction: "Enroll — home services sequence", dueIn: 2 },
  { name: "Bristol Bike Works", domain: "bristolbikeworks.co.uk", industry: "RETAIL_ECOMMERCE", type: "Retail Store", city: "Bristol", region: "South West", country: "GB", market: "UK", employees: 8, contact: "Theo Marsh", role: "OWNER", email: "theo@bristolbikeworks.co.uk", opps: ["ECOMMERCE_OPPORTUNITY", "NO_LEAD_CAPTURE"], services: ["ECOMMERCE", "LEAD_GENERATION_SYSTEM"], fit: "POSSIBLE", priority: "MEDIUM", stage: "RESEARCHED", nextAction: "Check current platform", dueIn: 6 },
  { name: "Meridian Estates", domain: "meridianestates.co.uk", industry: "PROPERTY_REAL_ESTATE", type: "Property Manager", city: "London", region: "Greater London", country: "GB", market: "UK", employees: 72, contact: "Alexei Petrov", role: "OPERATIONS_DIRECTOR", email: "alexei@meridianestates.co.uk", opps: ["NEEDS_AUTOMATION", "NEEDS_WEB_APPLICATION"], services: ["BUSINESS_AUTOMATION", "WEB_APPLICATION"], fit: "STRONG", priority: "HIGH", stage: "PROPOSAL", nextAction: "Proposal review Friday", dueIn: 4 },
  { name: "Saltmarsh Studio", domain: "saltmarsh.studio", industry: "CREATIVE_MEDIA", type: "Photography Studio", city: "Brighton", region: "South East", country: "GB", market: "UK", employees: 2, contact: "Rae Sutton", role: "FOUNDER", email: "rae@saltmarsh.studio", opps: ["WEAK_BRANDING"], services: ["BRAND_IDENTITY"], fit: "POOR", priority: "LOW", stage: "NEW" },
  { name: "Arden Dental Care", domain: "ardendental.co.uk", industry: "HEALTHCARE", type: "Dentist", city: "Stratford-upon-Avon", region: "West Midlands", country: "GB", market: "UK", employees: 9, contact: "Nina Archer", role: "OWNER", email: "nina@ardendental.co.uk", opps: ["NO_ONLINE_BOOKING", "OUTDATED_WEBSITE"], services: ["BOOKING_SYSTEM", "WEBSITE_REDESIGN"], fit: "STRONG", priority: "HIGH", stage: "CONTACTED", nextAction: "Follow-up 1 (day 3)", dueIn: -1 },
  { name: "Ridgeway Plumbing", domain: "ridgewayplumbing.co.uk", industry: "HOME_SERVICES", type: "Plumbing Company", city: "Swindon", region: "South West", country: "GB", market: "UK", employees: 5, contact: "Gary Lock", role: "OWNER", email: "gary@ridgewayplumbing.co.uk", opps: ["NO_WEBSITE"], services: ["WEBSITE_DESIGN"], fit: "GOOD", priority: "MEDIUM", stage: "NEW" },
  { name: "Baltic Studio", domain: "balticstudio.pl", industry: "CREATIVE_MEDIA", type: "Production Company", city: "Gdansk", region: "Pomerania", country: "PL", market: "CEE", employees: 14, contact: "Marta Zielinska", role: "FOUNDER", email: "marta@balticstudio.pl", opps: ["WEAK_CONVERSION"], services: ["LANDING_PAGE"], fit: "POSSIBLE", priority: "LOW", stage: "NEW" },
  { name: "Hearth & Home Legal", domain: "hearthhomelegal.co.uk", industry: "PROFESSIONAL_SERVICES", type: "Law Firm", city: "Exeter", region: "South West", country: "GB", market: "UK", employees: 18, contact: "Simon Vellacott", role: "MANAGING_DIRECTOR", email: "simon@hearthhomelegal.co.uk", opps: ["SEO_DISCOVERABILITY", "POOR_MOBILE_EXPERIENCE"], services: ["WEBSITE_OPTIMISATION", "WEBSITE_REDESIGN"], fit: "GOOD", priority: "MEDIUM", stage: "FOLLOW_UP", nextAction: "Follow-up 1 — audit summary", dueIn: 2 },
  { name: "Orchard Physio", domain: "orchardphysio.co.uk", industry: "HEALTHCARE", type: "Physiotherapy Clinic", city: "Cheltenham", region: "South West", country: "GB", market: "UK", employees: 7, contact: "Becca Flint", role: "OWNER", email: "becca@orchardphysio.co.uk", opps: ["NO_ONLINE_BOOKING"], services: ["BOOKING_SYSTEM"], fit: "GOOD", priority: "MEDIUM", stage: "QUALIFIED", nextAction: "Enroll — clinic booking sequence", dueIn: 3 },
  { name: "Tidewater Hotels", domain: "tidewaterhotels.com", industry: "TRAVEL_TOURISM", type: "Hotel", city: "Bournemouth", region: "South West", country: "GB", market: "UK", employees: 95, contact: "Ravi Chandran", role: "GENERAL_MANAGER", email: "ravi@tidewaterhotels.com", opps: ["WEAK_CONVERSION", "SEO_DISCOVERABILITY"], services: ["WEBSITE_OPTIMISATION", "LANDING_PAGE"], fit: "GOOD", priority: "MEDIUM", stage: "RESEARCHED", nextAction: "Qualify — brand guidelines check", dueIn: 3 },
  { name: "Brightline Electrics", domain: "brightlineelectrics.co.uk", industry: "HOME_SERVICES", type: "Electrical Contractor", city: "Coventry", region: "West Midlands", country: "GB", market: "UK", employees: 11, contact: "Danny O'Rourke", role: "OWNER", email: "danny@brightlineelectrics.co.uk", opps: ["OUTDATED_WEBSITE", "NO_LEAD_CAPTURE"], services: ["WEBSITE_REDESIGN", "LEAD_GENERATION_SYSTEM"], fit: "GOOD", priority: "MEDIUM", stage: "CONTACTED", nextAction: "Follow-up 2 (day 7)", dueIn: 4 },
  { name: "Verdant Farms", domain: "verdantfarms.co.uk", industry: "AGRICULTURE", type: "Food Processor", city: "Hereford", region: "West Midlands", country: "GB", market: "UK", employees: 44, contact: "Huw Bevan", role: "OPERATIONS_DIRECTOR", email: "huw@verdantfarms.co.uk", opps: ["NEEDS_AUTOMATION"], services: ["BUSINESS_AUTOMATION"], fit: "POSSIBLE", priority: "LOW", stage: "NEW" },
  { name: "Studio Nord", domain: "studionord.dk", industry: "CREATIVE_MEDIA", type: "Design Studio", city: "Copenhagen", region: "Capital Region", country: "DK", market: "Nordics", employees: 8, contact: "Freja Holm", role: "FOUNDER", email: "freja@studionord.dk", opps: ["WEAK_BRANDING", "WEAK_CONVERSION"], services: ["BRAND_REFRESH", "LANDING_PAGE"], fit: "GOOD", priority: "MEDIUM", stage: "QUALIFIED", nextAction: "Enroll — studio growth sequence", dueIn: 2 },
  { name: "Cairn Adventure", domain: "cairnadventure.co.uk", industry: "TRAVEL_TOURISM", type: "Tour Operator", city: "Fort William", region: "Scotland", country: "GB", market: "UK", employees: 6, contact: "Ewan Ross", role: "OWNER", email: "ewan@cairnadventure.co.uk", opps: ["ECOMMERCE_OPPORTUNITY", "POOR_MOBILE_EXPERIENCE"], services: ["ECOMMERCE", "WEBSITE_REDESIGN"], fit: "STRONG", priority: "HIGH", stage: "MEETING", nextAction: "Send itinerary + booking flow plan", dueIn: 1 },
  { name: "Maple & Main Accountants", domain: "mapleandmain.co.uk", industry: "PROFESSIONAL_SERVICES", type: "Accounting Firm", city: "Nottingham", region: "East Midlands", country: "GB", market: "UK", employees: 21, contact: "Owen Hart", role: "MANAGING_DIRECTOR", email: "owen@mapleandmain.co.uk", opps: ["WEAK_CONVERSION", "NO_LEAD_CAPTURE"], services: ["LANDING_PAGE", "LEAD_GENERATION_SYSTEM"], fit: "GOOD", priority: "MEDIUM", stage: "QUALIFIED", nextAction: "Enroll — accountant lead gen", dueIn: 4 },
  { name: "Sable Interiors", domain: "sableinteriors.co.uk", industry: "HOME_SERVICES", type: "Renovation Company", city: "Bath", region: "South West", country: "GB", market: "UK", employees: 13, contact: "Cleo Adams", role: "FOUNDER", email: "cleo@sableinteriors.co.uk", opps: ["OUTDATED_WEBSITE", "SEO_DISCOVERABILITY"], services: ["WEBSITE_REDESIGN", "WEBSITE_OPTIMISATION"], fit: "GOOD", priority: "MEDIUM", stage: "RESEARCHED", nextAction: "Check project sizes", dueIn: 5 },
  { name: "Hartley Vets", domain: "hartleyvets.co.uk", industry: "HEALTHCARE", type: "Private Practice", city: "Chelmsford", region: "East", country: "GB", market: "UK", employees: 15, contact: "Dr Owen Price", role: "OWNER", email: "owen@hartleyvets.co.uk", opps: ["POOR_MOBILE_EXPERIENCE", "NO_ONLINE_BOOKING"], services: ["WEBSITE_REDESIGN", "BOOKING_SYSTEM"], fit: "STRONG", priority: "HIGH", stage: "CONTACTED", nextAction: "Follow-up 1 (day 3)", dueIn: 1 },
  { name: "Lumen Analytics", domain: "lumenanalytics.ch", industry: "TECHNOLOGY", type: "SaaS Company", city: "Zurich", region: "Zurich", country: "CH", market: "DACH", employees: 33, contact: "Nico Brunner", role: "CEO", email: "nico@lumenanalytics.ch", opps: ["NEEDS_WEB_APPLICATION", "WEAK_CONVERSION"], services: ["WEB_APPLICATION", "LANDING_PAGE"], fit: "GOOD", priority: "HIGH", stage: "REPLIED", nextAction: "Scope call — propose 2 slots", dueIn: 0 },
  { name: "Forge & Field", domain: "forgeandfield.co.uk", industry: "MANUFACTURING", type: "Fabricator", city: "Wolverhampton", region: "West Midlands", country: "GB", market: "UK", employees: 67, contact: "Karl Bennett", role: "OPERATIONS_DIRECTOR", email: "karl@forgeandfield.co.uk", opps: ["NEEDS_AUTOMATION"], services: ["BUSINESS_AUTOMATION"], fit: "POSSIBLE", priority: "LOW", stage: "NEW" },
  { name: "Seabright Holidays", domain: "seabrightholidays.co.uk", industry: "TRAVEL_TOURISM", type: "Travel Agency", city: "Torquay", region: "South West", country: "GB", market: "UK", employees: 12, contact: "Marie Dupont", role: "GENERAL_MANAGER", email: "marie@seabrightholidays.co.uk", opps: ["WEAK_BRANDING", "SEO_DISCOVERABILITY"], services: ["BRAND_REFRESH", "WEBSITE_OPTIMISATION"], fit: "GOOD", priority: "MEDIUM", stage: "LOST", reason: "Budget frozen until next financial year" },
  { name: "Olive Tree Clinic", domain: "olivetreeclinic.co.uk", industry: "HEALTHCARE", type: "Medical Clinic", city: "London", region: "Greater London", country: "GB", market: "UK", employees: 29, contact: "Dr Yusuf Ali", role: "OWNER", email: "yusuf@olivetreeclinic.co.uk", opps: ["NO_ONLINE_BOOKING", "POOR_USER_EXPERIENCE"], services: ["BOOKING_SYSTEM", "UI_UX_DESIGN"], fit: "STRONG", priority: "HIGH", stage: "PROPOSAL", nextAction: "Chase proposal (day 5)", dueIn: 2 },
  { name: "Kite Studio", domain: "kitestudio.co.uk", industry: "CREATIVE_MEDIA", type: "Marketing Agency", city: "Manchester", region: "Greater Manchester", country: "GB", market: "UK", employees: 16, contact: "Lily Chen", role: "FOUNDER", email: "lily@kitestudio.co.uk", opps: ["WEAK_CONVERSION"], services: ["LANDING_PAGE"], fit: "POOR", priority: "LOW", stage: "DISQUALIFIED", reason: "Direct competitor — conflict of interest" },
  { name: "Alder Garden Design", domain: "aldergardendesign.co.uk", industry: "HOME_SERVICES", type: "Landscaper", city: "Winchester", region: "South East", country: "GB", market: "UK", employees: 4, contact: "Imogen Tait", role: "OWNER", email: "imogen@aldergardendesign.co.uk", opps: ["NO_WEBSITE", "WEAK_BRANDING"], services: ["WEBSITE_DESIGN", "BRAND_IDENTITY"], fit: "STRONG", priority: "HIGH", stage: "QUALIFIED", nextAction: "Enroll — portfolio site sequence", dueIn: 1 },
  { name: "Northgate Motors", domain: "northgatemotors.co.uk", industry: "AUTOMOTIVE", type: "Detailing Studio", city: "Newcastle", region: "North East", country: "GB", market: "UK", employees: 3, contact: "Ryan Dobson", role: "OWNER", email: "ryan@northgatemotors.co.uk", opps: ["OUTDATED_WEBSITE", "NO_LEAD_CAPTURE"], services: ["WEBSITE_REDESIGN", "LEAD_GENERATION_SYSTEM"], fit: "GOOD", priority: "MEDIUM", stage: "RESEARCHED", nextAction: "Qualify — check capacity", dueIn: 4 },
  { name: "Elmwood School Trust", domain: "elmwoodtrust.org.uk", industry: "EDUCATION_TRAINING", type: "School", city: "Ipswich", region: "East", country: "GB", market: "UK", employees: 180, contact: "Hannah Poole", role: "OPERATIONS_DIRECTOR", email: "hannah@elmwoodtrust.org.uk", opps: ["POOR_USER_EXPERIENCE", "NEEDS_AUTOMATION"], services: ["UI_UX_DESIGN", "BUSINESS_AUTOMATION"], fit: "POSSIBLE", priority: "LOW", stage: "NEW" },
  { name: "Quay Coffee", domain: "quaycoffee.co.uk", industry: "HOSPITALITY_FOOD", type: "Café", city: "Poole", region: "South West", country: "GB", market: "UK", employees: 8, contact: "Elliot Grange", role: "OWNER", email: "elliot@quaycoffee.co.uk", opps: ["NO_LEAD_CAPTURE", "ECOMMERCE_OPPORTUNITY"], services: ["LEAD_GENERATION_SYSTEM", "ECOMMERCE"], fit: "GOOD", priority: "MEDIUM", stage: "QUALIFIED", nextAction: "Enroll — retail sequence", dueIn: 5 },
];

async function main() {
  console.log("resetting…");
  await reset();

  const [workspace] = await db
    .insert(workspaces)
    .values({
      name: "Acme Studio",
      timezone: "Europe/London",
      sendWindowStart: "09:00",
      sendWindowEnd: "17:00",
      dailySendCap: 50,
      hourlySendCap: 60,
      setupCompletedAt: new Date(),
    })
    .returning();

  const team = await db
    .insert(users)
    .values([
      { workspaceId: workspace.id, email: "sam@acmestudio.co", name: "Sam Whitfield", role: "OWNER", status: "ACTIVE", sessionVersion: 1 },
      { workspaceId: workspace.id, email: "amelia@acmestudio.co", name: "Amelia Ross", role: "ADMIN", status: "ACTIVE", sessionVersion: 1 },
      { workspaceId: workspace.id, email: "noah@acmestudio.co", name: "Noah Kim", role: "MEMBER", status: "ACTIVE", sessionVersion: 1 },
    ])
    .returning();
  const [sam, amelia, noah] = team;

  await db.insert(industries).values(INDUSTRIES.map(([slug, label]) => ({ slug, label })));

  const btRows: { industrySlug: string; label: string; slug: string }[] = [];
  for (const [industry, types] of Object.entries(BUSINESS_TYPES)) {
    for (const type of types) btRows.push({ industrySlug: industry, label: type, slug: slugify(type) });
  }
  const businessTypeRows = await db.insert(businessTypes).values(btRows).returning();
  const btByLabel = new Map(businessTypeRows.map((b) => [`${b.industrySlug}:${b.slug}`, b.id]));

  await db.insert(integrationCredentials).values([
    {
      workspaceId: workspace.id, kind: "APIFY", label: "Workspace token",
      config: { workspace: "acme-studio", tier: "starter" },
      verifiedAt: ago(40),
    },
    {
      workspaceId: workspace.id, kind: "RESEND", label: "acmestudio.co",
      config: { domain: "acmestudio.co", fromName: "Acme Studio", fromEmail: "outreach@acmestudio.co" },
      verifiedAt: ago(18),
    },
    {
      workspaceId: workspace.id, kind: "IMAP", label: "hello@acmestudio.co",
      config: { host: "imap.mock.local", port: 993, user: "hello@acmestudio.co" },
      verifiedAt: ago(18),
    },
  ]);

  const [rule] = await db
    .insert(qualificationRules)
    .values({
      workspaceId: workspace.id,
      name: "UK small business · web opportunity",
      description: "Strong or good fit, at least one web opportunity, owner reachable.",
      match: "ALL",
      conditions: [
        { field: "industry", operator: "in_list", value: ["HEALTHCARE", "HOME_SERVICES", "CONSTRUCTION_TRADES", "PROFESSIONAL_SERVICES"], weight: 2 },
        { field: "company_size", operator: "in_list", value: ["MICRO", "SMALL", "SMALL_MEDIUM"], weight: 2 },
        { field: "opportunity", operator: "in_list", value: ["OUTDATED_WEBSITE", "NO_WEBSITE", "NO_ONLINE_BOOKING"], weight: 3 },
      ],
      revision: 1,
      isActive: true,
      createdBy: sam.id,
    })
    .returning();

  const offerRows = await db
    .insert(offers)
    .values([
      {
        workspaceId: workspace.id,
        name: "Website Redesign Sprint",
        summary: "4-week redesign for service businesses that look dated and lose enquiries.",
        valuePropMd: "**A site that sells while you work.**\n\nWe rebuild your site around one job — turning visitors into booked enquiries. Fixed scope, fixed price, live in four weeks.",
        priceText: "from £4,200",
        constraints: "One decision maker, content ready within 2 weeks.",
      },
      {
        workspaceId: workspace.id,
        name: "Booking System Install",
        summary: "Online booking that removes phone tag for clinics and salons.",
        valuePropMd: "**Fewer phone calls, more bookings.**\n\nWe install and configure online booking, sync it with your calendar, and train the front desk.",
        priceText: "from £1,800",
        constraints: "Requires an existing website or a landing page.",
      },
      {
        workspaceId: workspace.id,
        name: "Lead Engine",
        summary: "Landing page + follow-up automation for firms with no lead capture.",
        valuePropMd: "**Turn traffic into a pipeline.**\n\nOne high-converting landing page, lead capture, and an automated follow-up sequence wired into your inbox.",
        priceText: "from £2,600 + £180/mo",
        constraints: "Needs a traffic source — ads, SEO, or outbound.",
      },
    ])
    .returning();

  await db.insert(offerServices).values([
    { offerId: offerRows[0].id, service: "WEBSITE_REDESIGN" },
    { offerId: offerRows[0].id, service: "WEBSITE_DESIGN" },
    { offerId: offerRows[1].id, service: "BOOKING_SYSTEM" },
    { offerId: offerRows[2].id, service: "LANDING_PAGE" },
    { offerId: offerRows[2].id, service: "LEAD_GENERATION_SYSTEM" },
  ]);

  const templateRows = await db
    .insert(emailTemplates)
    .values([
      {
        workspaceId: workspace.id,
        name: "Redesign — opener",
        subject: "{{business_name}} — quick site question",
        bodyMd: "Hi {{first_name}},\n\nI had a look at {{website}} — the work is strong, but the site makes it harder than it should be for people to get in touch.\n\nWe rebuild sites like yours around one job: turning visitors into enquiries. Recently did this for a {{business_type}} in {{city}} and they saw a 40% lift in enquiries in the first month.\n\nWorth a 15-minute look at what we'd change?\n\n— Sam",
        offerId: offerRows[0].id,
        category: "opener",
      },
      {
        workspaceId: workspace.id,
        name: "Redesign — follow-up 1",
        subject: "Re: {{business_name}} — quick site question",
        bodyMd: "Hi {{first_name}},\n\nFollowing up on my note about {{business_name}}.\n\nOne concrete thing: on mobile your enquiry form takes four screens to reach. That's usually where bookings drop off.\n\nHappy to send a 3-minute Loom walking through it — no call needed.\n\n— Sam",
        offerId: offerRows[0].id,
        category: "follow-up",
      },
      {
        workspaceId: workspace.id,
        name: "Booking — opener",
        subject: "{{business_name}} — still taking bookings by phone?",
        bodyMd: "Hi {{first_name}},\n\nMost {{business_type}}s in {{city}} still take bookings by phone, which means every missed call is a lost booking.\n\nWe set up online booking that syncs to your calendar and takes about a week to go live. No new site required.\n\nWould it help if I sent a 2-minute demo?\n\n— Sam",
        offerId: offerRows[1].id,
        category: "opener",
      },
      {
        workspaceId: workspace.id,
        name: "Lead gen — opener",
        subject: "Quick idea for {{business_name}}",
        bodyMd: "Hi {{first_name}},\n\nYou're getting traffic to {{website}}, but there's no obvious next step for someone who isn't ready to call.\n\nWe'd add one landing page and a simple follow-up sequence so those visitors become enquiries instead of bouncing.\n\nWant me to sketch what that would look like for {{business_name}}?\n\n— Sam",
        offerId: offerRows[2].id,
        category: "opener",
      },
      {
        workspaceId: workspace.id,
        name: "Break-up",
        subject: "Closing the loop, {{first_name}}",
        bodyMd: "Hi {{first_name}},\n\nI'll stop here so I'm not cluttering your inbox.\n\nIf the site work becomes a priority later, just reply to this email and I'll pick it back up.\n\n— Sam",
        category: "breakup",
      },
    ])
    .returning();

  const seqRows = await db
    .insert(sequences)
    .values([
      {
        workspaceId: workspace.id,
        name: "Website redesign — UK services",
        description: "3-step opener / proof / break-up for dated service-business sites.",
        status: "ACTIVE",
        createdBy: sam.id,
      },
      {
        workspaceId: workspace.id,
        name: "Clinic booking — follow-up",
        description: "Booking-system angle for clinics and salons. Draft.",
        status: "DRAFT",
        createdBy: amelia.id,
      },
    ])
    .returning();

  await db.insert(sequenceSteps).values([
    { sequenceId: seqRows[0].id, position: 0, templateId: templateRows[0].id, delayBusinessDays: 0 },
    { sequenceId: seqRows[0].id, position: 1, templateId: templateRows[1].id, delayBusinessDays: 3 },
    { sequenceId: seqRows[0].id, position: 2, templateId: templateRows[4].id, delayBusinessDays: 5 },
    { sequenceId: seqRows[1].id, position: 0, templateId: templateRows[2].id, delayBusinessDays: 0 },
    { sequenceId: seqRows[1].id, position: 1, templateId: templateRows[1].id, delayBusinessDays: 3 },
  ]);

  const sourceRows = await db
    .insert(leadSources)
    .values([
      {
        workspaceId: workspace.id,
        name: "Google Maps — UK service businesses",
        description: "Owner-run service businesses, 5–50 staff, UK cities.",
        actorId: "compass/google-maps-scraper",
        actorName: "Google Maps Scraper",
        inputDefaults: { searchStrings: ["dentist manchester", "roofer leeds", "cafe bristol"], maxItems: 40, language: "en" },
        mapping: { title: "business_name", website: "website", email: "email", contactName: "contact_name", jobTitle: "role", city: "city", region: "region", countryCode: "country", category: "business_type", employees: "employees", industrySlug: "industry", opportunities: "opportunities", phone: "phone" },
        defaultIndustry: "HEALTHCARE",
        defaultMarket: "UK",
        schedule: "WEEKLY",
        scheduleHour: 8,
        createdBy: sam.id,
        lastRunAt: ago(6),
      },
      {
        workspaceId: workspace.id,
        name: "Instagram — Benelux studios",
        description: "Creative and wellness studios in NL/BE with weak sites.",
        actorId: "apify/instagram-scraper",
        actorName: "Instagram Scraper",
        inputDefaults: { search: "design studio utrecht", resultsLimit: 25 },
        mapping: { fullName: "business_name", website: "website", email: "email", city: "city", biography: "notes" },
        defaultIndustry: "CREATIVE_MEDIA",
        defaultMarket: "Benelux",
        schedule: "OFF",
        createdBy: amelia.id,
        lastRunAt: ago(12),
      },
    ])
    .returning();

  await db.insert(sourceRuns).values([
    {
      workspaceId: workspace.id, sourceId: sourceRows[0].id, status: "IMPORTED",
      apifyRunId: "seed_run_1", startedAt: ago(6), finishedAt: ago(6),
      itemsFetched: 412, itemsImported: 380, itemsDuplicate: 24, itemsInvalid: 8,
      itemsQualified: 96, itemsDisqualified: 284,
      sampleItems: [{ title: "Harper & Vale Dental", city: "Manchester", employees: 14 }],
      skipped: [{ reason: "duplicate_email" }, { reason: "missing_business_name" }],
    },
    {
      workspaceId: workspace.id, sourceId: sourceRows[0].id, status: "IMPORTED",
      apifyRunId: "seed_run_2", startedAt: ago(13), finishedAt: ago(13),
      itemsFetched: 260, itemsImported: 241, itemsDuplicate: 12, itemsInvalid: 7,
      itemsQualified: 61, itemsDisqualified: 180,
      sampleItems: [{ title: "Northline Roofing", city: "Leeds", employees: 9 }],
    },
    {
      workspaceId: workspace.id, sourceId: sourceRows[1].id, status: "FAILED",
      apifyRunId: "seed_run_3", startedAt: ago(12), finishedAt: ago(12),
      itemsFetched: 0, itemsImported: 0,
      error: { code: "APIFY_QUOTA", message: "Monthly actor quota reached — upgrade the Apify plan or wait for the reset." },
    },
  ]);

  // ── prospects ────────────────────────────────────────────────────────────
  const tagRows = await db
    .insert(tags)
    .values([...new Set(COMPANY_SEEDS.flatMap((c) => c.tags ?? []))].map((label) => ({
      workspaceId: workspace.id, label, slug: slugify(label),
    })))
    .returning();
  const tagBySlug = new Map(tagRows.map((t) => [t.slug, t.id]));

  const prospectIds: { company: SeedCompany; id: string }[] = [];

  for (const [index, c] of COMPANY_SEEDS.entries()) {
    const owner = index % 3 === 0 ? sam : index % 3 === 1 ? amelia : noah;
    const createdAt = ago(60 - index);
    const [row] = await db
      .insert(prospects)
      .values({
        workspaceId: workspace.id,
        businessName: c.name,
        website: c.domain ? `https://${c.domain}` : null,
        domainNormalized: c.domain,
        industrySlug: c.industry,
        businessTypeId: btByLabel.get(`${c.industry}:${slugify(c.type)}`) ?? null,
        employeeCount: c.employees,
        companySize: deriveSize(c.employees) as never,
        city: c.city,
        region: c.region,
        countryCode: c.country,
        market: c.market,
        fit: c.fit as never,
        priority: c.priority as never,
        stage: c.stage as never,
        contactability: c.stage === "LOST" && c.reason?.includes("bounce") ? "BOUNCED" : "OK",
        contactName: c.contact || null,
        contactFirstName: c.contact ? c.contact.split(" ")[0] : null,
        contactLastName: c.contact ? c.contact.split(" ").slice(1).join(" ") : null,
        contactRole: (c.role || null) as never,
        contactEmail: c.email || null,
        contactEmailNormalized: c.email ? c.email.toLowerCase() : null,
        contactQuality: c.email ? (c.stage === "NEW" ? "UNVERIFIED" : "VERIFIED") : "UNKNOWN",
        nextAction: c.nextAction ?? null,
        followUpDate: c.dueIn !== undefined ? dateOnly(c.dueIn >= 0 ? ahead(c.dueIn) : ago(-c.dueIn)) : null,
        closedReason: c.reason ?? null,
        qualificationRuleId: rule.id,
        sourceId: index % 4 === 0 ? sourceRows[1].id : sourceRows[0].id,
        sourceLabel: index % 4 === 0 ? "Apify · Instagram Benelux" : index % 5 === 0 ? "Referral" : "Apify · Google Maps UK",
        ownerUserId: owner.id,
        customFields: index % 7 === 0 ? { linkedin: `https://linkedin.com/company/${slugify(c.name)}` } : {},
        lastContactedAt: ["CONTACTED", "FOLLOW_UP", "REPLIED", "MEETING", "PROPOSAL", "WON", "LOST"].includes(c.stage) ? ago(2 + (index % 9)) : null,
        lastReplyAt: ["REPLIED", "MEETING", "PROPOSAL", "WON"].includes(c.stage) ? ago(1 + (index % 4)) : null,
        createdAt,
        updatedAt: createdAt,
      })
      .returning();

    prospectIds.push({ company: c, id: row.id });

    if (c.opps.length) {
      await db.insert(prospectOpportunities).values(c.opps.map((opportunity) => ({ prospectId: row.id, opportunity: opportunity as never })));
    }
    if (c.services.length) {
      await db.insert(prospectServices).values(c.services.map((service) => ({ prospectId: row.id, service: service as never })));
    }
    if (c.tags?.length) {
      await db.insert(prospectTags).values(c.tags.map((t) => ({ prospectId: row.id, tagId: tagBySlug.get(slugify(t))! })));
    }

    const events: { type: string; payload: Record<string, unknown>; createdAt: Date }[] = [
      { type: "created", payload: { source: "seed" }, createdAt },
    ];
    if (!["NEW"].includes(c.stage)) {
      events.push({ type: "stage_changed", payload: { from: "NEW", to: "RESEARCHED" }, createdAt: ago(50 - index) });
    }
    if (!["NEW", "RESEARCHED"].includes(c.stage)) {
      events.push({ type: "stage_changed", payload: { from: "RESEARCHED", to: "QUALIFIED" }, createdAt: ago(45 - index) });
    }
    if (c.reason) {
      events.push({ type: "stage_changed", payload: { to: c.stage, reason: c.reason }, createdAt: ago(3) });
    }
    await db.insert(prospectEvents).values(events.map((e) => ({ prospectId: row.id, ...e })));
    if (c.note) {
      await db.insert(prospectNotes).values({ prospectId: row.id, bodyMd: c.note, authorUserId: owner.id, createdAt: ago(4) });
    }
  }

  // ── messages, enrollments and replies ────────────────────────────────────
  const contacted = prospectIds.filter((p) =>
    ["CONTACTED", "FOLLOW_UP", "REPLIED", "MEETING", "PROPOSAL", "WON"].includes(p.company.stage),
  );

  let sendIndex = 0;
  for (const { company, id } of contacted) {
    sendIndex++;
    const steps = company.stage === "FOLLOW_UP" ? 2 : company.stage === "CONTACTED" ? 1 : 2;
    const [enrollment] = await db
      .insert(enrollments)
      .values({
        workspaceId: workspace.id,
        sequenceId: seqRows[0].id,
        prospectId: id,
        status: company.stage === "REPLIED" || company.stage === "MEETING" || company.stage === "PROPOSAL" || company.stage === "WON"
          ? "STOPPED" : "ACTIVE",
        currentStep: steps,
        nextSendAt: company.stage === "CONTACTED" || company.stage === "FOLLOW_UP" ? ahead(1 + (sendIndex % 3)) : null,
        stopReason: ["REPLIED", "MEETING", "PROPOSAL", "WON"].includes(company.stage) ? "replied" : null,
        enrolledBy: sam.id,
        createdAt: ago(14),
      })
      .returning();

    for (let s = 0; s < steps; s++) {
      const sentAt = ago(12 - s * 3 + (sendIndex % 3));
      const opened = (sendIndex + s) % 3 !== 0;
      await db.insert(messages).values({
        workspaceId: workspace.id,
        enrollmentId: enrollment.id,
        prospectId: id,
        toEmail: company.email,
        fromEmail: "outreach@acmestudio.co",
        subject: s === 0 ? `${company.name} — quick site question` : `Re: ${company.name} — quick site question`,
        bodyMd: `Hi ${company.contact.split(" ")[0] || "there"},\n\nA note about ${company.name} and the site. Worth a quick look?`,
        text: `Hi ${company.contact.split(" ")[0] || "there"},\n\nA note about ${company.name} and the site. Worth a quick look?`,
        provider: "resend",
        providerMessageId: `seed_em_${sendIndex}_${s}`,
        messageIdHeader: `<seed_${sendIndex}_${s}@acmestudio.co>`,
        status: "SENT",
        openCount: opened ? 1 + ((sendIndex + s) % 3) : 0,
        sentAt,
        openedAt: opened ? new Date(sentAt.getTime() + 3600_000) : null,
      });
    }
  }

  const replyBodies: [string, string, string][] = [
    ["Blake Legal", "Thanks Sam — timing is good. We're redoing the site in Q1 and the current one is embarrassing. Can you send a couple of examples and a rough price?", "POSITIVE"],
    ["Trinity Fitness Collective", "This is relevant. We're losing sign-ups because the join flow is a mess. What would a fix look like?", "POSITIVE"],
    ["Greenfield Learning", "Interesting. What's the typical cost for something like this? We have a board meeting on the 14th.", "NEUTRAL"],
    ["Lumen Analytics", "Happy to talk. I'm the wrong person for budget but I can bring our COO. Thursday or Friday next week?", "POSITIVE"],
    ["Café Lumen", "Not right now — we've just had a new site built. Maybe revisit after summer.", "NOT_INTERESTED"],
    ["Ellison & Porter", "Who are you and how did you get my email?", "NEGATIVE"],
  ];

  for (const [business, body, outcome] of replyBodies) {
    const target = prospectIds.find((p) => p.company.name === business);
    if (!target) continue;
    const [lastMessage] = await db
      .select()
      .from(messages)
      .where(sql`${messages.prospectId} = ${target.id}`)
      .limit(1);
    await db.insert(replies).values({
      workspaceId: workspace.id,
      prospectId: target.id,
      messageId: lastMessage?.id ?? null,
      fromEmail: target.company.email,
      toEmail: "hello@acmestudio.co",
      subject: `Re: ${target.company.name} — quick site question`,
      bodyText: body,
      snippet: body.slice(0, 200),
      receivedAt: ago(1 + Math.floor(Math.random() * 4)),
      imapUid: 1200 + replyBodies.findIndex(([b]) => b === business),
      imapUidvalidity: 777,
      imapFolder: "INBOX",
      isRead: business === "Café Lumen",
      assignedUserId: business === "Blake Legal" ? sam.id : amelia.id,
      outcome: outcome as never,
    });
    await db.insert(prospectEvents).values({
      prospectId: target.id,
      type: "replied",
      payload: { outcome },
      createdAt: ago(2),
    });
  }

  // One unassigned "unknown sender" for the inbox edge case.
  await db.insert(replies).values({
    workspaceId: workspace.id,
    prospectId: null,
    fromEmail: "j.reynolds@northstar-clinic.co.uk",
    toEmail: "hello@acmestudio.co",
    subject: "Saw your note to my colleague",
    bodyText: "Hi — my colleague forwarded your email. We're a 3-site clinic group and looking at booking systems. Who handles that?",
    snippet: "My colleague forwarded your email. We're a 3-site clinic group…",
    receivedAt: ago(0.2),
    isRead: false,
  });

  await db.insert(suppressions).values([
    { workspaceId: workspace.id, emailNormalized: "dave@ironbridgemotors.co.uk", reason: "HARD_BOUNCE", source: "Resend webhook", createdAt: ago(12) },
    { workspaceId: workspace.id, emailNormalized: "old@speysidemotors.co.uk", reason: "UNSUBSCRIBED", source: "unsubscribe link", createdAt: ago(30) },
    { workspaceId: workspace.id, emailNormalized: "info@kitestudio.co.uk", reason: "MANUAL", source: "manual", note: "Competitor", createdAt: ago(20) },
  ]);

  await db.insert(notifications).values([
    { workspaceId: workspace.id, userId: sam.id, kind: "reply", title: "Reply from Blake Legal", body: "Thanks Sam — timing is good…", href: "/inbox", createdAt: ago(1) },
    { workspaceId: workspace.id, userId: sam.id, kind: "run_failed", title: "Instagram run failed", body: "Monthly actor quota reached.", href: "/runs", createdAt: ago(12) },
    { workspaceId: workspace.id, userId: amelia.id, kind: "follow_up", title: "3 follow-ups are overdue", body: "Clear the oldest first.", href: "/prospects?followUp=overdue", createdAt: ago(0.5) },
  ]);

  await db.insert(auditLogs).values([
    { workspaceId: workspace.id, userId: sam.id, action: "workspace.create", targetType: "workspace", targetId: workspace.id, meta: { seeded: true }, createdAt: ago(60) },
    { workspaceId: workspace.id, userId: sam.id, action: "source.create", targetType: "source", targetId: sourceRows[0].id, meta: { name: sourceRows[0].name }, createdAt: ago(55) },
    { workspaceId: workspace.id, userId: amelia.id, action: "sequence.activate", targetType: "sequence", targetId: seqRows[0].id, meta: {}, createdAt: ago(20) },
  ]);

  // A couple of queued jobs so the health widget isn't empty.
  await db.insert(jobs).values([
    { workspaceId: workspace.id, type: "IMAP_SYNC", status: "PENDING", runAt: ahead(0.02), payload: {} },
    { workspaceId: workspace.id, type: "SCHEDULE_SOURCE", status: "PENDING", runAt: ahead(0.05), payload: {} },
  ]);

  const counts = await db.execute(sql`
    select
      (select count(*) from prospects)::int as prospects,
      (select count(*) from messages)::int as messages,
      (select count(*) from replies)::int as replies,
      (select count(*) from enrollments)::int as enrollments
  `) as unknown as { prospects: number; messages: number; replies: number; enrollments: number }[];

  console.log("seeded:", counts[0]);
  console.log("sign in as sam@acmestudio.co, amelia@acmestudio.co or noah@acmestudio.co");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
