# Handoff: AAK Arbitration Management System — admin docket, case register, case overview

## Overview

Frontend concept for the Architectural Association of Kenya (AAK) Arbitration Management System, designed for the **AAK Administrator** role. Three working screens plus honest placeholders for the rest of the information architecture:

1. **Docket** (home) — the day's obligations as a single ruled ledger, grouped by what is wrong with each case.
2. **All cases** — the same ledger, unfiltered, with state filters and pagination.
3. **Case overview** — a case file: titleblock of particulars, arbitrator block, case file list, and a procedural-history margin.

Placeholder screens (arbitrator directory, document register, hearing schedule, reports, users, settings, notifications, new-arbitration wizard) each carry a one-line spec of what belongs there. They are intentionally not designed yet.

## About the design files

The files in this bundle are **design references authored in HTML** — prototypes showing intended look, information hierarchy and behaviour. They are not production code to copy.

The task is to **recreate these designs in the target codebase** using its established patterns and libraries. The brief targets Next.js + React + TypeScript + Tailwind CSS + shadcn/ui + Lucide icons; if no app exists yet, that stack is the intended one.

Two structural notes about the prototype that do **not** carry over:

- Styling is written as inline styles because of the authoring environment. In the real app these become Tailwind utilities / design tokens.
- All data is hard-coded sample data. Every screen carries a visible `SAMPLE DATA — DESIGN CONCEPT, NOT LIVE CASE RECORDS` stamp; remove it once wired to real records.

## Fidelity

**High fidelity.** Colours, type sizes, spacing, rules and states are final and should be matched closely. Two deliberate exceptions:

- **The AAK logo is a placeholder** — a monospace `AAK` lettermark with the middle A in brand red. Replace it with the official AAK logo, unmodified. Do not recolour, distort or redraw it.
- **Brand red is `#A5121C`**, confirmed by the client in this conversation. Verify against the official AAK brand sheet before release.

## Design principles the implementation must preserve

The client rejected a first version for reading like a generic SaaS dashboard. The constraints below are the reason the design looks as it does — keep them when extending it.

- **No stat cards.** Numbers appear as a small typographic tally in the sheet header, never as four coloured cards.
- **No card soup.** One sheet per screen, subdivided by 1px rules. Cards are not used as decoration.
- **Ink on warm paper.** Warm stone app background, paper sheet, near-black ink. No pure white, no grey-on-grey.
- **Monospace is structural.** Case references, money, dates, labels, statuses and counts are all mono. Sans is for names, project titles and prose only.
- **Red is rationed.** Primary action, active nav marker, overdue status, section rule on the sheet. Nothing else.
- **Status is never colour alone.** Every status has a text label and a square marker.
- **Progressive detail.** Cases needing action get three lines and a margin note; cases running to programme get one line. The client explicitly asked for less information at once.
- **Left aligned, one grid.** No centred application content.
- **Restrained geometry.** Radius 0 throughout. Borders and tonal shifts carry hierarchy; there are no shadows anywhere in the design.

## Design tokens

### Colour

| Token | Hex | Use |
|---|---|---|
| `app-bg` | `#E8E3D9` | Application background (warm stone) |
| `sheet` | `#FBF8F1` | Paper — sheet surfaces, active tabs |
| `sheet-alt` | `#F9F5EC` | Procedural-history margin panel |
| `band` | `#F0EADE` | Group header bands |
| `band-alt` | `#F4EFE5` | Tab and filter strips |
| `row-hover` | `#F7F2E8` | Row hover |
| `ink` | `#17150E` | Primary text, sheet border, hard rules |
| `ink-2` | `#3C382F` | Secondary text (parties, notes) |
| `ink-3` | `#5A544A` | Tertiary text, inactive tab labels |
| `muted` | `#6B6455` | Mono labels, metadata |
| `muted-2` | `#8A8373` | Weakest metadata, concluded status |
| `hairline` | `#E2DBCD` | Row separators |
| `rule` | `#CFC8BA` | Section rules, margin rule, input underline |
| `timeline-dot` | `#B3AB99` | Past timeline events |
| `red` (brand) | `#A5121C` | Primary action, active nav bar, overdue, active tab underline |
| `red-hover` | `#7C0D14` | Primary button hover, link hover |
| `green` | `#2F6B4F` | No conflicts, scheduled future event |
| `amber` | `#8A5A12` | Awaiting appointment (darkened for contrast on paper) |
| `nav-bg` | `#1C1A15` | Sidebar |
| `nav-bg-active` | `#26231C` | Active sidebar item |
| `nav-border` | `#302C24` | Sidebar dividers |
| `nav-text` | `#C6BFB1` | Sidebar labels |
| `nav-text-active` | `#F5F1E8` | Active sidebar label, user name |
| `nav-muted` | `#857E71` | Sidebar sublabels |
| `nav-count` | `#7A7466` | Sidebar counts (active: `#A79F90`) |

