# Outliaz OS interface

Primary reference: `/home/swiss/Desktop/outliaz-os-handoff/dist/index.html`.
Preserve its Paper/Bone/Ink/Hot identity and evidence-led workflows. This is an
everyday work tool, not a marketing page.

## Tokens

| Role      | Light   | Dark    |
| --------- | ------- | ------- |
| Canvas    | #F4F1EA | #11110F |
| Panel     | #FAF8F2 | #191916 |
| Raised    | #E9E5DC | #24231F |
| Text      | #0E0D0B | #F4F1EA |
| Secondary | #625D54 | #B7B1A6 |
| Rule      | #D0CBBF | #3B3933 |
| Brand     | #FF5028 | #FF5028 |

Tokens live in app/globals.css. Primary buttons invert ink/canvas. Orange belongs
on the wordmark and focus where contrast allows it. The warm palette is an
intentional user-specified exception to generic taste rules.

## Type and layout

IBM Plex Sans, locally bundled through @fontsource, weights 400–700. Body 14px,
secondary 12–13px, titles 28–32px, sentence case; tabular figures for counts.
Sidebar 210px, intermediate 180px, collapsed 76px. Gutters 38/24/18px.
Mobile breakpoint 760px. Panels radius 7px, controls 5px. No resting shadows,
glass, gradients or decorative icon tiles.

## Components and states

New shadcn Radix Button, Sheet and Tooltip sit beside existing custom primitives,
which are not replaced wholesale. Use semantic tokens and component variants.
Sheets need accessible titles, descriptions, focus trapping and focus return.
Plain Lucide outlines use 1.5px stroke/currentColor. Name icon-only controls;
ordinary labelled actions stay text-only. Never use Send to mean Save.
Preference storage holds appearance only and fails gracefully when blocked.

## Scope and known gaps

/ui-review mounts the real shell with explicitly synthetic empty workspace data,
without DB/auth imports. It is not an authentication bypass or completed import
workflow. Its navigation opens existing application routes. UI server runs on
3001 using .next-ui output; old production server on 3000 is untouched.
The sculpted logo SVG is absent: retain the typographic wordmark. Legacy page
content, command palette, full auth, import and draft persistence remain separate
work. Never expose the app publicly with current demo authentication.

## First visual review

Inspected all screenshots at 1440/768/390 in both themes. No horizontal overflow.
Quiet monochrome navigation and true zero counts support the next-action list.
Narrow layouts stack task actions and context; fixed mobile navigation has bottom
clearance. Next.js development indicator is not part of the product interface.
