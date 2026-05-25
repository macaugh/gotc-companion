# Discord Alliance Server Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up a fully configured Discord alliance server for a GotC alliance with role-gated categories, automated onboarding, a reference library using Forum channels, and self-serve color roles.

**Architecture:** Six categories gated by five Discord roles (Squire → Knight → Landed Knight → Small Council → Hand of the King). Squires see only Welcome; Knights get full access except The Small Council. Onboarding auto-assigns Squire; a single officer action promotes to Knight after screenshot verification. The Citadel uses Discord Forum channels for searchable, threaded reference content.

**Tech Stack:** Discord (server platform), Discord Community + Onboarding feature, Discord Forum channel type, Discord role picker (or Carl-bot for color role selection).

**Reference spec:** `docs/superpowers/specs/2026-05-24-discord-server-design.md`

---

## Task 1: Create the Server

**What:** Create a blank Discord server as the foundation.

- [ ] Open Discord → click the **+** icon in the server list (left sidebar)
- [ ] Select **Create My Own** → **For a club or community**
- [ ] Name the server (e.g. your alliance tag/name)
- [ ] Upload a server icon if you have one (can be changed later)
- [ ] Click **Create**

**Verify:** Server appears in your sidebar. You land on `#general` by default.

- [ ] Delete the default `#general` and `#off-topic` channels Discord creates (right-click → Delete Channel) — you'll create your own
- [ ] Delete the default `General` voice channel

**Verify:** Server is empty — no categories, no channels.

---

## Task 2: Enable Community Mode

**What:** Community mode is required for Discord's native Onboarding feature and Announcement channels.

