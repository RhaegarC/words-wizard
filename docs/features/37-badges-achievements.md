# Feature 37 — Badges and Achievements

> Priority: Must · Mission 4 · **Status: Implemented**
> Depends on: existing profile and metric counters (features 09, 23); 35 for the topic trophies;
> 34 for the session-summary strip. Blocks: none.
> Source of truth: [Mission 4 sprint](00-mission-4-sprint.md).

## Summary

Add a badge layer that turns progress the app already records into visible milestones: 15 medals
across five categories and one trophy for each completed topic. Badges are **derived**, not stored:
a pure function reads monotonic counters and the topic completion state, so there is no table, no
migration, and no earned-date bookkeeping.

The Home screen gains a badge card and a dedicated Badges screen groups the catalogue by category.
Session and exam summaries show any badge that was newly earned by that result.

## User story

As a **child**, I want to see medals for the words I have learned and the streaks I have kept, and a
trophy for each topic I have truly finished, so my effort has a shelf to sit on. As a **parent**, I
want these to reflect real progress without adding another currency or a second level system.

## Design

### Principles

- **Built on existing progression.** XP, stages, streaks, completed sessions, cumulative word
  counters and topic completion are the facts. There is no badge currency and no second level.
- **Derived, not stored.** `deriveBadges(facts)` returns the unlocked set. There is no
  `achievements` table, no earned timestamp, and no "seen" state.
- **Monotonic facts only.** Every fact can only stay the same or grow: cumulative metric counters,
  `bestStreak`, `completedSessions`, and sticky topic completion. A badge therefore cannot
  un-earn. A new topic adds a trophy; it never re-locks an existing one.
- **No dates.** "Latest" is a deterministic presentation choice, defined below, not a chronology.

### Catalogue — 20 badges

Fifteen medals: five categories, each with bronze / silver / gold tiers.

| Category | Bronze | Silver | Gold | Fact |
|---|---|---|---|---|
| **Collection** | 10 words | 50 words | 100 words | cumulative `word.learned` |
| **Mastery** | 1 word | 10 words | 50 words | cumulative `word.mastered` |
| **Streak** | 3 days | 7 days | 30 days | `profile.bestStreak` |
| **Sessions** | 10 | 50 | 100 | `profile.completedSessions` |
| **Reviews** | 1 | 5 | 12 | cumulative `monthlyReview.completed` |

Five trophies, one per topic (the current content set):

| Trophy | Unlock |
|---|---|
| One per topic, named for that topic | That topic's `topic_exam_progress.completed_at` is set |

- The `word.mastered` counter is cumulative first-mastery events; `masteryXpAwarded` prevents a
  re-mastered word from counting twice. A demotion therefore does not remove a Mastery medal.
- The Review medal counts completed Monthly Reviews; 12 is a year of monthly check-ins.
- A topic trophy is per topic, not "all topics", so a future topic produces a new trophy instead
  of re-locking an earned one.
- A completed topic keeps its trophy if the topic is later archived. The catalogue resolves the
  trophy's name from content when the topic is live and falls back to a generic completed-topic
  title otherwise; the persisted completion, not the live topic list, is what keeps it earned.

### Facts and derivation

A shared `src/shared/badges.ts` module owns:

```ts
interface BadgeFacts {
  wordsLearned: number       // cumulative word.learned
  wordsMastered: number      // cumulative word.mastered
  bestStreak: number
  completedSessions: number
  monthlyReviews: number     // cumulative monthlyReview.completed
  completedTopicIds: readonly string[]
}
```

- `BADGE_DEFINITIONS` is a static readonly array: id, category, tier (`bronze|silver|gold` or
  `trophy`), threshold (or `null` for a topic trophy), and the fact it reads.
