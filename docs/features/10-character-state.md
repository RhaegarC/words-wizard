# Feature 10 — Character State & Character Screen

> Priority: Must · Mission 1 · **Status: In progress — implemented, pending merge**
> Depends on: 04, 05, 09

## Summary

The buddy is the emotional anchor. It has **no stored stage and no stored vitality**: both are
computed from `xp`, the last activity timestamp, and `frozenDays` every time the app renders. This
feature builds that derivation, the character screen, the sleepy/sleeping overlay, and the two ways
to spend a Care Token.

A sleeping character is never dead. It is revived free by completing a session, or immediately with
one token.

## User story

As a **child**, my buddy looks bigger as I learn and sleepy when I have been away, and I can always
wake it. As a **parent**, the app never punishes a child for missing a week.

## Acceptance criteria

- [x] `deriveCharacterState(profile, now)` returns `{ effectiveDaysIdle, vitality, state, stage }`
      with no reads or writes; it is the only source of those values.
- [x] Day counts use **local calendar days** (`startOfLocalDay` + rounded day difference), matching
      the streak, including across a DST change.
- [x] `anchor = max(createdAt, lastPracticeAt, lastWakeAt ?? 0)`;
      `effectiveDaysIdle = max(0, daysSince(anchor, now) - frozenDays)`.
- [x] `vitality = clamp(100 - 15 × effectiveDaysIdle, 0, 100)`.
- [x] State: `effectiveDaysIdle >= 7` → `sleeping`; `>= 4` → `sleepy`; otherwise `awake`.
- [x] Stage: `Egg 0`, `Hatchling 50`, `Juvenile 300`, `Adult 900`, `Legendary 2000`, derived from XP.
- [x] The character screen shows the avatar at its stage, stage progress, vitality bar, state, Care
      Token count, and the two spend options when legal.
- [x] Stage art resolves `avatar × stage` from `content/avatars.json`; a missing asset renders the
      styled placeholder, never a broken image.
- [x] **Sleepy / Sleeping overlay** appears on Home when `state !== 'awake'`: in-app only, never
      blocking practice, with both wake paths visible ("Practice to wake" and "Use a Care Token").
- [x] **Freeze** — allowed only when `awake` or `sleepy`; costs 1 token; `frozenDays += 1`; extends
      dormancy by one day. If the most recent missed day sits within the 7-day streak grace, it also
      counts as a streak day: `streakCount += 1` and `lastStreakDate = coveredDay`. If the child
      practiced today, there is no missed day and the streak is unchanged.
- [x] **Quick wake** — allowed only when `sleeping`; costs 1 token; sets `lastWakeAt = now` and
      `frozenDays = 0`. It does **not** change `lastPracticeAt`, XP, streak, session count,
      monthly-review clock, or `completedSessions`.
- [x] Spending the last token, spending with zero tokens, and spending while `sleeping` (freeze) are
      all rejected with a typed reason and no state change.
- [x] At the token cap with `sessionsSinceLastToken === 5`, spending immediately re-grants the queued
      token (net 3, counter 0), per PRD §7.5.
- [x] Free revival: completing any session sets `lastPracticeAt`, which clears the sleep state at the
      next render; no token is consumed.
- [x] All copy is bilingual and encouraging; the sleeping state never uses "dead", "lost", or
      "punish" language.

## Tasks (ordered)

1. Add `src/domain/time.ts`: `startOfLocalDay`, `localDateKey`, `daysSinceLocal`, DST-safe rounding.
2. Implement `deriveCharacterState(profile, now)` and `deriveVitality(days)` as pure functions.
3. Reuse `deriveStage`/`stageProgress` from feature 09; do not create a second threshold table.
4. Implement `canFreeze(profile, now)` and `canQuickWake(profile, now)`.
5. Implement `spendOnFreeze(profile, now)` and `spendOnQuickWake(profile, now)` — pure profile
   transforms, including the covered-day rule and the queued-token grant.
6. Build the Character screen: avatar, stage, stage progress, vitality, tokens, state, actions.
7. Build the sleepy/sleeping overlay component with both wake paths.
8. Resolve stage art through `getAvatarSet()`; add the placeholder fallback.
9. Wire the overlay into Home (feature 11 mounts it; the component lands here).
10. Persist a freeze/wake as a profile update through feature 05; metric `revival` with source
    `session` or `token`.
11. Add i18n keys for states, actions, and the "never dead" copy.

## Tests

**Unit (Vitest, time tests run with a non-UTC `TZ`):**

- `daysSinceLocal` — same day 00:01 vs 23:59 → 0; next local day → 1; a 23:00 → 08:00 two-days-later
  case → 2; DST spring-forward and fall-back days round correctly.
- `deriveCharacterState` — day 0/3/4/6/7/30; vitality 100/55/40/0; frozenDays shifts the count by
  exactly the frozen days, never below 0.
- `deriveStage`/`stageProgress` — boundaries and progress fraction.
- `canFreeze` — awake/sleepy yes, sleeping no, no tokens no.
- `canQuickWake` — sleeping yes, awake/sleepy no, no tokens no.
- `spendOnFreeze` — token −1, frozenDays +1; covered missed day within grace → streak +1 and
  `lastStreakDate = coveredDay`; practiced-today → streak unchanged; gap > 7 → streak unchanged;
  zero tokens → rejected.
- `spendOnQuickWake` — `lastWakeAt` set, `frozenDays` cleared, everything else byte-identical;
  awake → rejected.
- Queued token — cap 3 + counter 5 → spend → 3 tokens, counter 0.

**Verification (manual):**

- Create a profile, set the device clock forward 4 days → sleepy overlay; 7 days → sleeping.
- Complete a session → awake again, no token spent.
- Quick wake → awake, token spent, streak unchanged.
- Freeze on a missed day → dormancy extended; streak increments once.
- Stage art changes at 50/300/900/2000 XP.

## Non-goals

- No notifications, push, or background jobs.
- No death, decay to zero permanence, or lost words.
- No character animation beyond the stage art and reduced-motion-safe transitions.