- [ ] Open **Server Settings** (click server name → Settings)
- [ ] Sidebar → **Enable Community** → **Get Started**
- [ ] Follow the prompts: set a rules channel and updates channel (you'll replace these with proper channels in Task 4 — pick any placeholder name for now)
- [ ] Complete the community setup wizard

**Verify:** Server Settings sidebar now shows a **Community** section. The **Onboarding** option is visible.

---

## Task 3: Create Roles

**What:** Create the five tier roles and set their hierarchy. Names below match the spec suggestions — rename to fit your alliance identity.

Role hierarchy in Discord is top-to-bottom in Settings → Roles. Higher = more authority. Set them in this order (top to bottom):

- [ ] Open **Server Settings → Roles** → click **Create Role** for each role below, in order:

| Role name | Permissions to enable | Color |
|---|---|---|
| Hand of the King | Administrator | Gold (#c9a961 or similar) |
| Small Council | Manage Messages, Manage Channels, Mute Members | Silver/light grey |
| Landed Knight | Manage Messages (in Citadel only — set in channel overrides later) | Dark red |
| Knight | (none beyond default) | Any — members pick their own color via color roles |
| Squire | (none beyond default) | (none) |

- [ ] After creating each role, drag them in the Roles list so the order top-to-bottom is: **Hand of the King → Small Council → Landed Knight → Knight → Squire**

**Verify:** In Settings → Roles, the hierarchy reads Hand of the King at top, Squire at bottom.

- [ ] Assign yourself the **Hand of the King** role

---

## Task 4: Create Color Roles

**What:** Decorative roles members self-assign. No permissions. These sit below Squire in the hierarchy so they never override tier permissions.

- [ ] In **Server Settings → Roles**, create one role per color you want to offer. Suggested palette (rename freely):

```
Crimson, Gold, Emerald, Sapphire, Violet, Ivory, Obsidian, Bronze
```

- [ ] For each color role: enable **Display role members separately** = OFF, set no permissions, set the hex color
- [ ] Drag all color roles to the **bottom** of the role list, below Squire

**Verify:** Role list order ends with: ... → Squire → [color roles]

---

## Task 5: Set Up the Welcome Category

**What:** The only category visible to Squires. Contains onboarding and setup channels.

- [ ] Right-click the server name → **Create Category** → name it `Welcome` (or thematic equivalent)
- [ ] Inside Welcome, create these channels in order:

| Channel name | Type | Notes |
|---|---|---|
| `rules` (e.g. `ravens-gate`) | Text | Mark as Announcement type after creation |
| `announcements` | Text | Mark as Announcement type |
| `introductions` | Text | Standard text |
| `account-verification` | Text | Standard text |
| `choose-your-color` | Text | Standard text — role picker goes here in Task 11 |

- [ ] For the `rules` and `announcements` channels: after creation, open channel settings → **Channel Type** → switch to **Announcement**

**Set category permissions (controls Squire access):**
- [ ] Right-click the `Welcome` category → **Edit Category** → **Permissions**
- [ ] Click **+** → add `@Squire` → set: View Channel = ✓, Send Messages = ✓
- [ ] Click **+** → add `@everyone` → set: View Channel = ✗ (this hides Welcome from non-members; Discord handles this automatically with community mode)

**Set channel-level overrides:**
- [ ] `rules` channel settings → Permissions → add `@Squire`: Send Messages = ✗ (read-only)
- [ ] `announcements` channel settings → Permissions → add `@Squire`: Send Messages = ✗ (read-only)
- [ ] `announcements` channel settings → add `@Small Council`: Send Messages = ✓, `@Hand of the King`: Send Messages = ✓

**Verify:** Log in with an alt account (or use Discord's role preview) as a Squire. You should see Welcome and all five channels, but cannot type in rules or announcements.

---

## Task 6: Set Up The Small Council Category

**What:** Private category — invisible to everyone except Small Council and Hand of the King.

- [ ] Create category: `The Small Council`
- [ ] Inside it, create:

| Channel name | Type |
|---|---|
| `council-chamber` | Text |
| `ravens-scroll` | Text |
| `Council Chamber` | Voice |

**Set category permissions:**
- [ ] Edit category → Permissions
- [ ] `@everyone`: View Channel = ✗ (deny)
- [ ] `@Small Council`: View Channel = ✓, Send Messages = ✓, Manage Messages = ✓
- [ ] `@Hand of the King`: already covered by Administrator role

**Verify:** Switch to a Knight role preview — The Small Council category should be completely invisible.

---

## Task 7: Set Up The War Room Category

**What:** Event coordination hub. All Knights and above. Channels ordered by urgency.

- [ ] Create category: `The War Room`
- [ ] Inside it, create channels **in this order** (order = display order in sidebar):

| Channel name | Type |
|---|---|
| `bubble-reminder` | Text |
| `battlegrounds` | Text |
| `seat-of-power` | Text |
| `march-callouts` | Text |
| `battle-reports` | Text |
| `War Room` | Voice |
| `Battlegrounds` | Voice |

**Set category permissions:**
- [ ] Edit category → Permissions
- [ ] `@everyone`: View Channel = ✗
- [ ] `@Squire`: View Channel = ✗ (explicit deny to be safe)
- [ ] `@Knight`: View Channel = ✓, Send Messages = ✓

**Set channel-level override for bubble-reminder:**
- [ ] `bubble-reminder` → Permissions → `@Knight`: Send Messages = ✗ (read-only for members)
- [ ] `bubble-reminder` → Permissions → `@Small Council`: Send Messages = ✓

**Verify:** Knight role preview shows all War Room channels. Squire preview shows nothing.

---

## Task 8: Set Up The Citadel Category

**What:** Reference library. Three Forum channels (Q&A, Hero Builds, Gear Sets) and two text channels. Knights read-only except Q&A.

- [ ] Create category: `The Citadel`
- [ ] Create channels in this order:

| Channel name | Type |
|---|---|
| `q-and-a` | Forum |
| `hero-builds` | Forum |
| `gear-sets` | Forum |
| `guides` | Text |
| `keep-development` | Text |

**Creating a Forum channel:** When creating a channel, select **Forum** from the channel type list. After creation, open channel settings and add relevant tags:
- `q-and-a`: tags → `unanswered`, `answered`
- `hero-builds`: tags → `siege`, `cavalry`, `ranged`, `infantry`, `utility`
- `gear-sets`: tags → `combat`, `seat-of-power`, `march`, `utility`

**Set category permissions:**
- [ ] Edit category → Permissions
- [ ] `@everyone`: View Channel = ✗
- [ ] `@Squire`: View Channel = ✗
- [ ] `@Knight`: View Channel = ✓, Send Messages = ✗ (read-only by default)
- [ ] `@Landed Knight`: View Channel = ✓, Send Messages = ✓, Manage Messages = ✓

**Set channel-level override for q-and-a (Knights can post questions):**
- [ ] `q-and-a` → Permissions → `@Knight`: Send Messages = ✓ (override the category deny)

**Verify:**
- Knight preview: can see all Citadel channels, can only post in q-and-a
- Landed Knight preview: can post in all Citadel channels

---

## Task 9: Set Up Alliance Hall Category

**What:** General member space. All Knights and above.

- [ ] Create category: `Alliance Hall`
- [ ] Inside it, create:

| Channel name | Type |
|---|---|
| `alliance-chat` | Text |
| `polls` | Text |
| `gift-exchange` | Text |
| `alt-registration` | Text |
| `The Great Hall` | Voice |

**Set category permissions:**
- [ ] Edit category → Permissions
- [ ] `@everyone`: View Channel = ✗
- [ ] `@Squire`: View Channel = ✗
- [ ] `@Knight`: View Channel = ✓, Send Messages = ✓

**Set channel-level override for polls:**
- [ ] `polls` → Permissions → `@Knight`: Send Messages = ✗
- [ ] `polls` → Permissions → `@Small Council`: Send Messages = ✓, `@Hand of the King`: Send Messages = ✓

**Verify:** Knight preview shows Alliance Hall. Squire preview does not.

---

## Task 10: Set Up Off Duty Category

**What:** Social channels. All Knights and above.

- [ ] Create category: `Off Duty`
- [ ] Inside it, create:

| Channel name | Type |
|---|---|
| `the-tavern` | Text |
| `achievements` | Text |
| `other-games` | Text |

**Set category permissions:**
- [ ] Edit category → Permissions
- [ ] `@everyone`: View Channel = ✗
- [ ] `@Squire`: View Channel = ✗
- [ ] `@Knight`: View Channel = ✓, Send Messages = ✓

**Verify:** Knight preview shows Off Duty. Squire preview does not.

---

## Task 11: Configure Discord Onboarding

**What:** Automate the Squire → Knight onboarding path using Discord's native onboarding system.

- [ ] **Server Settings → Onboarding**
- [ ] Enable onboarding if not already on

**Default channels (shown to new members):**
- [ ] Add `rules`, `announcements`, `introductions`, `account-verification` as default channels

**Onboarding steps — add these in order:**
- [ ] Step 1: **Rules** — prompt: "Read and acknowledge the server rules" → link to `rules` channel
- [ ] Step 2: **Introduce yourself** — prompt: "Post an introduction in #introductions"
- [ ] Step 3: **Verify your account** — prompt: "Post an in-game screenshot in #account-verification so an officer can verify your identity"

**Auto-role on join:**
- [ ] In Server Settings → **Roles** or via the Onboarding screen, set **default role on join** = `@Squire`
  - If Discord's UI doesn't expose this directly: use a bot (Carl-bot → Welcome module → assign role on join = Squire)

**Verify:** Create a fresh test account (or use Discord's preview), join the server. Confirm:
- [ ] `@Squire` role is assigned automatically
- [ ] Only Welcome category is visible
- [ ] Onboarding steps appear

---

## Task 12: Set Up Color Role Picker

**What:** Let members self-assign cosmetic color roles in `#choose-your-color`.

**Option A — Discord's built-in role picker (simplest):**
- [ ] Open `#choose-your-color` → click **+** to add a component → **Role Selection**
- [ ] Select all color roles created in Task 4
- [ ] Set the prompt text: "Pick a color for your username"
- [ ] Save

**Option B — Carl-bot (if you prefer reaction roles):**
- [ ] Invite Carl-bot to the server: https://carl.gg
- [ ] In `#choose-your-color`, use the command: `!rr create` and follow Carl-bot's setup to attach emoji reactions to each color role

**Verify:** As a Knight, open `#choose-your-color`, select a color role, check that your username in the member list changes color.

---

## Task 13: Promote First Officer and Verify Full Permission Chain

**What:** End-to-end verification that all role tiers work correctly.

- [ ] Assign `@Small Council` to a trusted T2 member (or a test account)
- [ ] Assign `@Landed Knight` to a T3 member (or test account)
- [ ] Verify the permission chain by checking each role's visible channels:

| Role | Should see | Should NOT see |
|---|---|---|
| Squire | Welcome only | War Room, Citadel, Alliance Hall, Off Duty, Small Council |
| Knight | Welcome + War Room + Citadel (read-only except Q&A) + Alliance Hall + Off Duty | Small Council |
| Landed Knight | Same as Knight + can post in all Citadel channels | Small Council |
| Small Council | Everything — including bubble-reminder (explicitly granted in Task 7) | Nothing hidden |
| Hand of the King | Everything | Nothing hidden |

- [ ] Post a test message in `#announcements` as Small Council — verify it posts
- [ ] Attempt to post in `#announcements` as a Knight — verify it is blocked
- [ ] Post a question in `#q-and-a` as a Knight — verify it works
- [ ] Attempt to create a new post in `#hero-builds` as a Knight — verify it is blocked

---

## Task 14: Seed the Citadel with Starter Content

**What:** The reference library is only useful if it has content on launch. Add pinned starter posts so it doesn't launch empty.

- [ ] In `#guides` (text channel): post a pinned message with section headers for tips and research goals. Example structure:
```
📌 GUIDES INDEX
— General Tips: [post a few bullets or link to external source]
— Research Priority: [T4 research path / T3 path]
— Keep Development: see #keep-development
```
- [ ] In `#keep-development`: post a pinned message linking to the companion tools:
```
📌 LAUGHING CR0W'S COMPANION TOOLS
Prestige Ledger: https://[your-github-pages-url]/
Keep Upgrade Calculator: https://[your-github-pages-url]/keep-upgrade.html
Gendry's Forge: https://[your-github-pages-url]/gendrys-forge.html
```
- [ ] In `#hero-builds` (Forum): create one sample thread per troop type (siege, cavalry, ranged, infantry) as placeholder — even a stub post establishes the pattern for members
- [ ] In `#gear-sets` (Forum): create one sample thread per use case (combat, SoP, march, utility)

**Verify:** Navigate the Citadel as a Knight. Every channel has at least one pinned or posted item. Nothing is empty.

---

## Task 15: Write a Welcome Message and Pin Rules

**What:** `#rules` should contain the server rules and a welcome message. This is the first thing Squires see.

- [ ] In `#rules`, post (as Hand of the King) a message covering:
  - Welcome and server purpose
  - Alliance code of conduct
  - What each category is for (one line each)
  - How to complete onboarding and get the Knight role
  - Who to contact with questions
- [ ] Pin the message (right-click → Pin Message)

**Verify:** Open `#rules` as a Squire (role preview). The pinned message is visible and readable.

---

---

## Task 16: Prepare Migration Roster

**What:** Before announcing the new server, document every existing member so officers can fast-track role assignment without relying on memory.

- [ ] Create a spreadsheet (Google Sheets, Notion, etc.) with these columns:

```
Discord Username | In-game Name | Tier | Council? | Ported? | Role Assigned
```

- [ ] Fill in every current member from the existing server's member list and in-game roster
- [ ] Mark the `Council?` column for any T3 who is on council (they get both `@Landed Knight` and `@Small Council`)
- [ ] Share the spreadsheet with all officers so anyone can mark members as ported

**Verify:** Every current member has a row. `Tier` column has no blanks.

---

## Task 17: Soft Launch and Announce Migration

**What:** Open the new server to members and communicate the migration in the old server.

- [ ] In the new server: generate an invite link (right-click server name → Invite People → set to no-expiry)
- [ ] In the **old server's announcements channel**, post a migration message containing:
  - That a new server is launching (name it)
  - The invite link
  - That roles will be assigned directly — no screenshot verification needed for existing members
  - The migration deadline (set a specific date, recommended 2 weeks out)
  - Who to ping if they have issues joining or getting their role

**Verify:** Invite link works. Migration message is pinned in the old server's announcements.

---

## Task 18: Fast-Track Role Assignment for Existing Members

**What:** As existing members join the new server, assign their roles directly from the roster — bypassing the Squire onboarding flow.

For each member who joins:

- [ ] Open **Server Settings → Members** in the new server
- [ ] Find the member (they will have `@Squire` automatically)
- [ ] Cross-reference their Discord username against the migration roster
- [ ] Assign the correct role based on their tier:

| In-game tier | Assign role(s) |
|---|---|
| T4 | `@Knight` |
| T3 (not on council) | `@Landed Knight` |
| T3 (on council) | `@Landed Knight` + `@Small Council` |
| T2 | `@Small Council` (and optionally `@Landed Knight` if desired) |
| T1 | `@Hand of the King` |

- [ ] Mark the member as `Ported? = ✓` and fill in `Role Assigned` in the roster spreadsheet
- [ ] Do **not** require them to post in `#account-verification` — they are already verified

**Verify:** After assigning, confirm the member can see the correct categories (Knight sees War Room; Landed Knight can post in Citadel; Small Council sees The Small Council).

---

## Task 19: Chase Stragglers and Close Old Server

**What:** After the migration deadline, ensure all members are ported and shut down the old server.

- [ ] One week before deadline: post a reminder in the old server listing members who haven't joined yet (cross-reference roster `Ported?` column)
- [ ] On the deadline: post a final message in the old server stating it is being archived
- [ ] Set all old server channels to read-only (Edit Channel → Permissions → `@everyone`: Send Messages = ✗) — this preserves history without allowing new posts
- [ ] Confirm roster shows 100% of members ported (or note anyone who left the alliance)
- [ ] Optionally: transfer server ownership to a throwaway account and leave, or delete the old server

**Verify:** Old server is read-only. New server roster matches the expected member count.

---

## Completion Checklist

- [ ] Server created with Community mode enabled
- [ ] 5 tier roles + color roles created with correct hierarchy
- [ ] All 6 categories created with correct permissions
- [ ] 28 channels created in correct order within their categories (24 text/forum + 4 voice)
- [ ] 3 Forum channels (q-and-a, hero-builds, gear-sets) configured with tags
- [ ] Onboarding flow configured: Squire auto-assigned, 3 onboarding steps set
- [ ] Color role picker live in `#choose-your-color`
- [ ] Permission chain verified end-to-end for all 5 role tiers
- [ ] Citadel seeded with starter content
- [ ] Rules channel has pinned welcome message
- [ ] Migration roster prepared and shared with officers
- [ ] Migration announced in old server with invite link and deadline
- [ ] All existing members ported and roles assigned directly from roster
- [ ] Old server archived or deleted after migration deadline
