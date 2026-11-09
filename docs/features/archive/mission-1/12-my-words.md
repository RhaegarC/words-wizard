# Feature 12 — My Words: Collection & Word Book

> Priority: Must · Mission 1 · **Status: Done — merged in PR #27**
> Depends on: 04, 05, 08, 09

## Summary

One destination, two tabs. **Collection** is the countable record of everything learned and a place
to filter it. **Word Book** is the mastered-only, illustrated, browseable reward. A shared Word
Detail screen serves both.

Progress is keyed by `wordId`, so a word shared across topics carries one strength and appears once.

## User story

As a **child**, I can see how many words I have collected and browse the ones I have mastered. As a
**child who just lost a mastered badge**, the word stays in my collection and I can see it needs
another visit — it is not taken away.

## Acceptance criteria

- [x] `#/words?tab=collection` is the default; `?tab=wordbook` opens the second tab; the tab is part
      of the URL so back/forward and reloads land on the same tab.
- [x] Collection shows every word with `status` `learning` or `mastered`; words with no progress row
      are excluded.
- [x] Collection header shows the total ("You've collected 47 words!") and separate `learning` /
      `mastered` counts.
- [x] Filters: topic, status, recently learned (last 7 days). Filters combine and are clearable.
- [x] Each collection row shows the illustration (or placeholder), the word, the meaning in the active
      locale, and a strength bar — never a numeric strength.
- [x] Word Book shows only `mastered` words as an illustrated grid; tapping opens Word Detail.
- [x] Word Detail shows: word, IPA, tap-to-hear, illustration, `meaning` + `definition` in the active
      locale, English example with Chinese translation, strength bar, status badge, and the topic(s).
- [x] A demoted word stays in Collection, moves from the mastered tally to the learning tally, and
      leaves Word Book; the total collected count does not decrease.
- [x] Empty states match PRD Appendix A.3 and include a CTA: Collection 0 → start a session;
      Word Book 0 → start a session; Collection 1–4 → "You've collected X words. Keep going!"
- [x] Filters that produce no rows show a clear "nothing here yet" state, not a blank screen.
- [x] Speech is tap-to-hear only, with an IPA fallback when no English voice exists.
- [x] Collection and Word Book opens are recorded as local metrics (once per open, not per tap).
- [x] Selectors are pure and the screens render their output; no date math or status rules inline.
- [x] All copy is bilingual; the same word renders in the active locale without a reload.

## Tasks (ordered)

1. Implement `getCollected(progress, words)` — join rows to words, exclude `new`, sort by
   `lastSeenAt` descending.
2. Implement `getMastered(...)`, `countByStatus(...)`.
3. Implement filters: `filterByTopic`, `filterByStatus`, `filterRecentlyLearned(7 days)` and a pure
   `applyFilters` combiner.
4. Build the My Words shell with the two tabs bound to `?tab=`.
5. Build the Collection header (total + counts) and the filtered list.
6. Build the Word Book grid with the artwork placeholder fallback.
7. Build Word Detail, including speech and the strength bar.
8. Add empty states and the "filters returned nothing" state.
9. Record the two open metrics.
10. Add i18n keys for counts, filters, badges, and empty states.
11. Responsive pass: grid columns at 1024×768 and 390×844.

## Tests

**Unit (Vitest):**

- `getCollected` — excludes no-progress and `new`; includes demoted; dedupes a shared word; ordering.
- `countByStatus` — learning/mastered/total; a demotion moves one count without changing total.
- `applyFilters` — each filter alone and combined; topic matches any of `topicIds`; recently-learned
  boundary at exactly 7 local days; clearing filters restores all.
- `getMastered` — only mastered; a demoted word is absent.
- Detail selectors — meaning/definition/example choose the active locale; IPA and image pass through.

**Verification (manual):**

- Learn a word, master it, demote it, and confirm the collection total never decreases and Word Book
  loses it.
- Switch locale on Word Detail without a reload.
- Open each empty state on a fresh profile.
- Tap-to-hear works on iPad Safari; with no English voice, IPA is visible.

## Non-goals

- No search, no sorting menus beyond the listed filters, no word editing.
- No Tricky Words tab (Phase 2).
- No per-topic collection pages.
