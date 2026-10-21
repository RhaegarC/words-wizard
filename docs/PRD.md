# Product Requirements Document
## English Word Learning PWA for Children (Ages 9–12)

**Version:** 0.1 (Draft for Review)
**Status:** For review
**Last Updated:** [date]

---

## 1. Overview

A lightweight, offline-first Progressive Web App (PWA) that helps children aged 9–12 learn English vocabulary through short, game-like practice sessions. Learning is framed around a virtual character that the child creates whenever no character exists, grows stronger as the child practices, and falls asleep if the child does not practice for 7 days.

**No backend.** No API, database server, or third-party services. All data lives on-device. The app is designed to be "Added to Home Screen" on iPad and installed as a PWA on Edge. **The installed-PWA context is the primary usage scenario**, and the character system's data durability depends on it (see §8.4).

---

## 2. Goals & Non-Goals

### Goals
- Make vocabulary practice short (5–10 min), repeatable, and fun for 9–12 year olds.
- Work fully offline after first load.
- Give children ownership and motivation via a virtual character they create and grow.
- Let children see how much they have learned (Vocabulary Repository) and check retention monthly.
- Keep the product technically lightweight: no servers, no accounts, no sync.
- Structure content and data so future features (phrases, speaking, stories, parent dashboards) can be added without redesign.

### Non-Goals (for this version)
- Multi-device sync or cloud backup.
- Social features, leaderboards, or class/teacher dashboards.
- Speech recognition / pronunciation scoring.
- Native app packaging (Capacitor/React Native) — future consideration only.

---

## 3. Target Users

| User | Description |
|------|-------------|
| **Primary learner** | Child aged 9–12. May be a native English speaker or ESL learner. Uses iPad (installed PWA) or desktop/Edge. |
| **Secondary (facilitator)** | Parent or teacher who may set up the app, add custom words, or export a backup. Not a daily user. |

---

## 4. Key Product Decisions (from design discussion)

1. **Word library is static content; progress is dynamic per learner.** Content and progress are stored separately. Words are never mutated by learning.
2. **Themes are kid-chosen vocabulary topics** framed by *game genre* (de-branded), not real game IP. Each topic maps to genuinely useful English words.
3. **Storage: IndexedDB via Dexie.js.** No localStorage for progress. No SQLite.
4. **PWA + "Add to Home Screen" is the primary delivery model and a hard onboarding requirement.** Word data is bundled with the app; only profiles and progress are written to IndexedDB. For installed PWAs, Safari's 7-day storage eviction does not apply (see §8.4).
5. **The character is created whenever no character exists**, before any practice. It is the emotional anchor and the child's first act of ownership. Creation = name + avatar chosen from a set of built-in avatars.
6. **The 7-day dormancy is turned into a feature:** the character falls asleep after 7 days without practice and is revived by practicing. The clock starts at character creation.
7. **Growth is driven by XP and shown as stages.** XP is the internal currency; stage is the visible growth. No separate level system. The chosen avatar is the character's identity; stage is a growth layer on top of it.
8. **The child can see what they have learned** via a Vocabulary Repository (countable, filterable) and checks retention via a Monthly Review.
9. **A single unified Care Token** covers both streak freeze and character care (§7.5).
10. **A JSON export/import backup exists as an optional facilitator tool.** It is not the primary data-protection mechanism; installation + `persist()` is.

---

## 5. Core Learning Loop

A session is 5–10 minutes and composed of:

1. **Word Introduction**
   - Word text
   - Audio pronunciation (required)
   - Image or emoji
   - Kid-friendly definition (one short sentence)
   - One example sentence in a relatable context

2. **Practice Modes** (rotate to avoid boredom)
   - Picture match: image → pick the word
   - Word → meaning: multiple choice (3–4 options)
   - Spelling builder: drag letter tiles
   - Fill the blank: sentence with a missing word
   - Listen & choose: hear the word → pick matching picture/word

3. **Feedback**
   - Never "wrong" — always encouraging ("not quite — try again!") with a hint.
   - Correct answers trigger a brief, satisfying micro-animation/sound.

4. **Session End**
   - Update per-word progress
   - Award character XP
   - Show progress summary

### 5.1 Character Creation Gate (No-Character Check)

On app open, check for a profile with a character. If none exists, the child is routed to **Character Creation** before reaching the learning loop.

