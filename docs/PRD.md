# Product Requirements Document
## Bilingual English Word Learning PWA for Children (Ages 9–12)

**Version:** 0.2 (MVP decisions locked)
**Status:** Approved for implementation
**Last Updated:** 2026-10-21

> This version supersedes the exploratory notes in `docs/sample_data/Init/`. Where they
> disagree, this document governs.

---

## 1. Overview

A lightweight, offline-first Progressive Web App (PWA) that helps Chinese-speaking ESL
children aged 9–12 learn English vocabulary through short, game-like practice sessions.
The interface and learning content are bilingual (English + 中文): Chinese is the meaning
layer, English is the target language.

Learning is framed around a virtual character ("word buddy") that the child creates
whenever no character exists, grows stronger as the child practices, and falls asleep
after 7 days without practice.

**No backend.** No API, database server, accounts, sync, telemetry, or runtime
third-party services. All learner data lives on-device. The app is designed to be
"Added to Home Screen" on iPad and installed as a PWA on Edge. The installed-PWA
context is the primary usage scenario, and data durability depends on it (§8.5).

---

## 2. Goals & Non-Goals

### Goals
- Make bilingual vocabulary practice short (5–10 min), repeatable, and fun for
  Chinese-speaking ESL learners aged 9–12.
- Work fully offline after first load.
- Give children ownership and motivation via a virtual character they create and grow.
- Let children see what they have learned (Collection + Word Book) and check retention
  monthly.
- Keep the product technically lightweight: no servers, no accounts, no sync, no
  telemetry.
- Structure content and data so future features (phrases, speaking, stories,
  facilitator tools) can be added without redesign.

### Non-Goals (v1)
- Multi-device sync or cloud backup.
- Social features, leaderboards, or class/teacher dashboards.
- Speech recognition or pronunciation scoring.
- Native app packaging (Capacitor/React Native).
- Parent accounts, remote dashboards, or notifications.
- Multi-profile UI (schema remains multi-profile ready).
- Custom word lists or JSON import.
- Badges, Tricky Words, story mode, or timed challenges.

---

## 3. Target Users

| User | Description |
|------|-------------|
| **Primary learner** | Chinese-speaking ESL child aged 9–12, roughly Cambridge Starters–Flyers level. Uses iPad (installed PWA) or desktop/Edge. |
| **Secondary (facilitator)** | Parent or teacher who sets up the device, may export a backup, or reads the diagnostics view. Not a daily user. |

The app is single-profile per device in v1. Two siblings sharing a device share one
character and one progress record.

---

## 4. Key Product Decisions

1. Word library is static content; progress is dynamic per learner. Words are never
   mutated by learning.
