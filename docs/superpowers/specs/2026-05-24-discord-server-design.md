# Discord Server Design — Alliance Server for Game of Thrones: Conquest

**Date:** 2026-05-24
**Scope:** Single alliance server, up to 156 members, full hub covering event coordination, communication, strategy, and social.

---

## Goals

- Provide clear separation of concerns between event coordination, knowledge base, general chat, and social content
- Enforce the alliance's four-tier hierarchy through Discord roles and channel permissions
- Automate as much of the onboarding flow as possible, with one manual officer step for account verification
- Give members self-serve control over cosmetic (color) roles
- Keep the channel count manageable (~22 channels) — avoid per-troop-type channel sprawl

---

## Roles

Roles map to in-game tiers. Names below are illustrative — the alliance can choose thematic alternatives that fit their identity.

| Suggested Name | Tier | Purpose |
|---|---|---|
| Hand of the King | T1 | Full server admin; manages roles, channels, settings |
| Small Council | T2 + select T3s | Access to council-gated channels; granted independently of tier roles |
| Landed Knight | T3 elevated | Trusted members; can post/maintain Citadel reference channels |
| Knight | T4 post-onboarding | Full member access |
| Squire | T4 pre-onboarding | Limited access until onboarding complete |

**Council note:** A T3 member on the council holds both the Landed Knight and Small Council roles. The Small Council role is what gates council channels — tier roles alone do not grant that access.

