# Prospect Taxonomy — canonical enums and seeds

Source of truth for `lib/taxonomy/enums.ts`, Drizzle enums, and the seed migration.
Human labels are UI strings; slugs are stored values.

---

## 1. Industry (17, fixed set)

| slug | label | typical business types |
|---|---|---|
| `PROFESSIONAL_SERVICES` | Professional Services | Law firm, Accountant, Consultant, Recruitment firm |
| `HEALTHCARE` | Healthcare | Dentist, Clinic, Physiotherapist, Optician, Private practice |
| `HOME_SERVICES` | Home Services | Plumber, Electrician, Cleaner, Landscaper, Pest control |
| `CONSTRUCTION_TRADES` | Construction & Trades | Builder, Contractor, Roofer, Renovation company |
| `PROPERTY_REAL_ESTATE` | Property & Real Estate | Estate agent, Property manager, Developer |
| `HOSPITALITY_FOOD` | Hospitality & Food | Restaurant, Café, Hotel, Caterer |
| `BEAUTY_WELLNESS` | Beauty & Wellness | Salon, Barber, Spa, Gym, Wellness centre |
| `RETAIL_ECOMMERCE` | Retail & E-commerce | Retail store, Boutique, Online shop |
| `AUTOMOTIVE` | Automotive | Garage, Dealership, Detailing, Car rental |
| `EDUCATION_TRAINING` | Education & Training | School, Tutor, Academy, Training company |
| `TECHNOLOGY` | Technology | SaaS company, IT services, Software company |
| `FINANCE_INSURANCE` | Finance & Insurance | Financial adviser, Broker, Insurer |
| `CREATIVE_MEDIA` | Creative & Media | Design studio, Agency, Photographer, Production company |
| `TRAVEL_TOURISM` | Travel & Tourism | Tour operator, Travel agency, Accommodation provider |
| `AGRICULTURE` | Agriculture | Farm, Agricultural service, Supplier, Processor |
| `MANUFACTURING` | Manufacturing | Manufacturer, Fabricator, Industrial supplier |
| `OTHER` | Other | Outside the primary classifications |

Industries are **not user-creatable**. Rename-only by OWNER/ADMIN.

## 2. Business Type (user-extensible, belongs to exactly one industry)

Seeded types (`business_types` table: id, industry, label, slug, is_system, archived_at):

| industry | seeded labels |
|---|---|
| Professional Services | Law Firm, Accounting Firm, Consultancy, Recruitment Agency |
| Healthcare | Dentist, Physiotherapy Clinic, Medical Clinic, Optician, Private Practice |
| Home Services | Plumbing Company, Electrical Contractor, Cleaning Company, Landscaper, Pest Control |
| Construction & Trades | Building Contractor, Roofer, Renovation Company, Groundworks |
| Property & Real Estate | Estate Agency, Property Manager, Property Developer |
| Hospitality & Food | Restaurant, Café, Hotel, Catering Company |
| Beauty & Wellness | Hair Salon, Barber Shop, Spa, Gym, Wellness Centre |
| Retail & E-commerce | Retail Store, Boutique, Online Shop |
| Automotive | Auto Repair Shop, Car Dealership, Detailing Studio, Car Rental |
| Education & Training | Training Company, Tutoring Service, Academy, School |
| Technology | SaaS Company, IT Services, Software Company |
| Finance & Insurance | Financial Adviser, Insurance Broker, Insurance Company |
| Creative & Media | Marketing Agency, Design Studio, Photography Studio, Production Company |
| Travel & Tourism | Tour Operator, Travel Agency, Accommodation Provider |
| Agriculture | Farm, Agricultural Services, Agricultural Supplier, Food Processor |
| Manufacturing | Manufacturer, Fabricator, Industrial Supplier |
| Other | Other |

Rule: a business type's industry is immutable after creation; reassigning requires creating a new type. New types never create new industries.

## 3. Company Size

