# Backlog

Ideas that are not yet features. `/implement` and `/next` ignore this file — only numbered
`docs/features/NN-name.md` files claim a priority slot. Promote an item with `/capture feature NN`,
which stress-tests it into a real spec.

## Phase 2 candidates

| Idea | Why it is not specced yet |
|---|---|
| **Badges / achievements** | PRD §13 puts badges in Phase 2. Needs a badge catalogue, trigger rules, and art before it can claim a slot. |
| **Multi-profile switcher UI** | The schema already carries `profileId` everywhere (PRD §8.3); only the UI is missing. Deferred because v1 is one child per device. |
| **Tricky Words** | Phase 2 per PRD §11. Auto-populated from mistakes; the data already exists as `wrongCount`. |
| **Additional topics and packs** | Content is the critical path for the five launch topics (feature 17); more topics wait until that set is proven. |
| **Richer stage animations** | Cosmetic; the five-stage art and progress bar are enough for v1. |
| **Spaced-repetition refinements** | SM-2-lite is deliberately simple; tune only after real retention data from Monthly Review. |
| **Notification-free reminders** | In-app only in v1 (PRD §7.2). A reminder needs a return-visit hook without a backend or push permission. |

## Phase 3 candidates

| Idea | Why it is not specced yet |
|---|---|
| **Facilitator panel** | Focus list, mute/skip a word, custom word lists (PRD §11). Custom words raise the content-validation question: the validator cannot check an allowlist for user-authored content. |
| **JSON import** | Export ships in v1 (feature 14); import needs a schema-version migration and conflict rules. |
| **Story mode** | A different content and pacing model; not an extension of the session engine. |
| **Timed challenges** | Contradicts the "no punishing timers" stance of PRD §10 unless designed as an opt-in. |
| **Speaking practice / pronunciation scoring** | Needs a speech-recognition model and raises offline-size and privacy questions. |
| **Phrases and sentences** | The word schema supports `examples`, but the session modes assume a single word; packs of phrases need a new mode contract. |
| **Native packaging** | PWA is the delivery model (PRD §4.4); Capacitor adds stores, signing, and review. |
| **Custom domain** | Static Web Apps supports custom domains with a free managed certificate; deferred until a domain name exists, not blocked by deployment (feature 16). |

## Future

| Idea | Why it is not specced yet |
|---|---|
| **Co-op / team mode** | Requires a backend and a social design the product explicitly avoids in v1. |
| **Parent dashboard** | Requires a backend, accounts, and a privacy model; PRD §2 lists it as a non-goal. |
| **Cloud sync / multi-device** | Requires accounts and conflict resolution; the `ProgressProvider` seam exists so this is a replacement, not a rewrite. |
| **Recorded audio** | Web Speech + IPA covers v1; recorded audio is 300+ files and a content-rights question. The schema reserves `audioUrl?: string`. |

## Rejected for v1 (do not re-propose without new information)

| Idea | Why it was rejected |
|---|---|
| Accounts, sign-in, or cloud backup | PRD §2: no backend, no accounts, no sync. Installation + `persist()` is the durability model. |
| Telemetry, analytics, or crash reporting | PRD §4.16: local counters only. |
| Leaderboards or class dashboards | PRD §2 non-goal: social features and teacher reporting are out. |
| Speech recognition / pronunciation scoring | PRD §2 non-goal. |
| Push notifications or background jobs | In-app warnings only; no server scheduler (PRD §7.2). |
| Hard install gate | PRD §4.4: a strong prompt, never a block. |
| Profile picker / multiple children per device | PRD §3: one character per device in v1; siblings share it. |
