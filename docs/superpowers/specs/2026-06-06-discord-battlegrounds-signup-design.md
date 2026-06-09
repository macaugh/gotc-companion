# Discord Battlegrounds Sign-Up Bot — Design Spec

**Date:** 2026-06-06
**Scope:** A Discord bot for managing Battlegrounds event sign-ups. Officers create events; members sign up via slash command or button. Officers manage the roster and export it for coordination.

---

## Goals

- Let members sign up for Battlegrounds events with their troop type and highest tier that can fill 4 rallies
- Let officers create one-time or recurring BG events, optionally linked to Discord Scheduled Events
- Provide a live roster embed that updates in place as sign-ups arrive
- Let officers export the roster to CSV for members not in Discord or offline coordination
- Let officers manually add non-Discord members to the roster

---

## Architecture

**Stack:** discord.js v14 (Node.js), SQLite via `better-sqlite3`, hosted on Railway with a persistent volume.

**Hosting:** Railway free tier. SQLite database file persisted to a Railway volume at `data/battlegrounds.db` — survives deployments and restarts.

**GitHub Pages note:** The existing companion site runs on GitHub Pages (static only). The bot backend is a separate Railway service in the same repo — no code is shared at runtime.

---

## Data Model

### `events` table

| Column | Type | Notes |
|---|---|---|
| id | integer PK | |
| name | text | e.g. "BG Week 22" |
| event_date | text | ISO date string |
| discord_event_id | text | nullable — linked Discord Scheduled Event ID |
| recurrence | text | null / "weekly" / "biweekly" |
| signup_deadline | text | nullable ISO datetime |
| created_by | text | Discord user ID of creating officer |
| is_active | integer | 1 = open for sign-ups, 0 = closed |

### `signups` table

| Column | Type | Notes |
|---|---|---|
| id | integer PK | |
| event_id | integer FK | references events.id |
| discord_user_id | text | null for non-Discord members |
| display_name | text | in-game name or Discord username |
| troop_type | text | "infantry" / "cavalry" / "ranged" |
| tier | integer | 7–12 |
| added_by | text | null = self-signup; officer Discord ID = manual add |
| signed_up_at | text | ISO datetime |

---

## Commands

### Officer Commands

Restricted to members with Discord's built-in **Manage Events** permission.

| Command | Description |
|---|---|
| `/bg-create` | Opens a modal: event name, date, optional recurrence (none / weekly / biweekly), optional sign-up deadline. Creates a Discord Scheduled Event if a date is provided. |
| `/bg-post [event]` | Posts the live sign-up embed + buttons in the Battlegrounds channel. Defaults to the next upcoming event. |
| `/bg-close [event]` | Closes sign-ups — buttons disabled, no new entries accepted. Defaults to the next upcoming event. |
| `/bg-roster [event]` | Shows current sign-ups as a formatted embed, grouped by troop type, tiers sorted high→low. |
| `/bg-export [event]` | Replies with a CSV file attachment (Name, Troop Type, Tier, Signed Up At, Added By). |
| `/bg-add <name> <troop_type> <tier> [event]` | Manually adds a non-Discord member by display name. |
| `/bg-remove <name_or_@user> [event]` | Removes any sign-up entry. |

### Member Commands

Available to all server members.

| Command | Description |
|---|---|
| `/signup [event]` | Opens a modal with dropdowns for Troop Type and Tier. Defaults to the next upcoming event. Re-submitting overwrites the previous entry. |
| `/signup-cancel [event]` | Removes the member's own sign-up from the specified (or next upcoming) event. |

---

## Troop Types & Tiers

- **Troop types:** Infantry, Cavalry, Ranged (Siege excluded — not effective for PvE hunting events)
- **Tiers:** T7–T12
- The tier entered represents the highest tier troop the member has enough of to fill 4 rallies

---

## Sign-Up Flow