2. Themes are kid-chosen vocabulary topics drawn from real-world categories (the offline word
   list's categories), never game IP. The topic count is open.
3. Storage: IndexedDB via Dexie.js. No localStorage for progress. No SQLite.
4. PWA + Add to Home Screen is the primary delivery model. Installation is a strong,
   repeated prompt, not a hard gate; `navigator.storage.persist()` supports it.
5. The character is created whenever no character exists, before any practice.
   Creation = name + avatar from built-in avatars.
6. The 7-day dormancy is a feature: the character falls asleep after 7 days without
   practice and is revived by practicing. The clock starts at creation and never kills
   the character.
7. Growth is driven by XP and shown as stages. XP is internal; stage is visible.
   Stage is derived from XP, not stored.
8. The child can see learned words via one **My Words** destination with two tabs:
   **Collection** (countable, filterable) and **Word Book** (illustrated,
   mastered-only).
9. A single unified **Care Token** covers both streak freeze and character care.
10. A JSON export exists as an optional facilitator tool. It is not the primary
    data-protection mechanism; installation + `persist()` is.
11. Pronunciation uses the **Web Speech API** (`speechSynthesis`), with an IPA fallback.
    No bundled audio files in v1. Local speech voices work offline; if none is
    available, the app shows IPA and substitutes a non-audio mode.
12. Word images are AI-generated, human-reviewed, and served from R2; `words.image` holds the
    URL, and an emoji/first-letter tile fills in until one exists. Buddy portraits remain bundled
    with the app.
13. The UI and content are **fully bilingual (EN/中文)**. Chinese is the default on
    zh-CN devices; a Settings toggle switches languages.
14. The app is hosted on **Cloudflare Pages**. Navigation uses hash routes, so every
    route is a fragment and no server rewrite is required.
15. **All five practice modes** ship in the MVP: picture match, word → meaning,
    spelling builder, fill-the-blank, listen & choose.
16. Product metrics are **local counters only**, surfaced in diagnostics and included
    in export. No telemetry or third-party analytics.

---

## 5. Core Learning Loop

A daily session is about **10 minutes** and contains **five new words, and no
more for that local day**:

- **Five new words**, each with a word-introduction card followed by **one
  spelling-building exercise**.
- Then a **Comprehensive Practice** block: one randomly chosen non-spelling mode
  per word, with the mode pairings and exercise order shuffled.
- Maximum **15 screens** (5 × (1 intro + 1 spelling) + 5 × 1). With no English
  voice, *Listen & choose* leaves the comprehensive pool, but the screen count
  is unchanged.
- Once those five words are learned, the same five are offered as **extra
  practice**: spelling plus the comprehensive block, with no introduction cards
  (10 screens, about 5 minutes). Repeated practice is a normal session and earns
  XP. No new words are introduced until the next local day.
- The daily due-review block is withdrawn; **Monthly Review** remains the
  spaced-repetition surface.

### 5.1 Word Introduction

- English word text with the Chinese translation beside it, for example `box 盒子`
- IPA / phonetic transcription
- Tap-to-hear pronunciation (Web Speech API; no autoplay)
- Bundled illustration
- Meaning (short gloss) and kid-friendly definition in **both English and Chinese**,
  whichever UI language is active
- Example sentence in the current UI language
- Part of speech

The card always shows both language versions of the meaning and definition. The
example follows the UI language, and its translation remains available on Word
Detail. The target word, IPA, image, and audio are always present.

### 5.2 Practice Modes (all five ship)

1. **Picture match** — illustration → pick the English word.
2. **Word → meaning** — English word → pick the short meaning in the current UI
   language (`meaningZh` in zh mode, `meaningEn` in en mode; 3–4 options).
3. **Spelling builder** — drag letter tiles to spell the English word.
4. **Fill the blank** — English sentence with a missing word; choose or build the
   missing word.
5. **Listen & choose** — hear the English word → pick the matching picture or word.

**Mode rotation:** a new word runs only the **spelling builder** while it is being
introduced, and a same-day repeat runs the same spelling exercise without an intro
card. After the learning block, **Comprehensive Practice** gives each word one
randomly chosen mode from the four non-spelling modes — picture match, word →
meaning, fill the blank, listen & choose — and shuffles the exercises. Spelling is
excluded so a comprehensive exercise never repeats the exercise the child has just
done. Both choices are deterministic for a profile, local day, and content version.

The Monthly Review gives each selected word one mode from all five, with a
deterministic rotation.

**Speech fallback:** if no English voice is available, *Listen & choose* is removed
from the comprehensive pool and from the monthly rotation. IPA is always visible.

### 5.3 Feedback

- Never say "wrong". Use encouraging language ("Not quite — try again!").
- **First miss:** a real hint (eliminate a distractor, or show the first letter).
- **Second miss:** a stronger hint (show the word's shape or meaning).
- **Third miss:** reveal the answer, require a confirming tap, then move on.
- Every wrong tap increments `wrongCount` and applies the SM-2-lite penalty.
- XP: first-try correct **+2**; correct after a hint **+1**; revealed answer **0**.
- A correct answer after any hint still increments `correctCount`.
- The submitted answer stays visible during feedback: a built word remains in its
  slots and a chosen option keeps its highlight. A retry clears the spelling board.

### 5.4 Session End

Commit the following in a **single Dexie transaction**:

- per-word progress and the XP earned during the session;
- the session-completion XP (**+5**);
- `completedSessions` and the Care Token cadence counter;
- the streak.

Then show the summary: words practiced, words mastered, XP earned, stage progress,
streak, and Care Token progress.

**No per-answer commit.** Leaving mid-session shows a gentle confirmation; confirming
discards the session. A browser kill cannot be intercepted and may lose the session;
this is accepted.

### 5.5 Character Creation Gate

On app open, check for a profile with a character. If none exists, route to **Character
Creation** before practice.

- **Name:** free text with suggestions, maximum 16 characters. This names the buddy;
  `profile.name` defaults to the same value.
- **Avatar:** choose one of six bundled buddy portraits; the file name is the
  character's name (Alex, Cody, Creeper, Malenia, May, Steve).
- Confirm sets `createdAt = lastPracticeAt = now` and starts the dormancy clock.
- Re-customization in Settings does not reset the clock.

Creation is the only blocking gate. Install guidance and topic selection are separate,
non-fused steps that follow.

---

## 6. Vocabulary & Themes

### 6.1 Structure

Mission 2 moves this model into D1 (feature 22). The physical tables are `topics`, `packs`,
`words`, and `pack_words`; there is no separate word-topic or word-example table.

```
Topic
  └── Pack (a day-sized sub-category; no fixed size)
        └── Word        (via pack_words, ordered by position)
```

- **Topics are the offline categories:** Animals, The body and the face, Clothes, Colours,
  Family & friends, Food & drink, Health, Numbers, The home, Materials, Names, Places &
  directions, and School. The list is open; content may add topics later.
- **Packs have no fixed size.** A pack is a sub-category of about five words for one day's
  practice; a longer pack simply spans several days.
- **A word may belong to packs of several topics.** It is introduced anew in each pack;
  mastery and scheduling stay at word level, keyed by `wordId`.
- All topics are choosable from the start unless archived.
- Within a topic, packs are ordered by `packs.sort_order` (the API calls it `Pack.order`). The
  first is open; each later pack unlocks when **every word of the previous pack has been
  introduced to that user**. Mastery counts are not used.

### 6.2 Theme / Topic Rules

- Topics are the real-world categories of the offline word list (`docs/sample_data/vocab.json`),
  never a game genre or a game IP.
  - Examples: Animals, Food & drink, The home, School, Places & directions.
- **Forbidden anywhere in content:** game names, logos, characters, or game-specific slang
  (e.g., "Minecraft," "creeper," "redstone").
- **Usefulness test:** each topic must yield enough genuinely useful English words for its packs.
  There is no fixed count; coverage is an editorial decision.
- Word mix per topic is reviewed, not counted: mostly core useful words, with a smaller share of
  thematic flavour words that are still real words.
- **Abstract/emotional words are required** in every topic (e.g., brave, proud, together,
  careful), and each pack's final third includes one.
- Each pack starts concrete and ends with abstract/emotional words.

### 6.3 Vocabulary Source

- The **Cambridge English Starters/Movers/Flyers 2025** word list in
  `docs/sample_data/` is the allowlist; the generated copy lives at
  `src/shared/content/rules/cambridge-allowlist.json`.
- App level 1/2/3 maps to Starters/Movers/Flyers. A word's level is its Cambridge band,
  not its pack order.
- The topic usefulness test and 80/20 mix are applied within the allowlist.
- Words outside the list require a documented exception reviewed with the content lead.

### 6.4 Word Schema

```ts
Word {
  id: string
  text: string                     // English target word
  phonetic: string                 // IPA
  partOfSpeech: string
  meaningEn: string                // short English gloss
  meaningZh: string                // short Chinese gloss
  definitionEn: string             // kid-friendly, one sentence
  definitionZh: string             // kid-friendly Chinese, one sentence
  examples: { en: string; zh: string }[]   // stored as a JSON column
  image: string | null             // R2 URL; null until art exists
  emoji?: string                   // transitional placeholder / fallback
  level: 1 | 2 | 3                 // Starters | Movers | Flyers
  tags: string[]                   // stored as a JSON column
  topicIds: string[]               // derived from active pack membership, never stored
}
```

- One row per headword; `text` is unique case-insensitively. `partOfSpeech` and the meanings are
  free text and may list several senses.
- `audioUrl` is removed. Pronunciation is synthesized from `text`.
- Future recorded audio can add `audioUrl?: string` without breaking existing records.
- v1 words are single words; phrases and sentences are Phase 3.

### 6.5 Topic & Pack Schema

```ts
Topic {
  id: string                       // immutable slug
  title: string                    // kid-facing category label
  titleZh: string
  icon: string
  description: string
  descriptionZh: string
  sortOrder: number
  createdAt: number
  updatedAt: number
  archivedAt: number | null
}

Pack {
  id: string                       // immutable slug
  title: string
  titleZh: string
  topicId: string
  wordIds: string[]                // derived from pack_words.position
  order: number                    // packs.sort_order; the API keeps this name
  createdAt: number
  updatedAt: number
  archivedAt: number | null
}
```

- `Topic.packIds` is not stored; a topic's packs are the rows whose `topicId` matches.
- There is no unlock rule column. Unlock is sequential completion, computed from the user's
  introductions (see §6.1 and §9).
- Ids are immutable and never reused. Display text is editable; removal is `archivedAt`, never a
  hard delete.
- `sortOrder` need not be unique; ordering is `(sortOrder, id)`.

### 6.6 Content Storage & Authoring

- Cloudflare D1 is authoritative for topics, packs, words, and pack membership. The SPA
  loads one bundle from the public `GET /v1/content` at boot and reads it through a
  data-access layer (`getWordsByTopic()`, `getPack()`, etc.); nothing is bundled as JSON.
- The data-access layer is abstracted so a future admin portal or CMS can manage content
  without changing UI code.
- Content updates ship as reviewed D1 migrations; the API's `ETag` and `contentVersion` make a
  stale cache detectable, and a content correction needs no app rebuild.
- **Authoring:** AI-assisted generation from a fixed prompt and the Cambridge allowlist,
  followed by full review by a Chinese-speaking English teacher. The reviewed rows are committed
  as migration SQL.
- **Validation** runs against the assembled D1 bundle. Structural rules always apply: unique
  ids, unique case-insensitive headwords, resolving references, non-empty bilingual fields,
  paired examples, levels 1–3, every served word in at least one pack, contiguous positions.
  Editorial rules apply at `dataset = 'final'`: Cambridge allowlist, abstract/emotional coverage,
  first example containing the headword, forbidden IP terms. There are no fixed topic, pack, or
  word counts.
- **Future:** a teacher/admin portal manages topics, packs, and words and owns artwork approval;
  it is not part of Mission 2. It is scoped, without detail, in the
  [Mission 3 sprint](features/00-mission-3-sprint.md).

---

## 7. Progression, Motivation & Character System

### 7.0 Character Creation

- Triggered whenever no character exists (first use or data loss — see §8.4).
- Fields: `characterName` (string), `avatar` (id from bundled `avatars[]`).
- `createdAt` is set at creation and is the origin of the dormancy clock.
- Re-customization (name, avatar) is available in Settings; it does not reset the clock.

### 7.1 Collection & Progress

- **Word Book:** every mastered word, illustrated, browseable, emotional. A tab of
  My Words.
- **Collection:** every word with status `learning` or `mastered`, countable and
  filterable. A tab of My Words.
- **Streaks:** a gentle counter.
  - A missed day pauses the streak.
  - Return within **7 days** and it continues.
  - After 7 days, the current streak ends and a new one starts; `bestStreak` is kept.
  - A Care Token can cover one missed day (§7.5).
- **Pack unlocks:** sequential by completion, as in §6.1 — the next pack opens when every word of
  the previous pack has been introduced to this user. Mastery counts do not gate packs.
- **Badges:** deferred to Phase 2.
- **Character customization:** avatar re-selection in Settings. The stage name and
  progress bar are the growth layer; the buddy portrait does not change per stage.

### 7.2 Virtual Character

**Purpose:** the character grows stronger with word practice; inactivity makes it
sleep. This is the emotional anchor of the product.

**Derived state (not stored):**

```js
// Day counts are local calendar days, matching the streak (§8.5).
const daysSince = (from, now) => {
  const a = startOfLocalDay(from);
  const b = startOfLocalDay(now);
  return Math.round((b - a) / 86_400_000); // Math.round absorbs DST shifts
};

const anchor = Math.max(createdAt, lastPracticeAt, lastWakeAt ?? 0);
const effectiveDaysIdle = Math.max(0, daysSince(anchor, Date.now()) - frozenDays);
const vitality = clamp(100 - 15 * effectiveDaysIdle, 0, 100);
const state =
  effectiveDaysIdle >= 7 ? 'sleeping' :
  effectiveDaysIdle >= 4 ? 'sleepy'   : 'awake';
const stage = stageForXp(xp); // thresholds in config (§12)
```

Using elapsed 24-hour periods instead would make a child who practices at 23:00 and
returns at 08:00 two days later look one day idle, while the streak counted two. Both
use local calendar days.

**Stored facts on the profile:**

```
characterName
avatar
xp
createdAt
lastPracticeAt
lastWakeAt
frozenDays
careTokens
sessionsSinceLastToken   // 0–5
completedSessions
streakCount
bestStreak
lastStreakDate           // local date key, e.g. '2026-10-21'
lastMonthlyReviewAt      // timestamp | null
currentTopicId
locale                   // 'en' | 'zh'
```

No stored `characterStage` or `vitality`.

**Growth model: XP drives stage; stage is the visible growth.**

- XP is a cumulative counter, earned from learning quality. It is not surfaced as a raw
  number; it appears only as stage progress.
- Stage thresholds: `Egg (0) → Hatchling (50) → Juvenile (300) → Adult (900) →
  Legendary (2000)`.
- No separate level system. Between stages, the child sees a filling progress bar.
- The chosen avatar is the character's identity; stage is a growth layer on top of it.
  Each stage currently shows the same bundled portrait because no stage art exists.

**XP sources (quality over frequency):**

| Action | XP | Rationale |
|---|---|---|
| Correct answer, first try | +2 | Rewards getting it right, not tapping |
| Correct after a hint/retry | +1 | Still progress, less reward |
| Word reaches `mastered` (first time only) | +10 | The real milestone |
| Completing a session | +5 | Keeps short sessions worthwhile |
| Opening the app / browsing / changing settings | 0 | Prevents idle farming |

Wrong answers cost nothing. Re-mastering a demoted word does not award the +10 again;
`Progress.masteryXpAwarded` prevents farming.

**Sleep rules (computed on app open, no server job):**

- The dormancy clock is anchored at `createdAt`, `lastPracticeAt`, or `lastWakeAt`,
  whichever is latest, minus any frozen days.
- **Activity means completing a session.** Opening the app, browsing, or changing
  settings does not reset `lastPracticeAt` or earn XP.
- Completing a session resets `lastPracticeAt`, restores vitality, clears `frozenDays`,
  and updates the streak.
- Day 4–5: the character shows a **sleepy** warning in-app.
- Day 7+: the character is **asleep / hibernating** (never dead).
- It can be revived by completing one short practice session (free) or by spending
  1 Care Token on a quick wake.
- No notifications; warnings are in-app only.

### 7.3 My Words (Collection + Word Book)

**Purpose:** show how much the child has earned.

- **Collection tab:** every word with status `learning` or `mastered` (`new` excluded).
  - Total count ("You've collected 47 words!")
  - Breakdown by topic/pack
  - Status counts: `learning` vs `mastered`
  - Filters: topic, status, recently learned
  - Per-word strength as a simple bar (not a number)
- **Word Book tab:** mastered-only, illustrated, browseable, emotional.
- **Word Detail:** word, IPA, tap-to-hear, image, meaning and definition in **both
  English and Chinese** regardless of UI language, example EN + ZH, strength bar,
  status badge.
- **Learned rule:** a word leaves `new` on its **first exercise attempt in a session
  that completes** — right, wrong, or revealed. Merely seeing the introduction card
  does not earn it, and an abandoned session commits nothing.
- **Demotion:** a demoted word stays in Collection, moves from the mastered tally to the
  learning tally, and leaves the Word Book. The total collected count does not decrease.
- No word is ever removed once earned.

### 7.4 Monthly Review

**Purpose:** a scheduled, comprehensive review of learned words, separate from the
daily spaced-repetition queue.

- **Trigger:** due when **at least 28 days** have passed since `lastMonthlyReviewAt`
  **and** at least 5 words are learned. If no review has ever run, the clock starts at
  the `firstSeenAt` of the **fifth learned word**, derived from `Progress` (no extra
  stored field). Not blocking; offered as a prominent card on Home.
- **Scope:** up to **20** learned words. If 5–19 words are learned, review all.
  If ≥20, select:
  1. Lowest `strength` first.
  2. Then oldest `lastSeenAt`.
  3. Add up to 3 high-strength confirmations (strength ≥ 0.8) not already selected.
  4. Fill any remainder from the oldest `lastSeenAt`.
- **Format:** reuses the five practice modes. Same encouraging tone.
- **Outcome:**
  - Each word's `strength` is updated using SM-2-lite (§9).
  - Words dropping below `strength < 0.5` are demoted (§7.6).
  - Words passing cleanly have `nextReviewAt` pushed out.
  - Summary: "You reviewed 20 words. 16 still strong, 4 want another visit."
- **Storage:** `lastMonthlyReviewAt`.
- **Session accounting:** completing a Monthly Review counts as a completed session — the same
  answer XP rules and the +5 completion bonus apply, and it updates `lastPracticeAt`, the streak,
  and the Care Token cadence. Abandoning it commits nothing.
- **Tone guardrail:** never say "you forgot X words." Use "X words want another visit."

### 7.5 Care Tokens

One token type, one currency, two spend options.

> **Care Tokens.**
>
> **Earning:** +1 Care Token per **5 completed sessions**. Cap: **3** held at any time.
> `sessionsSinceLastToken` counts 0–5. If the child is at the cap, the counter holds at
> 5 and grants the token as soon as one is spent.
>
> **Spending (two uses, same currency):**
> 1. **Freeze** — spend 1 while `state === 'awake' || 'sleepy'`. Covers **one day of
>    both** dormancy and streak:
>    - `frozenDays += 1`, extending the dormancy clock by one day.
>    - If the covered day is a missed day within the 7-day grace window,
>      `streakCount += 1` and `lastStreakDate` is set to the covered day.
>    - Not usable while sleeping; that is quick-wake's job.
> 2. **Quick wake** — spend 1 while sleeping. Sets `lastWakeAt = now` and clears
>    `frozenDays`. It does **not** change `lastPracticeAt`, XP, streak, session count,
>    monthly-review clock, or `completedSessions`.
>
> **Free revival:** completing one short practice session always revives a sleeping
> character at no token cost. Quick wake is a convenience, not a requirement.
>
> **Rationale:** both actions are "caring for the character." One currency, two choices,
> no double bookkeeping. The child learns a single resource.

### 7.6 Mastery & Decay

- **Mastered** at `strength >= 0.8` **and** `correctCount >= 3`.
- **Demoted** to `learning` at `strength < 0.5`.
- There is no `0.3` "needs practice" flag. A mastered word demotes before it could
  reach 0.3, and a learning word is already visibly learning.
- A demoted word remains in Collection (both statuses count); its badge changes from
  "mastered" to "learning again."
- Display rule: Collection shows `mastered` and `learning` counts separately; a demoted
  word moves from the mastered tally to the learning tally but does not reduce the total
  collected count.

---

## 8. Technical Architecture

> **Mission 2 supersedes §8.2–§8.7:** content and user data move from Dexie to D1 behind a
> Cloudflare Worker, and the app becomes online-required. See the
> [Mission 2 sprint](features/00-mission-2-sprint.md) and features 22–24. Feature 25 rewrites
> these sections into PRD v0.3.

### 8.1 Stack

| Layer | Choice |
|-------|--------|
| App type | PWA (installable, offline-capable) |
| Framework | React 19 + Vite 8 + TypeScript + Tailwind CSS 4 (promoted from `figma/`) |
| Storage | IndexedDB via **Dexie.js 4** |
| Content | Bundled read-only JSON behind a data-access layer |
| Pronunciation | **Web Speech API** + IPA fallback |
| Routing | Hash routes (`#/home`, `#/practice`, …) |
| Hosting | Cloudflare Pages |
| Sync | None |
| Backend | None |

### 8.2 Storage Rules

- **Do not** use localStorage for progress or profiles.
- localStorage may hold only trivial UI config; the locale lives on the profile.
- **Do not** use SQLite/WA-SQLite.
- Word content is bundled; only profiles, progress, metrics, and device state are
  persisted in IndexedDB.

### 8.3 Dexie Schema

```js
const db = new Dexie('WordsWizardDB');
db.version(1).stores({
  profiles: '++id, name, createdAt',
  progress: '++id, profileId, wordId, status, nextReviewAt, &[profileId+wordId]',
  metrics: '++id, profileId, name, updatedAt',
  device: 'key', // device-level key/value: install status, persist result, counters
});
```

**Profile record:**

```ts
Profile {
  id?: number
  name: string
  characterName: string
  avatar: string
  currentTopicId: string | null // null until the topic picker completes
  xp: number
  createdAt: number
  lastPracticeAt: number        // set to createdAt at character creation
  lastWakeAt: number | null
  frozenDays: number
  careTokens: number
  sessionsSinceLastToken: number
  completedSessions: number
  streakCount: number
  bestStreak: number
  lastStreakDate: string | null
  lastMonthlyReviewAt: number | null
  locale: 'en' | 'zh'
}
```

**Progress record:**

```ts
Progress {
  id?: number
  profileId: number
  wordId: string
  status: 'new' | 'learning' | 'mastered'
  strength: number          // 0–1, drives spacing
  nextReviewAt: number      // timestamp
  correctCount: number
  wrongCount: number
  firstSeenAt: number
  lastSeenAt: number
  masteryXpAwarded: boolean // prevents re-awarding the +10 mastery XP
}
```

One row per `profileId` + `wordId`, enforced by the unique compound index.

The Settings screen edits `Profile.locale`, `Profile.characterName`, and
`Profile.avatar`. Install-prompt dismissal is per-session UI state and is not persisted.

**Device record (not profile-scoped):**

```ts
Device {
  key: string
  value: unknown
}
```

Keys include `installed`, `storagePersisted`, `speechAvailable`,
`profileAbsentAtBoot`, and `lastBootAt`.

**Local metrics (per profile):** session starts/completions/abandons, words learned and
mastered, Collection/Word Book opens, Monthly Reviews offered/completed, revivals
(session vs token), stage-ups, and speech-unavailable events.

### 8.4 Startup Data Check

On boot, check for a profile with a character.

- **Present:** normal flow.
- **Absent:** route to Character Creation. The same copy covers first use and data loss
  ("Let's make a new friend!"). If the app is running installed, increment
  `profileAbsentAtBoot`; there is no network reporting.
- Call `navigator.storage.persist()` on first launch and record the result in `device`.
- A light post-session check verifies the profile still exists. If lost, show the
  graceful recovery entry point rather than a blank or broken screen.

### 8.5 Persistence & Data Safety (PWA-primary)

**The installed-PWA context is the primary scenario and the foundation of data
durability.**

- **Safari's 7-day storage eviction does not apply to PWAs added to the Home Screen.**
  WebKit exempts Home Screen web apps: they have their own usage-day counter, which
  resets with actual app use. The 7-day cap applies to Safari tabs only.
- **"Add to Home Screen" is a strong onboarding prompt, not a hard gate.** The app shows
  a prominent install card after character creation with platform-specific steps,
  explains that a Safari tab can lose progress after a week, allows dismissal once per
  session, and re-shows it each session until installed. Practice is never blocked.
- Installed status is detected with
  `matchMedia('(display-mode: standalone)')` or `navigator.standalone` (iOS). If
  detection is unreliable, the prompt errs toward showing.
- `navigator.storage.persist()` is called on first launch and the result recorded. It is
  a supporting defense against system storage pressure, not the primary protection.
- Edge (desktop/Android) is Chromium-based: ample quota; eviction only under extreme
  disk pressure.
- Clock tampering and timezone changes are accepted: the app trusts the device clock.
- Day boundaries use the device's local calendar day.
- **Export Progress (JSON)** in Settings is an optional facilitator tool for device
  migration and manual backup. Import is Phase 3.

### 8.6 Platform Notes

- **iPad Safari (installed PWA):** primary target. IndexedDB supported; Home Screen web
  app exempt from 7-day eviction; `persist()` best-effort. Web Speech voices vary by
  device; use tap-to-hear and IPA fallback.
- **iPad Safari (browser tab):** supported for trial use, but subject to 7-day eviction.
  The app detects this context and prompts installation.
- **Edge (desktop/Android):** full IndexedDB and PWA support; primary development and
  debugging target.

### 8.7 Offline Updates & Service Worker

- Precache the app shell, bundled JSON, locales, and **all illustrations**
  (~300 word images + 8 buddy portraits).
- Image target: **WebP, ~512 px, ~20–40 KB each**, roughly 10–15 MB total. Measure first
  load on an iPad.
- Content and app updates ship as version bumps. A new service worker **does not**
  silently `skipWaiting`; the app shows "A new pack is ready!" and refreshes on
  confirmation.
- The app must remain fully functional offline at all times after first load; no runtime
  fetch of content or images. Pronunciation uses the browser's speech engine: local
  voices work offline, and IPA plus a non-audio mode cover devices without one.

### 8.8 Internationalization

- UI strings live in `locales/en.json` and `locales/zh.json`. A test asserts key
  completeness between the two files.
- Default locale: `navigator.language` starting with `zh` → `zh`; otherwise `en`.
  Stored per profile and editable in Settings.
- Word content uses `definitionEn` / `definitionZh` and paired examples. The
  introduction card and Word Detail show both language versions of the meaning and
  definition; the example follows the UI language, and Word Detail shows both example
  languages.
- **Bilingual meaning rule:** meaning and definition are never hidden by the UI
  language. This applies to the learning card and Word Detail (feature 20), replacing
  feature 19's English-only detail rule.
- Audio: English words use an English voice; Chinese UI read-aloud uses a Chinese voice.
- Chinese font: system CJK fallback stack; do not bundle a font in v1.

### 8.9 Hosting & Deployment

- **Cloudflare Pages (Free plan)**, deployed from GitHub Actions with Wrangler direct
  upload. The app builds to `src/dist/`; that directory is the deployment root and contains
  `index.html`, `_headers`, and the hashed assets.
- Hash routing means every route is a fragment (`#/home`), so `index.html` is the only
  document the server ever returns. No SPA rewrite or `_redirects` file is used; a request
  for a missing file returns a real 404.
- `_headers` (shipped from `src/public/`) carries the cache policy: hashed `assets/*`
  immutable for a year, artwork and icons for 7 days, locale JSON for 1 hour, and
  `index.html`, the service worker, and the manifest `no-cache`.
- HTTPS is available on the default `*.pages.dev` endpoint. Custom domains are attached to
  the Pages project with automatic TLS — no separate CDN configuration is required.
- **CI (GitHub Actions):** pull requests run install, typecheck, tests, content validation,
  build, and a dist check. Pushes to `master` run the same checks and then deploy the
  prebuilt `src/dist/` with `wrangler pages deploy`.
- The API token and account id live in GitHub Actions secrets; no credential is committed.
  Rollback is a Cloudflare deployment rollback, or re-running the deployment workflow on an
  older commit.

---

## 9. Spaced Repetition

- Not surfaced to the child by name.
- Incorrect words resurface sooner; mastered words resurface occasionally.
- The **Monthly Review** is the surfaced review, not homework. The daily plan
  carries no review entries.

**Scheduler (SM-2-lite):**

- On correct: `strength += 0.2` (cap 1.0).
- On wrong: `strength -= 0.3` (floor 0).
- `nextReviewAt = now + intervalDays(strength)`, where `intervalDays` maps strength to
  **1 / 2 / 4 / 7 / 14 / 30 days**.
- Status becomes `mastered` at `strength >= 0.8` **and** `correctCount >= 3`.
- Status reverts to `learning` at `strength < 0.5`.

**Daily session builder:**

- Up to `newWords` (5) **unintroduced** words, in `position` order, from the first unlocked pack
  in the selected topic that still has any; the daily plan contains no review entries. A pack
  larger than five spans several days.
- A pack is introduced in order: the first pack is always unlocked; the next unlocks when every
  word of the previous pack has an introduction row for this user. Unlock is computed on the
  client from the introductions returned by `/v1/me`.
- Dedupe by `wordId` within a pack; the same headword may still be introduced again in another
  pack, because introduction is per pack.
- A committed session writes an introduction for each new `(packId, wordId)` pair. If the user
  introduced words in this pack today, the builder returns those words as **repeat** entries
  instead of new ones, so the same five can be practised again until the next local day. They
  carry no introduction card. If today's words are in another pack or topic, the day is **all
  caught up**.
- Mode assignment: the spelling builder for each new or repeat entry, then one random
  non-spelling mode per word in a shuffled comprehensive block; deterministic per
  session. The result aggregates both attempts under the word's single row.

**Monthly Review builder:** separate; up to 20 learned words, selected per §7.4.

---

## 10. Accessibility & Age-Appropriateness

- Large touch targets; clear fonts; high contrast; works on tablets.
- **Read-aloud everywhere:** UI text and word audio use Web Speech, with Chinese and
  English voices.
- IPA is shown whenever audio is unavailable.
- Semantic HTML and labels remain the fallback for screen readers when no voice exists.
- Minimal reading-heavy screens; lean on image, audio, and interaction.
- Short sessions; no punishing default timers.
- Encouraging tone throughout; never punitive language.
- Bilingual UI reduces comprehension barriers.
- Animations respect `prefers-reduced-motion`.

---

## 11. Facilitator (Parent/Teacher) Features

Kept small and optional; not the default experience.

**MVP:**
- **JSON export** for backup and device migration.
- **Diagnostics view:** install status, `persist()` result, storage estimate, and local
  counters.

**Phase 2:**
- Tricky Words view for the child.

**Phase 3:**
- Focus list, mute/skip a word, custom words, import.

No parent accounts, remote dashboard, or notifications in v1.

---

## 12. Extensibility & Configuration

- Practice modes are **pluggable exercise modules**.
- The content model supports future phrases/sentences (`examples`, `tags`,
  `partOfSpeech`, paired translations).
- Progress data is separated from UI so new features reuse it.
- Topic/pack groupings live in data, not code.
- **Built-in avatars live in bundled data (`avatars[]`), not code.**
- Storage is accessed through a `ProgressProvider` interface so a future cloud sync can
  replace Dexie without touching UI code.
- All tunables live in a single config module:

```ts
export const config = {
  xp: { firstTry: 2, afterHint: 1, mastered: 10, sessionComplete: 5 },
  stages: [
    { id: 'egg', minXp: 0 },
    { id: 'hatchling', minXp: 50 },
    { id: 'juvenile', minXp: 300 },
    { id: 'adult', minXp: 900 },
    { id: 'legendary', minXp: 2000 },
  ],
  dormancy: { sleepyDay: 4, sleepDay: 7, vitalityPerDay: 15 },
  streak: { graceDays: 7, tokenCoversDays: 1 },
  careTokens: { sessionsPerToken: 5, cap: 3 },
  session: {
    newWords: 5,
    newWordModes: ['spellingBuilder'],
    secondsPerScreen: 25,
  },
  scheduler: {
    correctDelta: 0.2,
    wrongDelta: -0.3,
    masteredStrength: 0.8,
    masteredCorrect: 3,
    demoteStrength: 0.5,
    intervals: [1, 2, 4, 7, 14, 30],
  },
  monthlyReview: {
    intervalDays: 28,
    minLearned: 5,
    cap: 20,
    highStrengthConfirmations: 3,
  },
  speech: { rate: 0.85, pitch: 1.0 },
};
```

---

## 13. Phased Delivery

| Phase | Scope |
|-------|-------|
| **MVP** | Character creation gate; strong install prompt; topics and day-sized packs with no fixed counts; bilingual content and UI; all 5 practice modes; per-pack word introductions; escalating hints; Collection + Word Book tabs; streaks with 7-day grace; derived character with XP/stage and sleep/wake; Care Tokens (freeze and quick wake); SM-2-lite and daily session builder; Monthly Review (28 days, cap 20); D1 content and user storage; Web Speech + IPA fallback; word images (R2 URL) with emoji fallback and 8 buddy portraits; JSON export; per-user metrics and diagnostics; Cloudflare Pages and Worker hosting; hash routing; Vitest domain, model, database, and host tiers. |
| **Phase 2** | Badges; multi-profile switcher UI; Tricky Words; additional topics/packs; richer stage animations; spaced-repetition refinements; notification-free reminders. |
| **Phase 3** | Facilitator panel (focus list, custom words, import); story mode; timed challenges; speaking practice; phrases and sentences; native packaging. |
| **Future** | Co-op/team mode; parent dashboard (requires a backend); cloud sync. |

---

## 14. Decision Log (resolves v0.1 §14)

| # | Question | Resolution |
|---|---|---|
| 1 | Character stakes | Sleep + free revival; never dead. |
| 2 | Care Token cadence | +1 per 5 completed sessions, cap 3; freeze and quick wake. |
| 3 | Session length | 5 new words (intro + spelling) + one comprehensive exercise per word = 5 unique words / 15 screens, about 10 min. The daily review block is withdrawn. Supersedes feature 18's 10-new / 65-screen shape in feature 20. |
| 4 | Word audio | Web Speech API + IPA fallback; no bundled audio. |
| 5 | Topic count | Superseded by decision 18: topics are the offline categories, and packs have no fixed size or count. |
| 6 | ESL support | Bilingual EN + 中文, full UI and content; toggle; zh default on zh-CN. |
| 7 | iPad onboarding | Strong, repeated install prompt; never a hard gate. |
| 8 | Never-practiced dormancy | In-app only; no notifications. |
| 9 | Avatar set and stage art | 8 buddy portraits (filename = character name); each stage maps to the portrait. Replaced the 3 × 5 stage set in feature 19; Radahn and Warden added 2026-10-27. |
| 10 | XP tuning | First-try 2, hint 1, mastery 10, session 5; 50/300/900/2000. |
| 11 | Monthly Review cadence | Rolling 28 days; ≥5 learned; cap 20. |
| 12 | Mastery demotion | Strength < 0.5. |
| 13 | Repository visibility | Child-facing; facilitator sees export and diagnostics only. |
| 14 | Multi-profile | Single-profile UI; `profileId` retained in schema. |
| 15 | Streak reset | 7-day grace; token covers one missed day; best streak kept. |
| 16 | Word Detail language | Meaning and definition appear in both English and Chinese; surrounding labels follow the UI language. Feature 20 reverses feature 19's English-only detail. |
| 17 | Daily word limit | One five-word set introduced per local day **per pack**; after it commits, the same five can be practised again until midnight, but no new words from that pack. A pack larger than five continues on later days. Feature 20; per-pack scope in decision 18. |
| 18 | Vocabulary model (Mission 2, 2026-10-29) | Four D1 tables (`topics`, `packs`, `words`, `pack_words`); one row per headword; a word may belong to packs of several topics and is introduced anew per pack; sequential pack unlock when the previous pack is fully introduced; soft delete via `archivedAt`; no fixed counts; `image` is a URL (R2 later) with `emoji` fallback. Replaces the bundled JSON and 20-slot shape. |

**Additional v0.2 decisions:**

- Stage and vitality are derived; no stored duplicates.
- Learned status begins on the first exercise attempt in a session that completes.
- Progress commits at session end; confirm-on-exit; browser-kill loss accepted.
- All five practice modes ship.
- One My Words screen with Collection and Word Book tabs.
- Hash routing; Cloudflare Pages hosting.
- Local counters only; no telemetry.
- Vitest domain and content validation; manual E2E.
- Flat bilingual word schema.
- Content is AI-assisted and teacher-reviewed.

---

## 15. Success Metrics (local-only)

The no-backend, no-telemetry design means aggregate rates cannot be computed centrally.
The MVP records per-device counters and exports them; product decisions rely on moderated
testing and exported evidence.

| Local counter | What it tells you |
|---|---|
| Session starts / completions / abandons | Loop completion and mid-session drop-off. |
| Install status and `persist()` result | Durability risk on the device. |
| Words learned / mastered per week | Progression pace. |
| Stage-ups and days-to-stage | Whether the XP curve fits. |
| Collection and Word Book opens | Whether "seeing what you earned" motivates. |
| Monthly Reviews offered / completed | Checkpoint engagement. |
| Strength delta after Monthly Review | Whether the review catches decay in time. |
| Revivals (session vs quick wake) | Dormancy recovery rate. |
| Profile absent at boot (installed only) | Abnormal data loss. |
| Speech unavailable | Web Speech coverage on real devices. |

**Not measurable in v1:** global install rate, retention cohorts, cross-device metrics,
or class/teacher reporting.

---

## Appendix A — Screen Inventory & Navigation

### A.1 Screen list

| # | Screen | Purpose | Entry points | Phase |
|---|--------|---------|--------------|-------|
| 1 | **Character Creation** | Name + avatar | No profile at boot | MVP |
| 2 | **Install Prompt** | Add to Home Screen | After creation; each boot until installed | MVP |
| 3 | **Topic Picker** | Choose a topic | After install; Home "change topic" | MVP |
| 4 | **Home** | Hub: character, streak, today's session, cards | After setup / boot | MVP |
| 5 | **Session Intro** | Preview of today's session | Home "Practice" | MVP |
| 6 | **Word Introduction** | Card: word, IPA, audio, image, bilingual meaning/example | Within session | MVP |
| 7 | **Practice Exercise** | One of the five exercise modules | Within session | MVP |
| 8 | **Feedback** | Encouraging overlay + hint | After each answer | MVP |
| 9 | **Session Summary** | XP, words practiced, stage progress, streak | End of session | MVP |
| 10 | **My Words — Collection** | Learned-word count, filters, per-word detail | Home card | MVP |
| 11 | **My Words — Word Book** | Illustrated, mastered-only, browseable | My Words tab | MVP |
| 12 | **Word Detail** | Word, IPA, audio, image, definitions, example, strength | Collection / Word Book | MVP |
| 13 | **Character Screen** | Avatar, stage, stage progress, vitality, Care Tokens | Home avatar tap | MVP |
| 14 | **Sleepy / Sleeping** | Gentle wake screen + how to wake | Auto when `state !== 'awake'` | MVP |
| 15 | **Monthly Review Intro** | "20 words want a visit" | Home card, when due | MVP |
| 16 | **Monthly Review Summary** | Strong vs needs-a-look counts | End of Monthly Review | MVP |
| 17 | **Settings** | Locale toggle, re-customize, export, install status, diagnostics | Home gear | MVP |
| 18 | **Tricky Words** | Auto-populated from mistakes | Home card or Settings | Phase 2 |
| 19 | **Facilitator Panel** | Focus list, custom words, import | Settings (gated) | Phase 3 |

There is no profile switcher in v1.

### A.2 Navigation model

```
Boot
 └─ profile exists? ──no──> [1] Character Creation ──> [2] Install Prompt
                    │                                      └──> [3] Topic Picker ──> [4] Home
                    └─yes─> [4] Home

#/home ──> #/topics
        ──> #/session ──> #/session/intro ──> #/session/exercise ⇄ feedback
                                                 └──> #/session/summary ──> #/home
        ──> #/words?tab=collection | #/words?tab=wordbook ──> #/words/:wordId ──> back
        ──> #/character
        ──> #/review (when due) ──> #/review/summary
        ──> #/settings ──> export / diagnostics / re-customize / locale
```

Hash routes only; no server rewrite.

### A.3 Empty states

| Screen | Empty state | Copy | Behavior |
|--------|-------------|------|----------|
| Collection | 0 learned words | "Your word collection is waiting! Practice to add your first word." | CTA → start session |
| Collection | 1–4 words | "You've collected X words. Keep going!" | Show list |
| Word Book | 0 mastered | "Mastered words appear here." | CTA → session |
| Monthly Review | <5 learned | Card hidden | Do not offer |
| Monthly Review | 5–19 learned | "Time for a monthly check-in!" | Review all, cap 20 |
| Monthly Review | ≥20 learned | "Time for a monthly check-in!" | 20-word sample per §7.4 |
| Session | Today's five already learned | "Practice again" | Replay the same five words |
| Session | No new words left in the topic | "You're all caught up!" | CTA → My Words or change topic |
| Speech | No English voice | "Listen is unavailable on this device." | Show IPA; substitute a non-audio mode |
| Tricky Words (P2) | 0 | "No tricky words yet — nice!" | — |

### A.4 Modal / blocking rules

- **[1] Character Creation** — blocking; no way past without creating.
- **[2] Install Prompt** — prominent; dismissible once per session; re-shown each
  session until installed; never blocks practice.
- **[14] Sleepy / Sleeping** — overlay card on Home; does not block practice; the wake
  path is always visible.
- **Monthly Review** — never blocking; a card the child can ignore.
- **Mid-session exit** — confirmation; confirming discards the session.