### Typography

Two families only, both self-hostable and open source:

- **IBM Plex Sans** — 400, 500, 600. Names, titles, prose, buttons, tab labels.
- **IBM Plex Mono** — 400, 500, 600. References, money, dates, all-caps labels, counts, statuses.

`font-variant-numeric: tabular-nums` is set on `body` so figures align in columns. Keep it.

| Role | Family | Size | Weight | Tracking |
|---|---|---|---|---|
| Sheet title (`Docket`, `All cases`) | Sans | 27px | 600 | -0.025em |
| Case title (parties) | Sans | 26px | 600 | -0.025em |
| Case title `v.` connector | Sans | 17px | 400 | — |
| Stub screen heading | Sans | 20px | 600 | -0.02em |
| Arbitrator name | Sans | 16px | 600 | — |
| Row project title | Sans | 15px | 600 | -0.01em |
| Titleblock value | Sans **or** Mono (per field) | 14px | 500 | — |
| Body / parties / document name | Sans | 13–13.5px | 400–500 | — |
| Controls, tabs, filters | Sans | 12.5px | 400 / 600 active | — |
| Metadata prose | Sans | 11.5–12px | 400 | — |
| Tally figure | Mono | 19px | 500 | — |
| Case ref (row) | Mono | 12px | 400 | 0.04em |
| Case ref (case header) | Mono | 11.5px | 400 | 0.12em |
| Deadline / status line | Mono | 10.5–11px | 400 | 0.04–0.08em |
| Section + field labels | Mono | 9.5px | 400 | 0.11–0.12em |
| Group header label | Mono | 10.5px | 600 | 0.13em |
| Row index | Mono | 10px | 400 | — |
| Sample-data stamp | Mono | 9.5px | 400 | 0.11em |

Mono labels are uppercase. Uppercase is used **only** for mono labels, statuses and stamps — never for headings, navigation or body text.

### Spacing, geometry

- Spacing scale in use: 3, 4, 5, 6, 8, 9, 10, 12, 14, 15, 16, 18, 20, 22, 24, 26px. Page gutter 26px; sheet padding 22–24px; row padding 14–15px vertical.
- **Border radius: 0 everywhere.** No pills. Status markers are 7×7px squares, not dots.
- **Shadows: none.**
- Rule weights: `1px solid ink` for the sheet border and the two hard horizontal rules (below sheet header, below case header); `1px solid rule` for section divisions; `1px solid hairline` for row separators.
- Sidebar width 226px (`minmax(0, 226px)`), collapsing rather than overflowing at narrow widths.
- Active states use `box-shadow: inset 0 -2px 0 red` as a bottom marker on tabs/filters, and a 2px full-height red bar on the left edge of the active sidebar item.
- Control heights: `min-height` + padding, never fixed height. All buttons and tabs are `white-space: nowrap` so control rows wrap between controls, not inside a label.

## Screens

### Shell (all screens)

Two-column grid: sidebar `minmax(0, 226px)` + main `minmax(0, 1fr)`.

**Sidebar** — `nav-bg`, sticky, full viewport height, flex column.
- Brand block: padding 20/18/16, bottom border `nav-border`. Mono 15px/600, tracking 0.16em `AAK` with the middle `A` in brand red; below it mono 9.5px, tracking 0.14em, `nav-muted`: `ARBITRATION REGISTER`.
- Primary group: Docket, Cases (24), Arbitrators (8), Documents (91), Hearings (6), Reports. Each item: flex row, gap 12px, `min-height` 34px, padding `8px 18px 8px 0`, sans 13.5px; a 2px full-height left bar (red when active, transparent otherwise); label; right-aligned mono 10.5px count. Active item also takes `nav-bg-active` and `nav-text-active`. `aria-current="page"` on the active link.
- Secondary group above a `nav-border` top rule: Users, Settings.
- Footer, pushed down with `margin-top: auto`, top border: sans 12.5px name `Grace Wanjiru`; mono 9.5px tracking 0.1em `ADMINISTRATOR · NAIROBI`.
- **Navigation is role-aware.** This is the administrator's set. Arbitrator: Home, My Cases, Documents, Hearings, Profile. Party: Home, My Case, Documents, Hearings, Profile. Do not render items a role cannot access.