**Character Creation screen:**
- **Name** — free text, or pick from suggestions.
- **Avatar** — choose one from a set of built-in illustrated avatars (bundled data, not code).
- Confirm → character is created; `createdAt = lastPracticeAt = now`; the dormancy clock starts.

Creation is the only blocking gate. Install guidance and topic selection are separate, non-fused steps that follow. (This single check covers both first use and data loss — see §8.3.)

---

## 6. Vocabulary & Themes

### 6.1 Data Model

```
Topic (kid-chosen, game-genre framed)
  └── Pack (ordered mini-set, ~15–20 words)
        └── Word (mixed concrete + abstract)
```

- A **Word** may belong to multiple topics/packs via shared IDs (no duplication).
- Topics are **entry points into one shared word pool**; progress carries across.
- Core high-frequency words should be reachable from any topic.

### 6.2 Theme / Topic Rules

- Topics are **framed by game genre, never by real game IP**.
  - Allowed: "Craft & Build," "Co-op Quest," "Battle & Survive," "Explore & Discover," "Race & Speed," "Puzzle & Mystery."
  - Forbidden: game names, logos, characters, or game-specific slang (e.g., "Minecraft," "creeper," "redstone," "It Takes Two").
- **Usefulness test:** every topic must yield ~60–80 genuinely useful English words, otherwise it is not ready to ship.
- Word mix per topic:
  - ~80% core useful words (build, share, brave, escape, discover, solve, plan)
  - ~20% thematic flavor words that are still real words (diamond, torch, portal, treasure, dungeon)
  - **Abstract/emotional words are required** in every topic (e.g., brave, proud, together, careful).
- Each pack should start concrete and end with abstract/emotional words.
- Cap at **5–8 topics** at launch.

### 6.3 Word Schema

```
Word {
  id: string
  text: string
  audioUrl: string
  imageUrl: string
  definition: string        // kid-friendly, 1 sentence
  examples: string[]
  partOfSpeech: string
  theme: string
  level: 1 | 2 | 3
  tags: string[]
  topicIds: string[]        // memberships
  firstLanguageHints?: Record<string, string>  // reserved for future ESL support; unused in v1
}
```

### 6.4 Topic & Pack Schema

```
Topic {
  id: string
  title: string             // kid-facing, genre label
  icon: string
  description: string
  packIds: string[]
}

Pack {
  id: string
  title: string
  topicId: string
  wordIds: string[]
  order: number
  unlockRule: { type: 'masteryCount' | 'packComplete', value: number }  // structured, not a free string
}
```

### 6.5 Content Storage

- Word library, topics, and packs are **bundled with the app** (read-only JSON) and served through a data-access layer (e.g., `getWordsByTopic()`).
- The data-access layer is abstracted so content can move to a CMS/DB later without changing UI code.
- Content updates ship as app version bumps; the service worker precaches the new JSON (see §8.6).

---

## 7. Progression, Motivation & Character System

### 7.0 Character Creation

- Triggered whenever no character exists (first use, or data loss — see §8.3).
- Fields: `characterName` (string), `avatar` (id from bundled `avatars[]`).
- `createdAt` is set at creation and is the origin of the dormancy clock.
- Re-customization (name, avatar) is available later in settings; it does not reset the clock.

### 7.1 Collection & Progress

- **Word Book:** every mastered word is added to a personal, illustrated dictionary the child can browse.
- **Streaks & daily goals:** gentle streak counter. A missed day can be covered by spending a Care Token (§7.5); otherwise the streak simply pauses rather than resetting to zero.
- **Levels/themed worlds:** unlock the next pack/topic by mastering words.
- **Badges:** e.g., "Spelling Star," "10-day streak," "50 words mastered."
- **Avatar/character customization:** accessories or evolution unlocked by learning.

### 7.2 Virtual Character

**Purpose:** the character grows stronger with word practice; inactivity makes it sleep. This is the emotional anchor of the product.

**State model (stored on the profile):**
```
characterName        // set at creation
avatar               // id from bundled avatars[]
characterStage       // Egg → Hatchling → Juvenile → Adult → Legendary
xp                   // cumulative, earned from learning quality
vitality             // 0–100, decays over days of inactivity
createdAt            // timestamp — dormancy clock origin
lastPracticeAt       // timestamp — initialized to createdAt, reset on practice
careTokens           // earnable (§7.5)
```

