# Feature 19 — Buddy Portraits, Settings Return & Detail Polish

> Priority: Should · Mission 1 · **Status: Done — merged in PR #44**
> Depends on: 03, 06, 12, 14, 15

## Summary

Four small product enhancements gathered into one feature:

1. **Six buddy portraits replace the three placeholders.** The images in
   `docs/buddy/` become the bundled avatars, and each file name is the
   character's name: Alex, Cody, Creeper, Malenia, May, Steve. The originals stay
   in `docs/buddy/`; the served copies live in `src/public/art/avatars/`.
2. **Saving a buddy in Settings returns to Home**, so the saved change is
   immediately visible instead of leaving the child on the form.
3. **Word Detail always shows the English meaning and definition**, even when
   the UI is Chinese. Practice and introduction cards remain bilingual.
4. **The install instructions use a smaller corner radius** on the card and its
   buttons, so the block reads as guidance rather than a pill-like banner.
5. **Home names the buddy instead of saying "My buddy."** The caption under the
   portrait shows the child's chosen character name.

## User story

As a child, I choose a buddy I recognize and see its picture on the creation,
settings, buddy, and Home screens. As a parent, I save a customisation and land
back on Home, and I can rely on the word detail page as an English reference
even when the interface is Chinese. As a first-run user, the install steps look
like instructions, not a floating badge.

## Acceptance criteria

- [x] `avatars.json` lists six avatars, named from the source file names, with
      the portrait mapped to all five stages.
- [x] The six portraits are served from `src/public/art/avatars/` and are
      included in the service-worker precache (`.jpeg`/`.jpg` added to the glob).
- [x] Creation and Settings show each buddy's portrait, not its initial.
- [x] The content validator requires six avatars; the content and validator
      tests assert the new set.
- [x] A successful Save in Settings updates the profile and navigates to Home;
      a failed save stays on Settings with the error.
- [x] Word Detail uses `meaningEn` and `definitionEn` in both UI languages.
- [x] The install prompt and its action buttons use a `0.5rem` border radius.
- [x] Home's portrait caption shows `profile.characterName`; the `home.buddy`
      locale key is gone.
- [x] `pnpm test`, `pnpm typecheck`, `pnpm validate:content`, and `pnpm build`
      pass.
- [x] Manual browser run confirms the six portraits, the post-save Home route,
      Chinese-mode Word Detail in English, and the smaller install radius.

## Tasks (ordered)

1. Copy the six `docs/buddy/` images into `src/public/art/avatars/` and rewrite
   `avatars.json`.
2. Raise the validator's avatar count from three to six; update fixtures and
   tests.
3. Render portraits in Creation and Settings through `AvatarPortrait`.
4. Navigate to Home after a successful Settings save.
5. Make `buildWordDetail` locale-independent and update Word Detail.
6. Reduce `.install-prompt` radius and update the PRD, sprint index, and this
   feature file.

## Tests

**Unit (Vitest):** content set exposes six avatar ids with five stage entries
each; validator rejects a five-avatar bundle; `buildWordDetail` returns English
meaning and definition with no locale input; existing avatar-id validation
accepts exactly the new ids.

**Verification (manual, 2026-10-22, headless Edge):** the creation screen showed
six portraits (all 300 px wide) named Alex, Cody, Creeper, Malenia, May, Steve;
the install card and its "Continue in browser" button both computed an 8 px
radius; saving after switching to 中文
landed on `#/home`; Home rendered Alex's portrait with "Mia" as its caption;
and `#/words/w-bag` showed
"a container for carrying things" / "You put things inside a bag." with the
Chinese strings absent.

## Non-goals

- No per-stage buddy art; each stage shows the same portrait.
- No new avatar upload or custom-image support.
- No change to the localized meaning used by practice modes or introduction
  cards.
- No localization of the buddy names themselves.

## Risks

- **Character names and likenesses.** Several portraits depict well-known game
  characters. They are used here as supplied local assets; shipping publicly
  needs a rights check.
- **No visible growth in the character.** Without stage art, the buddy looks the
  same at every stage; the stage name and progress bar carry growth instead.
- **Less Chinese support on Word Detail.** A Chinese reader now gets an English
  meaning and definition there by design. The bilingual example and the Chinese
  practice modes remain the support layer.