**Top bar** — paper, sticky, `min-height` 54px, padding `0 26px`, bottom border `1px solid ink`, wraps at narrow widths.
- Left: mono 10px tracking 0.13em breadcrumb — `AAK / DOCKET`, `DOCKET / ALL CASES`, `DOCKET / ARB-2026-014`, `AAK / <SCREEN>`.
- Right: search (250px, `max-width: 40vw`, underline only — mono `FIND` label plus borderless input, placeholder `Case number, party or project`); `Notifications` text button with mono red `4`; primary red `Start new arbitration`.

**Content padding:** `22px 26px 60px`. The sample-data stamp sits 14px below the sheet.

### 1. Docket (home)

One sheet, `1px solid ink` border.

**Sheet header** — padding `22px 24px 18px`, bottom border `1px solid ink`, wrapping flex, items bottom-aligned.
- Left: `Docket` (27px/600); below it mono 10.5px tracking 0.1em — `SATURDAY 12 SEPTEMBER 2026 · GRACE WANJIRU · AAK ADMINISTRATOR`.
- Right: three tallies, gap 22px, each a mono 19px/500 figure over a mono 9.5px label: `2 OVERDUE` (red), `1 TO APPOINT` (amber), `24 ACTIVE` (ink). **Three only** — the client cut this from five.

**Groups.** Cases are grouped by what is required, not by workflow stage. Group header: padding `9px 24px`, `band` background, bottom `rule`; 7×7 square in the group tone, mono 10.5px/600 tracking 0.13em label, mono count zero-padded, then a sans 12px note.

| Group | Tone | Note | Row shape |
|---|---|---|---|
| `OVERDUE` | red | Past the agreed date. Act today. | full |
| `AWAITING APPOINTMENT` | amber | No arbitrator on record. | full |
| `IN PROGRESS` | `#3C382F` | Nothing required from AAK today. | dense |
| `CONCLUDED` | `muted-2` | Retained for the register. | dense (All cases only) |

**Full row** (action needed) — clickable, wrapping flex, bottom `hairline`, hover `row-hover`:
- index column, `flex: 0 0 24px`, padding `15px 0 15px 24px`, mono 10px `#A89F8E`, zero-padded;
- body, `flex: 3 1 330px`, padding `14px 20px 14px 12px`: mono 12px case ref + sans 15px/600 project title on one baseline row; sans 13px parties with a `muted-2` `v.`; mono 10.5px line — `DISPUTE KES 37,500,000 · UPPER HILL, NAIROBI`;
- **standing margin**, `flex: 1 1 232px`, `border-left: 1px solid hairline`, padding `14px 24px 14px 18px`: mono 11px deadline in the status tone (`DUE 18 SEP · 12 DAYS OVERDUE`), sans 12.5px reason (`Evidence review not closed. Arbitrator last responded 03 August.`), mono 10px arbitrator name in caps.

The margin border-left repeats on every row, so it reads as one continuous vertical rule down the sheet. This is the defining feature of the layout — preserve it.

**Dense row** (no action needed) — single baseline row, padding `10px 24px`: mono 11.5px ref (`flex: 0 0 106px`), sans 13.5px/500 project (`flex: 2 1 220px`), mono 10.5px next date in status tone (`flex: 1 1 176px`).

**Footer** — padding `12px 24px`: mono 10.5px stamp (`TWO MATTERS NEED ACTION TODAY · FULL REGISTER UNDER CASES`); right, `Previous` (disabled, `#A89F8E`, `cursor: not-allowed`) and `Next` (underlined, hover red). Text buttons, not boxed.

Docket hides concluded cases. All cases shows every group.

### 2. All cases

Same sheet and rows. Differences: title `All cases`; stamp `24 ARBITRATIONS ON THE REGISTER · UPDATED 12 SEP 2026, 08:40`; footer `SHOWING 1–8 OF 24`; and a filter strip below the header — `band-alt` background, bottom `rule`, buttons padding `9px 16px`, sans 12.5px with a mono count, active button takes paper background, 600 weight and the inset red underline. Filters: All 24, Overdue 2, Awaiting appointment 1, In progress 12, Concluded 9.