| slug | label | employees |
|---|---|---|
| `SOLO` | Solo | 1 |
| `MICRO` | Micro | 2–5 |
| `SMALL` | Small | 6–20 |
| `SMALL_MEDIUM` | Small–Medium | 21–50 |
| `MEDIUM` | Medium | 51–200 |
| `LARGE` | Large | 201+ |
| `UNKNOWN` | Unknown | — |

Derivation from a numeric count: 1→SOLO, 2–5→MICRO, 6–20→SMALL, 21–50→SMALL_MEDIUM, 51–200→MEDIUM, ≥201→LARGE.
Derivation from a range string (`"11-50"`): use the upper bound. Never overwrite a size set manually.

## 4. Geography (free fields + normalized country)

`city`, `region`, `country_code` (ISO-3166-1 alpha-2, nullable), `market` (free text, e.g. `UK`, `DACH`, `Benelux`).
Filter path example: `market=UK → city=Manchester → industry=HEALTHCARE → business_type=Dentist`.

## 5. Opportunity (14)

`NO_WEBSITE`, `OUTDATED_WEBSITE`, `POOR_MOBILE_EXPERIENCE`, `POOR_USER_EXPERIENCE`, `WEAK_BRANDING`, `WEAK_CONVERSION`, `NO_LEAD_CAPTURE`, `NO_ONLINE_BOOKING`, `ECOMMERCE_OPPORTUNITY`, `NEEDS_AUTOMATION`, `NEEDS_WEB_APPLICATION`, `WEBSITE_PERFORMANCE`, `SEO_DISCOVERABILITY`, `UNKNOWN`.

Multi-select. `UNKNOWN` is mutually exclusive with all others and only permitted while `stage = NEW`.

## 6. Potential Service (15)

`WEBSITE_DESIGN`, `WEBSITE_REDESIGN`, `WEBSITE_DEVELOPMENT`, `LANDING_PAGE`, `ECOMMERCE`, `BRAND_IDENTITY`, `BRAND_REFRESH`, `UI_UX_DESIGN`, `WEB_APPLICATION`, `BOOKING_SYSTEM`, `LEAD_GENERATION_SYSTEM`, `BUSINESS_AUTOMATION`, `WEBSITE_OPTIMISATION`, `ONGOING_SUPPORT`, `OTHER`.

Multi-select. Suggestion map (button "Suggest services"):

| opportunity | suggests |
|---|---|
| NO_WEBSITE | WEBSITE_DESIGN |
| OUTDATED_WEBSITE | WEBSITE_REDESIGN |
| POOR_MOBILE_EXPERIENCE | WEBSITE_REDESIGN, WEBSITE_OPTIMISATION |
| POOR_USER_EXPERIENCE | UI_UX_DESIGN |
| WEAK_BRANDING | BRAND_IDENTITY, BRAND_REFRESH |
| WEAK_CONVERSION | LANDING_PAGE, WEBSITE_OPTIMISATION |
| NO_LEAD_CAPTURE | LEAD_GENERATION_SYSTEM |
| NO_ONLINE_BOOKING | BOOKING_SYSTEM |
| ECOMMERCE_OPPORTUNITY | ECOMMERCE |
| NEEDS_AUTOMATION | BUSINESS_AUTOMATION |
| NEEDS_WEB_APPLICATION | WEB_APPLICATION |
| WEBSITE_PERFORMANCE | WEBSITE_OPTIMISATION |
| SEO_DISCOVERABILITY | WEBSITE_OPTIMISATION |
| UNKNOWN | — |

## 7. Fit

`STRONG` (clear problem, suitable business, realistic service), `GOOD` (suitable, probable opportunity), `POSSIBLE` (needs research), `POOR` (unlikely to need/afford), `UNKNOWN` (not researched).

## 8. Priority

`HIGH`, `MEDIUM`, `LOW`, `DISQUALIFIED` (do not pursue).
Invariant: `priority = DISQUALIFIED` ⇒ `stage = DISQUALIFIED` and all queued sends cancelled.

## 9. Contact Role

`OWNER`, `FOUNDER`, `MANAGING_DIRECTOR`, `CEO`, `MARKETING_DIRECTOR`, `MARKETING_MANAGER`, `OPERATIONS_DIRECTOR`, `OPERATIONS_MANAGER`, `GENERAL_MANAGER`, `OTHER_DECISION_MAKER`.