**Growth rules:**
- XP is earned primarily from **mastered words and correct answers**, not merely opening the app. (Quality over frequency.)
- Stage advancement is tied to cumulative XP / mastered word counts.

**Growth model: XP drives stage; stage is the visible growth.**
- **XP** is a cumulative counter, earned from learning quality (table below). It is not surfaced as a raw number; it appears to the child only as stage progress.
- **Stage** is derived from XP thresholds, held in the config module:
  `Egg → Hatchling (50) → Juvenile (300) → Adult (900) → Legendary (2000)`.
- **No separate level system.** Between stages, the child sees "stage progress" (e.g., a filling bar on the character screen), not a level number.
- **Avatar vs. stage:** the chosen avatar is the character's identity; stage is a visual growth layer on top of it. Stage does not replace the avatar.
- All thresholds and XP values live in config (§12) so they are tunable without code changes.

**XP sources (quality over frequency):**

| Action | XP | Rationale |
|---|---|---|
| Correct answer (first try) | +2 | Rewards getting it right, not just tapping |
| Correct after a hint/retry | +1 | Still progress, less reward |
| Word reaches `mastered` | +10 | The real milestone; XP comes primarily from mastered words |
| Completing a session | +5 | Small completion bonus; keeps short sessions worthwhile |
| Opening the app / browsing Word Book | 0 | Explicitly no XP — prevents idle farming |

Wrong answers cost nothing (no punitive tone, per §10).

**Definition of "activity":** completing at least one practice session. Opening the app, browsing the Word Book, or changing settings does **not** reset `lastPracticeAt`.

**Vitality & sleep rules (computed on app open, no server job):**
- The dormancy clock is anchored at `lastPracticeAt ?? createdAt`, so a character that is created and never practiced still falls asleep on day 7.
- Practicing any word resets `lastPracticeAt` and restores vitality.
- Vitality visibly decays with days of inactivity.
- Day 4–5: character shows a **"sleepy" warning** in-app.
- Day 7+: character is **asleep / hibernating** (NOT permanently dead).
  - It can be **revived by completing a short practice session**.
- **Do not** permanently kill the character in this version.

**Pseudo-logic:**
```js
const anchor = profile.lastPracticeAt ?? profile.createdAt;
const daysIdle = (Date.now() - anchor) / 86400000;
const state =
  daysIdle >= 7 ? 'sleeping' :
  daysIdle >= 4 ? 'sleepy'   : 'awake';
```

