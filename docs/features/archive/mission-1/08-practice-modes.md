# Feature 08 — Five Practice Modes

> Priority: Must · Mission 1 · **Status: Not started**
> Depends on: 03, 04, 07

## Summary

Five exercise modules behind one contract, so the session engine does not know what a picture match
is. All five ship in the MVP: picture match, word → meaning, spelling builder, fill the blank, and
listen & choose. Each module builds a deterministic exercise from a word and a seed, checks the
answer, and knows how to soften itself for hint level 1.

## User story

As a **child**, practice does not feel like the same screen nine times; I see a picture, read, spell,
fill a gap, and listen. As a **child without English audio**, I still get a full session — listening
is swapped for another mode and the IPA is always there.

## Acceptance criteria

- [ ] One `ExerciseModule` contract with a discriminated `Exercise` union; the session engine renders
      by `mode` and never branches on a specific mode's internals.
- [ ] **Picture match** — illustration prompt, 3–4 English word options, tap to answer.
- [ ] **Word → meaning** — English word prompt, 3–4 meaning options in the active locale
      (`meaningZh` in `zh`, `meaningEn` in `en`), tap to answer.
- [ ] **Spelling builder** — the word's letters plus 1–3 distractor letters, shuffled deterministically;
      tap-to-place and drag both work; tap a placed tile to return it; the answer is checked when the
      word is complete.
- [ ] **Fill the blank** — the first English example with the target word replaced by a blank
      (word-boundary match, case-insensitive), 3–4 word options, and the Chinese translation shown
      below as support. The content validator guarantees the example contains the word.
- [ ] **Listen & choose** — tap a speaker to hear the target word, then pick from 3–4 pictures
      (or 3–4 words when art is unavailable). The spelling is never shown before the answer.
- [ ] Distractors exclude the answer, are unique, and prefer the same level, then the same topic, then
      any word; all choices are generated from a seeded PRNG so the same session seed reproduces them.
- [ ] Option order is shuffled deterministically and does not always put the answer first.
- [ ] Hint level 1 is mode-aware: eliminate one distractor for choice modes; reveal the first letter
      for spelling and fill-the-blank.
- [ ] Speech: no autoplay; every sound is a deliberate tap. `speak(text)` prefers a local `en-*`
      voice, falls back to any `en-*` voice, and resolves immediately when none exists.
- [ ] At boot, `hasEnglishVoice()` is recorded in `device.speechAvailable`; the session builder reads
      it to exclude *listen & choose*.
- [ ] IPA is visible on the word introduction and the word → meaning prompt; it is always available
      when audio fails.
- [ ] Every mode is operable with a keyboard and a screen reader; targets are ≥ 44×44 px; no
      interaction is drag-only.
- [ ] No mode writes to storage or changes profile state.

## Tasks (ordered)

1. Define `PracticeMode`, `ExerciseModule`, the `Exercise` union, and `ModeContext` (word, all words,
   locale, seed, speech availability, art resolver).
2. Add `src/domain/random.ts` — a seeded PRNG and `shuffle(items, rng)`; shared with feature 07.
3. Implement distractor selection and option generation once, reused by four modes.
4. Implement picture match.
5. Implement word → meaning.
6. Implement spelling builder: tile generation, placement/removal, completion check, first-letter hint.
7. Implement fill the blank: blank extraction at a word boundary, options, translation support.
8. Implement the speech helper: voice discovery, `speak`, `cancel`, `hasEnglishVoice`, rate/pitch from
   config; wire the boot-time availability record.
9. Implement listen & choose with picture options and a word-option fallback.
10. Implement the shared hint helper (level 1 effect per mode; level 2 is engine copy + meaning).
11. Register all five modules in `src/modes/index.ts`.
12. Accessibility pass: labels, focus order, keyboard activation, reduced motion.
13. Add i18n keys for mode prompts and instructions.

## Tests

**Unit (Vitest):**

- Option generation — 3–4 options, the answer included exactly once, no duplicates, deterministic for
  a seed, a different seed can change the order.
- Distractor preference — same-level words chosen before other levels when available.
- Spelling tiles — contain every letter of the answer plus 1–3 distractors; deterministic shuffle;
  duplicate letters handled correctly.
- Fill blank — extracts the word on a boundary, not inside another word (`art` in `start`); preserves
  surrounding punctuation; rejects an example without the word at build time.
- Listen & choose — picture options when art is approved, word options when only placeholders exist;
  the target word is not rendered as text in picture mode.
- Hint 1 — removes exactly one distractor for choice modes; reveals only the first letter otherwise.
- `speak` — no voice → resolves without throwing; a voice exists → called once with the configured
  rate/pitch and an `en-*` voice; a second call cancels the first.

**Verification (manual):**

- Play each mode on iPad Safari and Edge with a real English voice.
- Turn speech off / use a browser with no English voice: *listen & choose* is absent and the session
  still fills 9 words.
- Complete a spelling exercise with tap only, then with drag only.
- Screen reader pass on one choice mode and spelling.

## Non-goals

- No speech recognition or pronunciation scoring.
- No typed answers, no free-text input.
- No per-mode difficulty settings or timers.
