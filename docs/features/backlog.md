# Backlog

Ideas that are not yet features. `/implement` and `/next` ignore this file — only numbered
`docs/features/NN-name.md` files claim a priority slot. Promote an item with `/capture feature NN`,
which stress-tests it into a real spec.

## Phase 2 candidates

| Idea | Why it is not specced yet |
|---|---|
| **Badges / achievements** | PRD §13 puts badges in Phase 2. Needs a badge catalogue, trigger rules, and art before it can claim a slot. |
| **Tricky Words** | Phase 2 per PRD §11. Auto-populated from mistakes; the data already exists as `wrongCount`. |
| **Additional topics and packs** | Content is the critical path for a reviewed launch set (feature 17); more topics wait until that set is proven. |
| **Richer stage animations** | Cosmetic; the five-stage art and progress bar are enough for v1. |
| **Spaced-repetition refinements** | SM-2-lite is deliberately simple; tune only after real retention data from Monthly Review. |
| **Notification-free reminders** | In-app only in v1 (PRD §7.2). A reminder needs a return-visit hook without push permission. |

## Phase 3 candidates

| Idea | Why it is not specced yet |
|---|---|
| **Facilitator panel** | Focus list, mute/skip a word, custom word lists (PRD §11). Custom words raise the content-validation question: the validator cannot check an allowlist for user-authored content. |
| **JSON import** | Export ships in v1 (feature 14); import needs a schema-version migration and conflict rules. |
| **Story mode** | A different content and pacing model; not an extension of the session engine. |
| **Timed challenges** | Contradicts the "no punishing timers" stance of PRD §10 unless designed as an opt-in. |
| **Speaking practice / pronunciation scoring** | Needs a speech-recognition model and raises content-size and privacy questions. |
| **Phrases and sentences** | The word schema supports `examples`, but the session modes assume a single word; packs of phrases need a new mode contract. |
| **Native packaging** | PWA is the delivery model (PRD §4.4); Capacitor adds stores, signing, and review. |

## Future

| Idea | Why it is not specced yet |
|---|---|
| **Co-op / team mode** | Requires a social design and consent model the product explicitly avoids in v1. |
| **Parent dashboard** | Requires a reporting model, an admin portal, and a privacy review; PRD §2 lists it as a non-goal. |
| **Recorded audio** | Web Speech + IPA covers v1; recorded audio is 300+ files and a content-rights question. The schema reserves `audioUrl?: string`. |

## Rejected for v1 (do not re-propose without new information)

| Idea | Why it was rejected |
|---|---|
| Offline practice or a guest profile | PRD §4.19: the app is online-only; a failed API call shows retry. Installation is not a durability gate. |
| Telemetry, analytics, or crash reporting | PRD §4.16: per-user counters in D1 only. |
| Leaderboards or class dashboards | PRD §2 non-goal: social features and teacher reporting are out. |
| Speech recognition / pronunciation scoring | PRD §2 non-goal. |
| Push notifications or background jobs | In-app warnings only; no notifications in v1 (PRD §7.2). |
| Hard install gate | PRD §4.4: a strong prompt, never a block. |
| Multiple profiles per identity or a profile picker | PRD §3: one profile per Entra identity in v1; siblings need two accounts. |