**Guardrails:**
- Soften "death" to "dormancy/sleep"; always offer a revival path.
- Show clear warnings before day 7.
- Grant **Care Tokens** through practice (§7.5). Tokens can freeze decay or quick-wake a sleeping character, but revival is always free via one short practice session.
- Rules must be transparent (why it's sleeping, exactly how to wake it).
- Reward learning quality over raw app opens.
- **Ship the gentle "sleep/wake" version first**; only consider harsher stakes after user testing.
- A never-practiced character that falls asleep shows a gentle wake screen: "Your [avatar] fell asleep waiting for you — finish one short session to wake them."

### 7.3 Vocabulary Repository (Learned Words View)

**Purpose:** Give the child a place to see *how much they have earned*. It answers "how many words do I know?" in a countable, filterable way.

**Content:** Every word with `Progress.status` of `learning` or `mastered`. Words with `status: 'new'` are excluded (not yet earned).

**Display:**
- Total learned count ("You know 47 words!")
- Breakdown by topic/pack ("Craft & Build: 12 words")
- Breakdown by status: `learning` (in progress) vs. `mastered` (solid)
- Per-word detail: definition, audio, example, current strength as a simple bar (not a number)
- Filter/sort: by topic, by status, by recently learned

**Data access:** A **view** over `Progress` + bundled content. No new table. Reuses existing records.

**Distinction from Word Book (§7.1):**
- Word Book = illustrated, browseable, story-like. Emotional.
- Vocabulary Repository = factual, countable, filterable. Informational.
- Both read from the same `Progress` data.

### 7.4 Monthly Review

**Purpose:** A scheduled, comprehensive review of learned words, separate from the daily spaced-repetition queue. It catches words that spacing hasn't surfaced recently, gives a clear retention signal, and provides a natural moment to **demote** words that were `mastered` but have decayed.

**Trigger:** First app open in a new calendar month (or >28 days since last), if at least one word has `status: 'learning'` or `'mastered'`. Not blocking — offered as a prominent card on home ("Monthly Review is ready!").

**Scope:** A sample of learned words, cap **20 words**, selected as:
1. Lowest `strength` first (most likely forgotten).
2. Words with the oldest `lastSeenAt`.
3. A few high-strength words mixed in to confirm retention.

**Format:** Reuses existing practice modes (§5). Not a new exercise type. Same encouraging tone.

**Outcome:**
- Each word's `strength` is updated using SM-2-lite (§9).
- Words dropping below `strength < 0.3` are flagged **"needs practice"** and re-enter the daily Review queue sooner.
- Words passing cleanly have `nextReviewAt` pushed out.
- Summary screen: "You reviewed 20 words. 16 still strong, 4 could use another look."

**Storage:** Add one field to `Profile`:
```
lastMonthlyReviewAt  // timestamp | null
```

**Tone guardrail:** Never say "you forgot X words." Use "X words want another visit."

### 7.5 Unified Token System (Care Tokens)

One token type, one currency, two spend options — replacing the earlier split between "freeze tokens" and "revive tokens."

> **Care Tokens.**
>
> **Earning:** +1 Care Token per 5 completed sessions. Cap: 3 held at any time.
>
> **Spending (two uses, same currency):**
> 1. **Freeze** — spend 1 to pause vitality decay for one day (prevents the "sleepy" state from advancing). Usable only when `state === 'awake' || 'sleepy'`.
> 2. **Quick wake** — spend 1 to wake a sleeping character *without* completing a session. This is a convenience, not a requirement — revival is always free via one short practice session (§7.2).
>
> **Rationale:** Both actions are "caring for the character." One currency, two choices, no double bookkeeping. The child learns a single resource.
>
> **Schema impact:** `Profile.careTokens` replaces the earlier `reviveTokens` field (same semantics, clearer name).

### 7.6 Mastery Decay Rule

> **Demotion rule:** a word with `status: 'mastered'` that fails during Monthly Review or a daily review drops `strength` per SM-2-lite. If `strength < 0.5`, `status` reverts to `'learning'`. The word remains in the Vocabulary Repository (both statuses are counted) but its per-word badge changes from "mastered" to "learning again." No word is ever removed from the Repository once earned.
>
> **Display rule:** Repository shows `mastered` count and `learning` count separately; a demoted word moves from the mastered tally to the learning tally but does not reduce the total learned count.

---

## 8. Technical Architecture

### 8.1 Stack

| Layer | Choice |
|-------|--------|
| App type | PWA (installable, offline-capable) |
| Storage | IndexedDB via **Dexie.js** |
| Content | Bundled read-only JSON behind a data-access layer |
| Sync | None |
| Backend | None |

### 8.2 Storage Rules

- **Do not** use localStorage for progress or profiles. localStorage may hold only trivial UI config (e.g., last selected topic).
- **Do not** use SQLite/WA-SQLite (Safari/OPFS limitations; over-engineered for this data scale).
- Word content is bundled; only `profiles` and `progress` are persisted in IndexedDB.

### 8.3 Dexie Schema (initial)

```js
const db = new Dexie('WordLearnDB');
db.version(1).stores({
  profiles: '++id, name, createdAt',
  progress: '++id, profileId, wordId, mastery, nextReviewAt',
  // words may be bundled instead of stored
});
```

Profile record:
```
Profile {
  id, name,
  characterName, avatar,     // avatar = id from bundled avatars[]
  selectedTopicIds[],
  characterStage, xp, vitality,
  lastPracticeAt,            // initialized to createdAt
  careTokens, createdAt,
  lastMonthlyReviewAt        // timestamp | null
}
```

Progress record:
```
Progress {
  id, profileId, wordId,
  status: 'new' | 'learning' | 'mastered',
  strength: number,        // 0–1, drives spacing
  nextReviewAt: Date,
  correctCount, wrongCount,
  lastSeenAt
}
```

**Startup data check:** on boot, check for a profile with a character.
- Present → normal flow.
- Absent → route to Character Creation. This covers both first use and Safari-eviction data loss; no branching on *why* it is absent. In an installed-PWA context, absence is abnormal and worth logging/reporting; in a browser tab it is expected. The recovery copy is the same either way ("Let's make a new friend!"), and the install prompt is shown afterward if not installed.

### 8.4 Persistence & Data Safety (PWA-primary)

**The installed-PWA context is the primary scenario and the foundation of data durability.**

- **Safari's 7-day storage eviction does not apply to PWAs added to the Home Screen.** WebKit's policy exempts Home Screen web apps: they are not part of Safari, have their own usage-day counter, and that counter resets with actual app use. WebKit explicitly does not expect first-party website data in such web apps to be deleted. (The 7-day cap applies to Safari tabs only.)
- **"Add to Home Screen" is a hard onboarding requirement, not a hint.** The app shows a prominent install card after character creation, and encourages installation before the first session. A Safari tab cannot guarantee that a child returning after a week off will still have their character and progress.
- **`navigator.storage.persist()`** is called on first launch and the result recorded. It is a supporting defense against system storage pressure, not the primary protection — installation status is. Safari 17+ supports the Storage API and tends to grant persistence to Home Screen web apps.
- **Edge (desktop/Android)** is Chromium-based: quota up to ~60% of disk; eviction only under extreme disk pressure (LRU). Negligible for this app's footprint.
- **Per-session durability check:** after each session ends, lightly verify the profile record still exists. If lost, show the graceful recovery entry point (§8.3) rather than a blank or broken screen.
- **Export Progress (JSON) / Import Progress (JSON)** in settings is an **optional facilitator tool** — useful for device migration and as a manual safety net, but not the primary protection. The primary protection is installed PWA + `persist()`.

### 8.5 Platform Notes

- **iPad Safari (installed PWA):** primary target. IndexedDB supported; OPFS not relied upon; Home Screen web app exempt from 7-day eviction; `persist()` best-effort but usually granted. Recommended and effectively required usage mode.
- **iPad Safari (browser tab):** supported for trial use, but subject to 7-day eviction. The app detects this context and prompts installation.
- **Edge (desktop/Android):** full IndexedDB and PWA support; primary development and debugging target.

### 8.6 Offline Updates & Service Worker

- Bundled content and app shell are precached by the service worker.
- Content updates ship as app version bumps: new SW installs, precaches new JSON, and prompts the user to refresh ("A new pack is ready!").
- The app must remain fully functional offline at all times after first load; no runtime fetch of content or audio.

---

## 9. Spaced Repetition (Background)

- Not surfaced to the child by name.
- Incorrect words resurface sooner; mastered words resurface occasionally.
- A **"Review"** queue acts as a quick daily warm-up, not homework.
- Session selection = due reviews (from `Progress`) + a few new words from the current unlocked pack + optional manual focus words.
- **Scheduler (MVP):** SM-2-lite. On correct: `strength += 0.2` (cap 1.0). On wrong: `strength -= 0.3` (floor 0). `nextReviewAt = now + intervalDays(strength)`, where `intervalDays` maps strength to 1/2/4/7/14/30 days. Status becomes `mastered` at `strength >= 0.8` and `correctCount >= 3`.
- **Daily session builder (MVP):** up to `reviewCap` (5) due reviews ordered by `nextReviewAt`; add up to `newWordsPerSession` (4) new words from the lowest-order unlocked pack; dedupe by `wordId`; cap total at 12 items.
- **Monthly Review builder (separate):** `selectMonthlyReviewWords()` — up to 20 learned words, selected by lowest strength, then oldest `lastSeenAt`, with a few high-strength confirmations mixed in. Does not compete with the daily Review slot.

---

## 10. Accessibility & Age-Appropriateness

- Large touch targets; clear fonts; high contrast; works on tablets.
- **Read-aloud everywhere:** audio for all text, supporting different reading levels and ESL learners.
- Minimal reading-heavy screens; lean on image, audio, interaction.
- Short sessions; timers optional and gentle (no punishing default timers).
- Encouraging tone throughout; never punitive language.

---

## 11. Optional Facilitator (Parent/Teacher) Features

Kept small and optional; not the default experience.

- **Focus list:** add specific words to practice next.
- **Mute/skip** a word temporarily.
- **Custom words:** add learner-specific words (name, local place, school vocab) as a per-learner extension of the content library.
- **Export/Import backup.**
- **"Tricky words" view** for the child: auto-populated from mistakes, optional "practice again."

---

## 12. Extensibility Requirements

- Practice modes built as **pluggable exercise modules** (add sentence building, speaking, etc. later without redesign).
- Content model supports future phrases/sentences (generous `Word` schema with `examples`, `tags`, `partOfSpeech`, reserved `firstLanguageHints`).
- Progress data model separated from UI so new features reuse it.
- Theme/topic/pack groupings live in data, not code.
- **Built-in avatars live in bundled data (`avatars[]`), not code.** New avatars are content additions.
- Storage accessed through a `ProgressProvider` interface so a future cloud sync implementation can replace Dexie without touching UI code.
- **Character decay rates, XP values, stage thresholds, session-size caps, Care Token cadence, and Monthly Review settings (`monthlyReviewCap`, threshold) live in a single config module** so future modes are data changes, not redesigns.

---

## 13. Phased Delivery

| Phase | Scope |
|-------|-------|
| **MVP** | Character creation gate (name + avatar from built-ins, triggered when no character exists); install-to-Home-Screen guidance; word cards (audio + image), 3 practice modes, immediate feedback, Word Book collection, simple streak, virtual character with XP/stage growth and sleep/wake, Vocabulary Repository view, Monthly Review (basic: 20-word sample, reuses practice modes), Dexie storage, `persist()`, startup data check, SM-2-lite scheduler + session builder, unified Care Token system, PWA install, JSON export |
| **Phase 2** | Themed topics/packs (5–8), badges, character evolution stage art, spaced-repetition queue refinements, "sleepy" warnings, per-session durability check, Monthly Review refinements (demotion rules, retention summary) |
| **Phase 3** | Story mode, timed challenges, personalization/customization, optional facilitator focus lists & custom words, JSON import |
| **Future** | Co-op/team mode concept, speaking practice, native packaging, parent dashboard (would require backend) |

---

## 14. Open Questions (for review)

1. **Character stakes:** Is "sleep + revive" final, or a configurable stricter mode later? (Decay rate in config.)
2. **Care Token cadence:** +1 per 5 completed sessions, cap 3, two spend options. Confirm.
3. **Session length:** 5–7 min: up to 5 due reviews + up to 4 new words, capped at 12 items. Confirm.
4. **Word audio:** Build-time TTS into bundled audio assets. Confirm engine/voice and fallback policy.
5. **Topic count at launch:** 5 proposed (Craft & Build, Explore & Discover, Puzzle & Mystery, Co-op Quest, Battle & Survive). Confirm.
6. **ESL support:** English-only for v1; `firstLanguageHints` reserved. Confirm.
7. **iPad onboarding:** Install card shown after creation; hard gate before first session or strong prompt? Confirm.
8. **Never-practiced dormancy:** In-app-only warning assumed (no notification permission in v1). Confirm.
9. **Avatar set & stage art:** How many built-in avatars at launch; each needs 5 stage visuals. Confirm art budget.
10. **XP tuning:** Confirm XP values and stage thresholds (50 / 300 / 900 / 2000).
11. **Monthly Review cadence:** "First open of each month, up to 20 words" vs. rolling 4-week window. Confirm.
12. **Mastery demotion threshold:** `strength < 0.5` proposed (§7.6). Confirm.
13. **Repository visibility:** Child-facing only, or facilitator summary too? (Recommendation: both.)
14. **Multi-profile:** Two children on one iPad — in MVP or Phase 2? (Recommendation: MVP for schema + switcher.)
15. **Streak reset behavior:** Does a missed day reset to 0, or pause? (§7.1 now says pause; confirm.)

---

## 15. Success Metrics (suggested)

- Session completion rate (started vs finished).
- Daily/weekly active learners returning without reminders.
- Words mastered per active learner per week.
- **Install rate** (share of first-run users who complete "Add to Home Screen") — leading indicator of data durability.
- **Stage progression rate** (share reaching Hatchling/Juvenile within expected time) — validates the XP curve.
- **Repository engagement** (share of learners who open the Vocabulary Repository) — validates that "seeing what you've earned" is a motivator.
- **Monthly Review completion rate** (offered vs. completed).
- **Strength delta after Monthly Review** (improved vs. decayed) — validates the checkpoint catches decay in time.
- Character revival rate after dormancy.
- Drop-off after first dormancy event.
- Abnormal data-loss rate (profile absent in installed-PWA context) — should be near zero.

---

## Appendix A — Screen Inventory & Navigation

### A.1 Screen list

| # | Screen | Purpose | Entry points | Phase |
|---|--------|---------|--------------|-------|
| 1 | **Character Creation** | Name + avatar | No profile at boot | MVP |
| 2 | **Install Prompt** | Add to Home Screen | After creation; if not installed | MVP |
| 3 | **Home** | Hub: character, streak, today's session, cards (Repository, Monthly Review) | After creation / install | MVP |
| 4 | **Session Intro** | Preview of today's session | Home "Practice" | MVP |
| 5 | **Word Introduction** | Card: text, audio, image, definition, example | Within session | MVP |
| 6 | **Practice Exercise** | One of the exercise modules (§5) | Within session | MVP |
| 7 | **Feedback** | Encouraging overlay | After each answer | MVP |
| 8 | **Session Summary** | XP earned, words practiced, stage progress | End of session | MVP |
| 9 | **Vocabulary Repository** | Learned word count, filters, per-word detail | Home card | MVP |
| 10 | **Word Detail** | Single word: definition, audio, example, strength bar | Repository list | MVP |
| 11 | **Word Book** | Illustrated browseable dictionary | Home | MVP |
| 12 | **Character Screen** | Avatar, stage, stage progress bar, vitality, Care Tokens | Home avatar tap | MVP |
| 13 | **Sleepy / Sleeping State** | Gentle wake screen + how to wake | Auto when `state !== 'awake'` | MVP |
| 14 | **Monthly Review Intro** | "20 words want a visit" | Home card, when due | MVP |
| 15 | **Monthly Review Summary** | Strong vs. needs-a-look counts | End of monthly review | MVP |
| 16 | **Settings** | Re-customize name/avatar, export, install status, profile switch | Home gear | MVP |
| 17 | **Profile Switcher** | Pick or add a profile | Settings / boot if >1 profile | MVP (schema) / Phase 2 (polish) |
| 18 | **Tricky Words** | Auto-populated from mistakes | Home card or Settings | Phase 2 |
| 19 | **Facilitator Panel** | Focus list, custom words, import | Settings (gated) | Phase 3 |

### A.2 Navigation model

```
Boot
 └─ profile exists? ──no──> [1] Character Creation ──> [2] Install Prompt ──> [3] Home
                    └─yes─> [3] Home

[3] Home ──> [4] Session ──> [5] Intro ──> [6] Exercise ⇄ [7] Feedback ──> [8] Summary ──> [3]
         ──> [9] Repository ──> [10] Word Detail ──> back
         ──> [11] Word Book
         ──> [12] Character
         ──> [14] Monthly Review (when due) ──> [15] Summary
         ──> [16] Settings ──> [17] Profile Switcher / re-customize / export
```

### A.3 Empty states

| Screen | Empty state | Copy | Behavior |
|--------|-------------|------|----------|
| Repository | 0 learned words | "Your word collection is waiting! Practice to add your first word." | CTA → start session |
| Repository | 1–4 words | "You've learned X words. Keep going!" | Show list |
| Monthly Review | <5 learned words | Card hidden | Do not offer until ≥5 learned |
| Monthly Review | 5–19 learned words | "Time for a monthly check-in!" | Review all learned words, cap 20 |
| Monthly Review | ≥20 learned words | "Time for a monthly check-in!" | 20-word sample per §7.4 |
| Word Book | 0 mastered | "Mastered words appear here." | CTA → session |
| Tricky Words (P2) | 0 | "No tricky words yet — nice!" | — |

### A.4 Modal / blocking rules

- **[1] Character Creation** — blocking; no way past without creating.
- **[2] Install Prompt** — prominent; dismissible once (per §8.4 open decision), re-shown next session until installed.
- **[13] Sleepy / Sleeping** — shown on Home as an overlay card; does not block the app (the child can still practice to wake). Sleeping state blocks *nothing* except character interactions; the wake path is always visible.
- **Monthly Review** — never blocking; a card the child can ignore.