- `deriveBadges(facts)` returns the unlocked ids in catalogue order.
- `newlyEarned(before, after)` is the set difference, in catalogue order.
- **Featured badge** (the Home card's "latest"): the highest-tier unlocked medal, tie-broken by
  catalogue order; if no medal is unlocked, the first unlocked trophy. This is deterministic
  without dates.
- **Next goal:** among locked badges, the smallest remaining amount (`threshold - fact`; a locked
  trophy is 1 remaining), tie-broken by catalogue order. The Home card shows it with its progress.

### Surfaces

- **Home card:** the featured badge and the next goal, opening `#/badges`. When nothing is unlocked,
  the card invites the first session rather than showing an empty shelf.
- **Badges screen (`#/badges`):** grouped by category; medals in bronze → silver → gold order with
  locked/unlocked treatment and progress toward the next tier; a separate trophy row for topics,
  with completed topics highlighted and live topics shown locked.
- **Session summary:** compute `before` from the pre-commit facts and `after` from the commit
  response; show a "New badge" strip for anything in `newlyEarned`.
- **Exam summary:** the same strip, using the pre-submit facts and the exam response's updated
  completion state and metrics.
- **Reload limitation:** because nothing is persisted, reloading a summary does not re-show "new";
  the badge remains on the Badges screen. This is accepted in exchange for no table, no migration
  and no earned-date lifecycle.
- Add the `badges.*` and `common.screen.badges` i18n namespaces to both locales; the badge names and
  descriptions follow the UI language.
- Add `#/badges` to every exhaustive route record; `parentOf` returns Home, and the screen is not a
  nav item (it opens from the Home card).

## Acceptance criteria

- [x] The catalogue contains exactly 15 medals and one trophy per live topic (five today — 20
      badges in the current content set) with the thresholds in the table above.
- [x] A badge unlocks at its threshold (`10` unlocks bronze Collection, `9` does not) and never
      re-locks when a word is demoted, a streak ends, or a topic is retaken.
- [x] Adding a topic adds a locked trophy and does not re-lock any earned trophy.
- [x] Badges are derived on read: no achievements table, migration, earned date or seen state.
- [x] The Home card shows the featured badge and the next goal and opens the Badges screen.
- [x] The Badges screen groups medals by category and shows one trophy per topic.
- [x] A session or exam that crosses a threshold shows the newly earned badge(s) once.
- [x] The featured and next-goal rules are deterministic and covered by tests.
- [x] Both locales cover every badge name and description.

## Test plan

- **Unit** — every threshold at `n-1`, `n` and `n+1`; monotonicity across demotion, streak reset
  and content growth; per-topic trophy derivation; featured/next-goal tie-breaks; `newlyEarned` set
  differences and ordering.
- **Page** — the catalogue helper's live and archived trophies, localized copy, route round-trip
  and locale completeness. The page tier has no DOM renderer, so card and strip markup is not
  component-tested.
- **Host / integration** — a session commit that crosses a Collection or Mastery threshold produces
  the new badge from the response facts; a passed exam produces the topic trophy.
- **Manual** — unlock a medal and a topic trophy, confirm the Home card, the screen and the
  summary strip, then reload and confirm the badge persists on the screen without a "new" flag.

## Implementation notes

- `src/shared/badges.ts` owns the catalogue, derivation, progress, featured and next-goal rules and
  the two fact transitions. `MEDAL_DEFINITIONS` is the static fifteen; `buildBadgeCatalogue(topicIds)`
  appends one trophy per topic.
- `src/page/api/badgeFacts.ts` reads `getMetrics` (answered from the cached `/v1/me` snapshot) and
  `getExams()` together and folds them through `badgeFacts`.
- `SessionProvider` starts that read *before* the commit and, only on a saved outcome, derives
  `newlyEarned(before, factsAfterSession(before, payload))`. A queued commit has not reached the
  server, so it shows no badge.
- `ExamProvider` reads the shelf once when the exam opens and derives the trophy from the submit
  response's `state.completedAt`. A retake leaves the fact set unchanged and therefore shows nothing.
- The Home card uses `featuredBadge`/`nextGoal`; `#/badges` renders the five medal categories and
  then the trophy group. A trophy's copy comes from content while the topic is live and from the
  generic archived copy otherwise.

## Verification

2026-11-19 — `pnpm test`: 88 files passed, 1 skipped; 1178 tests passed, 5 skipped (the
credential-gated remote tier). `pnpm typecheck`, `pnpm build` and `pnpm check:dist` passed.

New coverage: `shared/test/badges.test.ts` (every threshold at `n-1`/`n`/`n+1` across the five
facts, catalogue and trophy ids, monotonicity, featured and next-goal tie-breaks, `newlyEarned`,
both fact transitions); `page/test/domain/badges.test.ts` (every medal and category key present in
both locales); `page/test/domain/badgeView.test.ts` (live and archived trophy copy, id lookup);
`worker/test/badges.test.ts` (a real session commit crossing Collection and Mastery, and a passed
exam completing a topic, against a real Worker and D1). The route and i18n tests were extended for
`#/badges`.

The Home card, Badges screen and summary strips are built from those tested helpers and pass
`typecheck`/`build`, but the page tier has no DOM renderer, so they carry no component test. The
manual check remains: unlock a medal and a trophy, confirm the card, screen and strip, then reload
and confirm the badges persist on the screen without the "new" strip.

## Documentation impact

PRD §2 (non-goals), §7.1, §7.9 (new), §13, §14, §15 and Appendix A; README; privacy (badges are
derived from data already stored and add no new personal data); the summary and Home screens when
the feature lands.

## Risks

- **No earned dates.** The featured badge is a highest-tier choice, not "most recent". The documentation
  and copy must not imply chronology.
- **No history.** A badge unearned by a rules change (for example, lowering a threshold in code)
  would silently appear; the monotonic fact set keeps the normal lifecycle stable, but catalogue
  edits must be treated as product changes.
- **Cumulative counters.** Using `word.learned` and `word.mastered` rather than the current
  Collection/Mastery counts is what makes the badges monotonic; queries must not substitute a live
  count.
- **Content growth.** Per-topic trophies are intentionally additive; an "all topics" badge would
  break the no-un-earn rule and is not in the catalogue.

## Out of scope

An achievements table or earned dates; a separate points currency; a second level system;
notifications; leaderboards or sharing; hidden/secret badges; badge artwork beyond the existing icon
language; teacher or parent badge views.