**Color roles:** A separate set of decorative roles with no permissions. Members self-assign via a role-picker channel (Discord's built-in role selection or Carl-bot). These are independent of all tier roles.

---

## Onboarding Flow

1. Member joins the server → `Squire` role assigned automatically
2. `Squire` access is limited to the Welcome category only
3. Discord's native onboarding steps run automatically: rules acknowledgment, channel preferences, introductions post
4. Member posts an in-game account screenshot in the verification channel
5. An officer reviews the screenshot and manually promotes the member to `Knight`
6. `Knight` unlocks full member access across all non-council categories

Steps 1–3 are fully automated. Step 5 is the only manual officer action required.

---

## Channel Structure

Names below are suggestions. Purpose, permissions, and behavior are the binding requirements.

### Welcome
*Visible to everyone including Squires.*

| Channel (suggested name) | Access | Notes |
|---|---|---|
| Rules & Info (e.g. `ravens-gate`) | Read-only for all | Server rules, onboarding instructions |
| Announcements | Council+ post; all read | Official alliance announcements |
| Introductions | All can post | New member introductions |
| Account Verification | Squires post; officers review | Members post in-game screenshot to verify identity; officer promotes to Knight on approval |
| Color Roles | Self-serve | A dedicated channel with Discord's built-in role-picker component (or Carl-bot reaction roles). Members choose cosmetic color roles; no permissions attached. |

### The Small Council
*Locked to Small Council and Hand of the King only.*

| Channel (suggested name) | Notes |
|---|---|
| Council Chat (e.g. `council-chamber`) | Main council discussion |
| Council Notes (e.g. `ravens-scroll`) | Pinned decisions, directives, running record — kept separate from chat so important decisions don't get buried |
| Council Voice | Private VC for council members |

### The War Room
*All Knights and above. Primary hub for live event coordination. Channels ordered by urgency — most time-critical first.*

| Channel (suggested name) | Notes |
|---|---|
| Bubble Reminder | Council+ posts alerts; all read. Manual or bot-driven reminders. First in category — highest urgency |
| Battlegrounds | BG coordination, timing callouts, team assignments |
| Seat of Power | SoP weekend coordination on PvP weekends |
| March Callouts | Rally and reinforce requests |
| Battle Reports | Members post screenshots of battle results. Last — informational, not time-critical |
| War Room Voice | General coordination VC |
| Battlegrounds Voice | Dedicated BG VC |

### The Citadel
*Reference library. Q&A is interactive — all Knights can post questions. All other channels are maintained by Landed Knights and above; Knights have read-only access.*

Use Discord's **Forum channel** type for Q&A, Hero Builds, and Gear Sets. Each question or build becomes its own titled thread — searchable, organized, and doesn't get buried in scroll. Text channels are sufficient for Guides and Keep Development.

| Channel (suggested name) | Type | Notes |
|---|---|---|
| Q&A | Forum | All members post questions; Landed Knights and above answer. Each question is its own thread |
| Hero Builds | Forum | One thread per build, tagged by troop type (siege, cavalry, ranged, infantry). Landed Knight+ maintains |
| Gear Sets | Forum | One thread per gear set, tagged by use case (combat, SoP, march, utility). Landed Knight+ maintains |
| Guides | Text | Merged tips, tricks, and research goals. Pinned posts organized by topic. Landed Knight+ maintains |
| Keep Development | Text | Building guides, links to Laughing Cr0w companion tools (prestige ledger, keep upgrade calculator, Gendry's Forge). Landed Knight+ maintains |

### Alliance Hall
*General member space. All Knights and above.*

| Channel (suggested name) | Notes |
|---|---|
| Alliance Chat | Main general chat |
| Polls | Council+ posts polls; all vote |
| Gift Exchange | Coordinate in-game gift sending |
| Alt Registration | Members register alt accounts for officer tracking |
| General Voice (lobby-style) | Casual hangout VC |

### Off Duty
*Social channels. All Knights and above.*

| Channel (suggested name) | Notes |
|---|---|
| The Tavern | Off-topic general chat |
| Achievements | Share non-GotC wins, life milestones, etc. |
| Other Games | Coordinate other games with alliance members |

---

## Per-Channel Permission Matrix

Legend: **R** = read-only · **R/W** = read + post · **R/W/M** = read + post + manage messages · **—** = hidden · **Admin** = full control via Administrator permission

| Channel | Squire | Knight | Landed Knight | Small Council | Hand of the King |
|---|---|---|---|---|---|
| **Welcome** | | | | | |
| Rules & Info | R | R | R | R/W | Admin |
| Announcements | R | R | R | R/W | Admin |
| Introductions | R/W | R/W | R/W | R/W | Admin |
| Account Verification | R/W | R | R | R/W/M | Admin |
| Color Roles (role picker) | Self-assign | Self-assign | Self-assign | Self-assign | Admin |
| **The Small Council** | | | | | |
| Council Chat | — | — | — | R/W | Admin |
| Council Notes | — | — | — | R/W/M | Admin |
| Council Voice | — | — | — | Join/Speak | Admin |
| **The War Room** | | | | | |
| Bubble Reminder | — | R | R | R/W | Admin |
| Battlegrounds | — | R/W | R/W | R/W | Admin |
| Seat of Power | — | R/W | R/W | R/W | Admin |
| March Callouts | — | R/W | R/W | R/W | Admin |
| Battle Reports | — | R/W | R/W | R/W | Admin |
| War Room Voice | — | Join/Speak | Join/Speak | Join/Speak | Admin |
| Battlegrounds Voice | — | Join/Speak | Join/Speak | Join/Speak | Admin |
| **The Citadel** | | | | | |
| Q&A (Forum) | — | R/W | R/W/M | R/W/M | Admin |
| Hero Builds (Forum) | — | R | R/W/M | R/W/M | Admin |
| Gear Sets (Forum) | — | R | R/W/M | R/W/M | Admin |
| Guides | — | R | R/W/M | R/W/M | Admin |
| Keep Development | — | R | R/W/M | R/W/M | Admin |
| **Alliance Hall** | | | | | |
| Alliance Chat | — | R/W | R/W | R/W | Admin |
| Polls | — | R | R | R/W | Admin |
| Gift Exchange | — | R/W | R/W | R/W | Admin |
| Alt Registration | — | R/W | R/W | R/W | Admin |
| General Voice (lobby) | — | Join/Speak | Join/Speak | Join/Speak | Admin |
| **Off Duty** | | | | | |
| The Tavern | — | R/W | R/W | R/W | Admin |
| Achievements | — | R/W | R/W | R/W | Admin |
| Other Games | — | R/W | R/W | R/W | Admin |

---

## Migration Path

For members of an existing server being ported to this new server.

**Principle:** Existing members are already known quantities — they skip account verification. Officers assign roles directly from the existing in-game roster.

### Migration Steps

1. **Prepare a roster** — before launching the new server, document every existing member's Discord username and their current in-game tier (T1/T2/T3/T4 and whether they're on council). A spreadsheet works; this becomes the source of truth for role assignment.

2. **Soft launch the new server** — complete all Tasks 1–14 in the implementation plan (server fully configured, seeded with starter content). Do not announce publicly yet.

3. **Announce in the old server** — post in the old server's announcements channel:
   - Link to the new server invite
   - State the migration deadline (recommended: 2 weeks)
   - Explain that roles will be assigned directly — no need to go through account verification

4. **Fast-track role assignment** — as existing members join the new server:
   - They receive `@Squire` automatically (expected — ignore the onboarding flow)
   - An officer opens Server Settings → Members, finds the user, and assigns their correct role directly (`@Knight`, `@Landed Knight`, `@Small Council`, or `@Hand of the King`)
   - The `@Squire` role is replaced by the appropriate role — no screenshot verification required
   - Council members receive both their tier role and `@Small Council`

5. **Track completion** — check off members against the roster as they are assigned. Chase down stragglers in the old server before the deadline.

6. **Close the old server** — after the migration deadline, either archive (set all channels to read-only) or delete the old server. Post a final redirect message first.

### Fast-Track vs. New Member Flows

| Member type | Onboarding path |
|---|---|
| Existing member (porting over) | Officer assigns role directly from roster — skip verification |
| New recruit joining fresh | Full Squire → screenshot verification → Knight flow |

---

## Channel Count

21 channels total across 6 categories (Tips & Tricks and Research Goals merged into Guides). This is intentionally lean — if a topic outgrows a shared channel, split it then rather than pre-emptively. Three Citadel channels (Q&A, Hero Builds, Gear Sets) are Forum type; the rest are standard text channels.

---

## Out of Scope

- Bot configuration (bubble reminder automation, Carl-bot setup, etc.) — implementation detail, not structural
- Server icon, banner, and branding assets
- Integration with external tools beyond linking to the companion site