## 10. Contact Quality

`VERIFIED`, `UNVERIFIED`, `RISKY`, `BOUNCED`, `UNKNOWN`.

## 11. Pipeline Stage (11)

| slug | label | meaning |
|---|---|---|
| `NEW` | New | added, not researched |
| `RESEARCHED` | Researched | basic research done |
| `QUALIFIED` | Qualified | confirmed worth pursuing |
| `CONTACTED` | Contacted | initial outreach sent |
| `FOLLOW_UP` | Follow-up | follow-up owed or underway |
| `REPLIED` | Replied | prospect responded |
| `MEETING` | Meeting | call/meeting arranged |
| `PROPOSAL` | Proposal | proposal or quote sent |
| `WON` | Won | became a client |
| `LOST` | Lost | opportunity closed |
| `DISQUALIFIED` | Disqualified | not suitable |

## 12. Contactability (separate axis, system-managed)

`OK`, `BOUNCED`, `UNSUBSCRIBED`, `DO_NOT_CONTACT`.
Independent of stage: a prospect can be `FOLLOW_UP` + `BOUNCED` (sending blocked, stage unchanged).

---

## 13. Gates

**Research gate (NEW → RESEARCHED enabled when all true):** industry set · business_type set · company_size ≠ UNKNOWN · ≥1 opportunity that is not UNKNOWN · fit ≠ UNKNOWN · country_code set · contact_name set · role set.

**Qualification gate (RESEARCHED → QUALIFIED):** research gate + fit ∈ {STRONG, GOOD} + ≥1 potential service + priority ∈ {HIGH, MEDIUM} + contact email present + contact_quality ≠ BOUNCED + contactability = OK + not suppressed.

**Enrollment gate:** stage ∈ {QUALIFIED, CONTACTED, FOLLOW_UP} + priority ≠ {LOW, DISQUALIFIED} + fit ∉ {POOR, UNKNOWN} + email present + contactability OK + not suppressed + no active enrollment.

**UI:** the prospect drawer shows a live checklist of the active gate with pass/fail ticks and disables "Mark researched" / "Qualify" until every requirement passes. Only the **qualification** gate is overridable (ADMIN+, reason ≥10 chars, audit-logged, stored in `gate_override_reason`); the research gate is data completeness and cannot be overridden.

**Sending ramp (MVP):** the effective per-user daily send cap is `min(workspace daily_send_cap, 5 × days since the sending domain was verified)` — full volume from day 10. Enforced at send time alongside the hourly workspace cap.

## 14. Status transition matrix

| From | Allowed manual next | System-driven |
|---|---|---|
| NEW | RESEARCHED, DISQUALIFIED | — |
| RESEARCHED | QUALIFIED, NEW, DISQUALIFIED, LOST | — |
| QUALIFIED | CONTACTED, NEW, RESEARCHED, MEETING, DISQUALIFIED, LOST | first send → CONTACTED |
| CONTACTED | FOLLOW_UP, REPLIED, MEETING, PROPOSAL, LOST, DISQUALIFIED | step ≥2 sent → FOLLOW_UP · reply → REPLIED |
| FOLLOW_UP | REPLIED, MEETING, PROPOSAL, LOST, DISQUALIFIED | reply → REPLIED |
| REPLIED | CONTACTED, MEETING, PROPOSAL, LOST, DISQUALIFIED | — |
| MEETING | PROPOSAL, WON, LOST, DISQUALIFIED | — |
| PROPOSAL | WON, LOST, DISQUALIFIED | — |
| WON | (terminal) | — |
| LOST | (terminal, reopen → RESEARCHED) | — |
| DISQUALIFIED | (terminal, reopen → NEW) | — |

`LOST` and `DISQUALIFIED` require `closed_reason` (≥3 chars, free text). All transitions are audit-logged with from/to/actor/reason.

`REPLIED → CONTACTED` is the manual re-engagement path (e.g., the prospect went quiet after replying); it re-opens eligibility for enrollment.