Pagination is explicit. **No infinite scroll** for administrative data.

### 3. Case overview — ARB-2026-014

**Case header** — padding `22px 24px 18px`, bottom `1px solid ink`, wrapping flex, `space-between`.
- Left: mono 11.5px tracking 0.12em `ARB-2026-014 · FILED 04 JUNE 2026`; parties as a two-line 26px/600 title with a 17px `muted` `v.`; status line in mono 11px red with a 7×7 red square — `EVIDENCE REVIEW OVERDUE 12 DAYS · DAY 92 OF 120`.
- Right: `Upload document` and `Schedule hearing` (transparent, `1px solid ink`, hover `band`), then `Record outcome` (red). All `min-height: 31px`, nowrap.

**Tabs** — `band-alt` strip, bottom `rule`: Overview, Parties, Project, Arbitrator, Documents, Hearings, Activity. Active: paper background, 600, inset red underline. Only Overview is designed; the rest are the intended structure.

**Body** — wrapping flex: main column `flex: 3 1 420px`, margin `flex: 1 1 258px`. The margin drops below the main column at narrow widths.

**Titleblock** (main column, bottom `rule`) — wrapping cells, `flex: 1 1 172px`, padding `13px 18px`, right and bottom `hairline` with `margin-bottom: -1px` so the last row's border collapses onto the section rule. Each cell: mono 9.5px label, 14px/500 value (mono for references and money, sans for names), 11.5px `muted` note.

| Label | Value | Note |
|---|---|---|
| PROJECT | Nairobi Commercial Development | Mixed-use, 14 storeys, Upper Hill |
| PROJECT VALUE | KES 480,000,000 | Contract sum at award |
| DISPUTE VALUE | KES 37,500,000 | Variations and delay |
| CLAIMANT | ABC Construction Ltd | Otieno Advocates |
| RESPONDENT | XYZ Consultants | Mutiso & Co. |
| ARBITRATION CLAUSE | Clause 34.2 | JBC Agreement, 2019 edition |
| APPOINTED | 12 June 2026 | By AAK on party request |
| NEXT DATE | 18 September 2026 *(red)* | Evidence review, 12 days overdue |

**Arbitrator block** — padding `15px 20px 14px`, bottom `rule`. Mono `ARBITRATOR` label; then 16px/600 `Jane Doe`, a mono 10.5px green conflict line `■ NO DECLARED CONFLICTS · VERIFIED 10 JUN 2026`, and a right-aligned underlined `Open profile` text button. Below, four mono stats: `1 ACTIVE CASES`, `94% ON TIME`, `78d AVERAGE DURATION`, `8 SIMILAR MATTERS`.

Conflict status sits in the arbitrator block on the case page and must also appear before any assignment is confirmed. It is never hidden inside a profile.

**Case file** — padding `15px 20px 6px`. Mono `CASE FILE` + `11 DOCUMENTS`. Each row: `border-top: 1px solid hairline`, padding `11px 0`, wrapping baseline flex — 13.5px/500 name (`flex: 1 1 250px`), mono 10px category (`flex: 0 0 104px`), mono 10px access label (`flex: 0 0 132px`, red when restricted), then a full-width mono-free 12px meta line (uploader · date · format · size · version).

Sample rows: Statement of claim / SUBMISSION / PARTY-VISIBLE; Response to claim / RESPONSE / PARTY-VISIBLE; Bill of quantities, revision 3 / EVIDENCE / PARTY-VISIBLE; Arbitrator working notes / CORRESPONDENCE / **ARBITRATOR-ONLY** (red).

Access labels are part of the design, not decoration: `PARTY-VISIBLE`, `ARBITRATOR-ONLY`, `INTERNAL`, `ADMINISTRATOR-ONLY`. Every document surface must state who can see the file.

**Procedural history** (margin) — `sheet-alt` panel, `border-left: 1px solid rule`. Header mono `PROCEDURAL HISTORY`. Each event: mono 10px date (`flex: 0 0 62px`), a 7px square with a 1px connector line below it (`min-height` 22px), then 13px/500 title and 11.5px `muted` detail. Past events use `timeline-dot`; the overdue event is red in both square and title; the scheduled future hearing is green.