### Button flow
1. Officer runs `/bg-post` → bot posts a sign-up embed with **Sign Up** and **Cancel** buttons in the Battlegrounds channel
2. Member clicks **Sign Up** → modal opens with Troop Type and Tier dropdowns
3. Member submits → bot saves to DB, edits the embed in place, replies ephemerally: "Signed up as **Infantry T11** for BG Week 22."
4. Member clicks **Cancel** → removes their entry, embed updates in place

### Slash command flow
- `/signup` behaves identically to clicking the button — same modal, same result
- `/signup-cancel` behaves identically to clicking Cancel

### Pre-fill behavior
Discord string select menus cannot be pre-populated in modals. If a member runs `/signup` and already has an entry, the bot first sends an ephemeral message showing their current sign-up ("You're signed up as **Infantry T11**") with an **Update** button. Clicking Update opens the modal with default (first) values — the member selects their new choices and submits to overwrite.

---

## Live Roster Embed

The embed posted by `/bg-post` updates in place on every sign-up, update, or cancellation. No new message spam.

```
⚔️ Battlegrounds Sign-Up — BG Week 22
📅 Saturday, June 7 · Sign-ups close June 6 at 10pm

Infantry (4)    T12 · T11 · T10 · T10
Cavalry (3)     T12 · T12 · T9
Ranged (2)      T11 · T8

Total: 9 signed up

[  Sign Up  ]   [  Cancel  ]
```

- Tiers sorted high→low within each troop type
- Once `/bg-close` is run, buttons are replaced with a "Sign-ups closed" label

---

## CSV Export Format

Columns: `Name, Troop Type, Tier, Signed Up At, Added By`

- **Name:** Discord display name, or the string passed to `/bg-add` for non-Discord members
- **Added By:** "self" if the member signed up directly; the officer's display name if added via `/bg-add`

---

## Recurring Events

When a recurring event closes (via `/bg-close`), the bot automatically:
1. Creates the next occurrence in the DB (same name + recurrence interval applied to the date)
2. Posts a new sign-up embed in the Battlegrounds channel

No officer action is required to continue a recurring series.

---

## Error Handling

| Scenario | Behavior |
|---|---|
| Sign-up submitted after deadline | Ephemeral reply: "Sign-ups for BG Week 22 are closed." |
| `/signup` with no active events | Ephemeral reply: "No upcoming Battlegrounds events found. Check with an officer." |
| `/bg-add` for a name already in the event | Error: "A sign-up for **[name]** already exists — use `/bg-remove` first." |
| `/bg-post` called twice for same event | Warning: "A sign-up post already exists for this event. Post again anyway?" (Yes/No confirmation) |
| Discord Scheduled Event deleted externally | BG event in DB is unaffected — `discord_event_id` is optional metadata only |
| Bot restart / Railway redeploy | SQLite file persists on Railway volume — all state survives |

---

## Project Structure

```
discord-bot/
├── src/
│   ├── commands/
│   │   ├── bg-create.js
│   │   ├── bg-post.js
│   │   ├── bg-close.js
│   │   ├── bg-roster.js
│   │   ├── bg-export.js
│   │   ├── bg-add.js
│   │   ├── bg-remove.js
│   │   ├── signup.js
│   │   └── signup-cancel.js
│   ├── interactions/
│   │   ├── signup-button.js   ← button click handler
│   │   └── signup-modal.js    ← modal submit handler
│   ├── db/
│   │   ├── schema.js          ← creates tables on first run
│   │   └── queries.js         ← all DB reads/writes
│   ├── lib/
│   │   ├── embed.js           ← builds the roster embed
│   │   ├── export.js          ← CSV generation
│   │   └── recurrence.js      ← next-occurrence logic for recurring events
│   ├── deploy-commands.js     ← one-time script to register slash commands
│   └── index.js               ← bot entry point
├── data/
│   └── battlegrounds.db       ← SQLite file (persisted on Railway volume)
├── package.json
└── .env.example               ← DISCORD_TOKEN, CLIENT_ID, GUILD_ID
```

---

## Out of Scope

- Role-based rally assignment (e.g. assigning specific members to rally 1, 2, 3, 4)
- Integration with the companion site web UI
- DM notifications or reminders to members who haven't signed up
- Multi-server support (single guild only)