Events: 12 JUN appointed · 18 JUN claimant documents · 25 JUN respondent response · 14 JUL first hearing · 03 AUG additional evidence · 06 SEP became overdue *(red)* · 21 SEP next hearing *(green)*.

### 4. Placeholder screens

Paper sheet, `1px solid ink`, padding `34px 24px`, `max-width: 640px`: mono `NOT IN THIS PASS`, 20px/600 title, 13.5px/1.6 description of the intended content, then an underlined `Back to the docket` button. Specs carried in the prototype:

- **Arbitrator directory** — caseload, overdue assignments, availability, conflict status, opening into a profile with assignment history.
- **Document register** — the file across all arbitrations: filename, category, version, uploader, date, authorisation.
- **Hearing schedule** — agenda by date: case, parties, venue or link, papers required beforehand.
- **Reports** — case volume, average duration, overdue arbitrations, arbitrator workload.
- **Users and permissions** — staff, arbitrators and party accounts with role access.
- **Settings** — account, security, notifications, permissions, system configuration.
- **Notifications** — operational alerts only: action required, deadline approaching, hearing scheduled, document awaiting review, conflict to resolve.
- **Start new arbitration** — seven steps (parties, project, dispute, contract, documents, review, submit) with drafts saved between steps.

## Interactions and behaviour

- Sidebar links and the `Cases` link navigate; `Cases` stays marked active while a case is open. Each nav click resets scroll to top.
- Any docket or case row opens the case overview. Rows are `cursor: pointer` with a paper-warm hover. In the real app they must be keyboard-reachable — render as links or add `role="link"` with Enter/Space handling; a nested focusable ref link is the cleanest route.
- Filter buttons and case tabs set local state only. Filters are presentational in the prototype; wire them to the query.
- `Previous` is disabled on page 1 and must convey that with more than colour (it is also `cursor: not-allowed`; add `aria-disabled`).
- Hover is limited to background tint on rows, border/underline change on buttons, text colour on links. Nothing moves, scales or glows.
- Focus: `:focus-visible` gives a 2px brand-red outline at 2px offset across the app. Keep it.
- `prefers-reduced-motion: reduce` disables transitions globally.
- There are no modals in the design. Upload, scheduling and outcome recording should be drawers or dedicated pages, not stacked dialogs. Confirmation is reserved for destructive or legally significant actions.
- Responsive: no media queries — the layout uses wrapping flex with sensible flex bases, so the margin column drops below the main column, the titleblock reflows, and control rows wrap between controls. In a real build, define the **mobile information architecture separately** (case summaries, notifications, documents, hearing details, quick actions) rather than shrinking these tables.

## State

Prototype state is three values: `view` (`docket` | `cases` | `case` | one of the placeholder keys), `tab` (case tab), `filter` (case list filter). In the real app these become routes:

- `/` → docket
- `/cases` (with `?status=` for the filter, `?page=`)
- `/cases/:caseNumber` (with the tab as a nested route or `?tab=`)
- `/arbitrators`, `/documents`, `/hearings`, `/reports`, `/users`, `/settings`, `/notifications`, `/cases/new/:step`

Data needed: case list with group/status derivation, per-case deadline and reason-for-attention strings, arbitrator summary with conflict status and performance figures, document list with category and access level, and a procedural-event log. Group membership, overdue day counts and the tally figures should all be derived from case data, not stored as display strings.

Audit: every consequential action (case created, arbitrator assigned, document uploaded, hearing scheduled, status changed, award recorded) must be written to the procedural history and surfaced in the Activity tab.

## Assets

- **AAK logo** — not included. The prototype uses a typographic placeholder. Obtain the official file and use it unmodified.
- **Fonts** — IBM Plex Sans and IBM Plex Mono, loaded from Google Fonts in the prototype. Self-host in production (both are OFL licensed).
- **Icons** — none used. The design deliberately relies on text and 7×7 squares rather than iconography. If icons are added, use Lucide only, always with labels, and do not add one per nav item.
- **No imagery.** Any photography added later should be real AAK or project material, never stock.

## Files

- `AAK Arbitration v2.dc.html` — the current design. This is the one to implement.
- `reference_v1_dashboard.dc.html` — the rejected first version, included only as a record of what the client did not want (sidebar dashboard with a metrics strip and a conventional case table). Do not implement it.
