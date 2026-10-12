# Summary: Gamified English Vocabulary Learning Web App

## 1. Product Concept

**Name:** Word Pet (单词宠物) / later referred to as "单词小勇者" (Word Little Hero)

**Target Users:** Primary school students (ages 6–12), with tiered design for grades 1–2 (listening/speaking), 3–4 (spelling), and 5–6 (word meaning discrimination and comprehensive use).

**Form Factor:** A **Progressive Web App (PWA)** — a React SPA deployed to Azure Static Web Apps, installable to mobile home screens, with offline support. No longer tied to the WeChat ecosystem; accessible via any modern mobile browser.

**Parent/Child Access Model:** Since there is no WeChat parent-binding capability, parent controls are implemented as a separate authenticated role within the same PWA (or a lightweight companion view), protected by account-level authentication and role-based authorization.

---

## 2. Core Design Principles

1. **Game mechanics must be deeply integrated with learning goals** — each game type maps to a specific memory channel.
2. **Respect children's attention rhythms** — single study session ≤15 min, single game round 1–3 min.
3. **Parents as observers, not supervisors** — reports inform rather than pressure.
4. **Minimal sustainable cloud** — Azure manages hosting, storage, and scaling; no server ops burden; a teacher can maintain it independently.

---

## 3. Five Game Modes

| Mode | Skill Trained | Mechanism |
|---|---|---|
| Spelling Challenge | Spelling | Virtual QWERTY keyboard, letter-by-letter input |
| Match-3 / Pairing | Word meaning | English-Chinese card matching, tracks "hesitation rate" |
| Word Bubbles | Listening | Floating bubbles, tap the correct one after hearing pronunciation |
| RPG Word Maze | Comprehensive use | Story-driven challenges; words as keys/spells/weapons |
| Dictation Mode | Spelling + listening | Auto-play pronunciation, type the word, auto-grading |

**Pet Raising System:** Children earn coins through games to feed/dress up a virtual pet that evolves (egg → baby → teen → adult). Provides long-term motivation.

**Learning Reports:** For parents — weekly word count, accuracy trends, weak words, review completion rate.

---

## 4. RPG Word Maze — The Chosen Core

### Gameplay Loop
Select scene → select word bank → enter maze map → 3–5 word challenges per level → correct answers advance the story/defeat monsters/open doors → wrong answers let monsters approach, deduct energy, give hints → pass level to earn stars, coins, word cards.

### 10 Story Scenes for Ages 7–12

| # | Scene | Story | Word Interaction |
|---|---|---|---|
| 1 | Magic Forest · Spell Gate | Wizard opens seven spell doors | Read/choose correctly, door glows open |
| 2 | Star Rescue · Alphabet Planet | Repair spaceship after black hole | Listen-and-choose, spell to fix engine |
| 3 | Undersea Kingdom · Pearl Maze | Mermaid's pearls stolen by sea monster | Chinese-English matching, listen-and-choose-picture |
| 4 | Dinosaur Island · Fossil Code | Ancient code hidden in fossils | First-letter fill-in, meaning choice |
| 5 | Candy Kingdom · Chocolate Castle | Candy turned bitter by witch | Spell correctly, candy bridge appears |
| 6 | Pirate Bay · Treasure Map Mystery | Find the missing treasure map | Word ordering, sentence fill-in |
| 7 | Elf Village · Four Seasons Tree | Tree withers, needs seasonal words | Category sorting, antonym matching |
| 8 | Mechanical City · Gear Factory | Robot lost its language chip | Part-of-speech sorting, synonym discrimination |
| 9 | Fairy Tale Castle · Mirror Maze | Characters trapped in mirror world | Listen-and-spell, sentence fill-in |
| 10 | Pyramid · Pharaoh's Golden Scarab | Scarab stolen, pyramid collapsing | Context word choice, collocation judgment |

Each scene: **8 regular levels + 1 Boss level** (Boss requires 3 consecutive correct answers).

### Word Bank System
- **Built-in banks:** Primary, Junior High, Senior High, CET-4, CET-6
- **Custom import:** CSV / Excel / JSON / paste / manual entry
- **Template fields:** `word, meaning, phonetic, example, pos, tag, difficulty`
- **Import flow:** Download template → fill → upload → REST API parses → preview first 20 → auto-deduplicate → confirm → generate "My Word Bank" → editable/deletable/exportable/shareable
- **Safety limits:** File ≤2 MB; only csv/xlsx/json; content safety check via Azure AI Content Safety; no real names collected

### Question Types Auto-Adapt to Word Bank Level

| Level | Main Question Types |
|---|---|
| Primary | Listen-and-choose-picture, Chinese-English matching, first-letter fill-in |
| Junior High | Listen-and-spell, meaning choice, simple sentence fill-in |
| Senior High | Sentence fill-in, part-of-speech conversion, synonym discrimination |
| CET-4 | Context collocation, synonym replacement, long sentence fill-in |
| CET-6 | Advanced collocation, academic context, derivative judgment |

### Memory Algorithm
Simplified **SM-2**:
- Correct: memory level +1; next review interval 1→2→4→7→15→30 days
- Wrong: memory level −1; must review next day
- 3 consecutive correct = "mastered"
- System auto-generates daily review words

### Rewards & Growth
- **Coins:** pet feeding, dressing, unlocking scene skins
- **Stars:** max 3 per level based on accuracy and hint usage
- **Word Cards:** collectible gallery; complete a scene's cards to unlock limited pets
- **Pet evolution** tied to cumulative words learned

---

## 5. Anti-Addiction Mechanism

### Key Compliance Judgment
Determine whether the product is legally a **"network game"** or an **"education tool"** under applicable local regulations (e.g., COPPA / GDPR-K / China's Minor Protection Regulation if distributed there).

- If positioned as an **education tool**, a looser standard applies (pop-up reminder after 2 hours continuous use).
- Recommended: register/position as an education tool, but **voluntarily implement stricter anti-addiction** than the legal minimum.
- If payment features are added later, re-evaluate whether game regulations are triggered.

### Four Design Principles
1. **Embed anti-addiction into the game world** — the pet says "the moon is up, time to rest," not a cold pop-up.
2. **Parents set rules, children manage experience** — parents set limits; children have full choice within boundaries.
3. **Positive incentives over punishment** — "self-plan → gain access → natural end" works better than forced lockout.

### Four Layers of Anti-Addiction

**Layer 1: Account & Age Identification (Compliance Baseline)**
- Account registration with age declaration; parental consent flow for under-13 (COPPA) or under-16 (GDPR) as applicable.
- Enhanced: if suspected minor using adult account (late-night high-frequency use, etc.), trigger additional verification (e.g., parental email confirmation or knowledge-based check).
- No guest mode — account required to enter.

**Layer 2: Daily Duration & Time Slot Control**

| Age | Daily Limit | Single Session | Available Hours |
|---|---|---|---|
| <8 | Parent-managed, no independent entry | — | — |
| 8–12 | 30 min | ≤15 min | 7:00–20:30 |
| 12–16 | 45 min | ≤20 min | 7:00–21:30 |

- Time shown as a **"magic energy bar"** in-game, not a countdown.
- At 80%: pet suggests rest. At 100%: auto-save, night-sky scene, daily summary.
- Re-entry within 15 min shows a transition page.

**Layer 3: Parent Control Panel (Core Innovation)**
- Accessible within the PWA via a separate authenticated "Parent" role; no extra app needed.
- Features: duration management (sliders), time slot management, word bank lock (prevent switching to easier banks to "farm time"), learning reports, email/push notifications, remote authorization (child requests extra time; parent approves/denies).
- **PWA notification coordination:** Uses Web Push and Azure Notification Hubs; parent approves via a secure link or in-app action.

**Layer 4: Self-Management Cultivation (Long-Term Goal)**
- **Time Bank:** Complete learning tasks → earn "time coins" → exchange for extra game time (parent sets rate, e.g., 1 coin = 2 min).
- **Self-Discipline Medal:** 7 consecutive days ending within limit voluntarily → "Self-Discipline Little Warrior" medal → unlocks limited pet dress-up.
- **Weekly Report:** Show child "you planned your time X times this week" with visual charts.

### Technical Implementation Path
1. **Account & age:** ASP.NET Core Identity with age claim → store in user profile → match anti-addiction rules; risk-triggered additional verification endpoint.
2. **Duration tracking:** Frontend `visibilitychange` / `beforeunload` lifecycle; backend `StartSession` / `EndSession` API endpoints; atomic operations in Azure SQL/Cosmos DB to prevent local time tampering.
3. **Parent binding:** Parent registers with own account, links to child via invite code or email confirmation; store in `ParentBindings` table; key operations require secondary verification.
4. **Notifications:** Azure Notification Hubs + Web Push when child reaches limit.
5. **Time slot control:** Frontend interception before entering game; backend validation on every answer submission.

### Compliance Checklist
- [ ] Age rating / content rating configured
- [ ] One-click switch to minor mode provided
- [ ] Pop-up reminder after 2 hours continuous use (legal obligation)
- [ ] Privacy policy explains age info collection
- [ ] Parent info collection scope explained
- [ ] No addiction-inducing designs (consecutive sign-in rewards, limited-time purchases)
- [ ] If payment enabled, minor consumption limits set
- [ ] COPPA / GDPR-K compliance if targeting those regions

---

## 6. Technical Architecture & Deployment (Azure-Native)

### Tech Stack

| Layer | Technology | Deployment |
|---|---|---|
| **Frontend** | React SPA created with **Figma Maker** | **Azure Static Web Apps** |
| **PWA Support** | Service Worker, Web App Manifest, offline caching | Built into the React SPA; served by Static Web Apps |
| **Backend** | **ASP.NET Web API (.NET 10.0)** | **Azure Container Apps (ACA)** |
| **Audio** | **Azure Blob Storage** — private containers with permission control | SAS tokens or Azure AD-backed access; streamed via CDN (Azure Front Door / Azure CDN) |
| **Import Parsing** | **RESTful API** hosted on ACA | Separate endpoint or same API project; parses CSV/Excel/JSON |

### Detailed Architecture Notes

**Frontend — React SPA + PWA on Azure Static Web Apps**
- Built via Figma Maker, exported as React SPA.
- Deployed to Azure Static Web Apps (free tier available, global distribution, automatic HTTPS).
- PWA features: service worker for offline caching of word banks and audio, web app manifest for "Add to Home Screen," push notifications via Web Push API.
- Azure Static Web Apps integrates with GitHub Actions / Azure DevOps for CI/CD.
- Authentication: Azure Static Web Apps built-in auth or Azure AD B2C for parent/child role separation.

**Backend — ASP.NET Web API on Azure Container Apps**
- .NET 10.0 Web API, containerized with Docker.
- Deployed to Azure Container Apps (serverless containers, auto-scaling, scale-to-zero).
- API endpoints for: word bank CRUD, daily word selection (SM-2 algorithm), answer submission, progress tracking, parent reports, session management.
- Authentication/Authorization: JWT bearer tokens issued by Azure AD B2C or ASP.NET Core Identity; role-based (Child / Parent / Admin).
- Data storage: Azure SQL Database (relational) or Azure Cosmos DB (document) for user progress, word banks, game records.
- Secrets management: Azure Key Vault.

**Audio — Azure Blob Storage (Private Containers)**
- All audio files (word pronunciations, sound effects) stored in **private** Blob containers.
- Access controlled via:
  - **User delegation SAS tokens** generated by the backend, scoped to specific blobs and short expiry.
  - Or **Azure AD-backed access** with managed identities.
- Audio streamed via **Azure Front Door** or **Azure CDN** for low-latency global delivery.
- Backend generates pre-signed URLs on demand; no public anonymous access.

**Import Parsing — RESTful API on ACA**
- Endpoint e.g. `POST /api/wordbanks/import` accepting multipart file upload.
- Parses CSV/Excel/JSON using a library (e.g., CsvHelper, ClosedXML, System.Text.Json).
- Validates schema, deduplicates, runs content safety check (Azure AI Content Safety).
- Returns preview of first 20 entries; on confirmation, persists to database.
- File size limit enforced (≤2 MB); MIME type whitelist (csv/xlsx/json).

### Database Collections / Tables
- `Scenes` — scene info, maps, recommended levels
- `WordBanks` — word bank info (built-in/custom), ownerUserId
- `Words` — word entries, linked to BankId
- `UserProgress` — user scene progress, coins, pet state
- `WordMastery` — user word mastery, next review time (SM-2 fields)
- `GameRecords` — per-round records, wrong words, scores
- `ParentBindings` — parent-child account links
- `Sessions` — usage sessions for anti-addiction tracking

### Core API Endpoints
- `POST /api/wordbanks/import` — parse uploaded file, deduplicate, store
- `GET /api/words/daily` — fetch today's new + review words by memory curve
- `POST /api/answers` — judge correct/wrong, update mastery
- `GET /api/reports/parent` — generate parent report
- `POST /api/scenes/{id}/unlock` — unlock scenes and rewards
- `POST /api/sessions/start` / `POST /api/sessions/end` — anti-addiction tracking
- `GET /api/audio/{wordId}/url` — generate short-lived SAS URL for private audio blob

### Deployment Flow
1. **Provision Azure resources:**
   - Azure Static Web App (frontend)
   - Azure Container App + Container Registry (backend)
   - Azure Blob Storage (audio, private containers)
   - Azure SQL Database or Cosmos DB (data)
   - Azure Front Door / CDN (audio + API acceleration)
   - Azure Key Vault (secrets)
   - Azure AD B2C (authentication, optional but recommended)
2. **CI/CD:**
   - GitHub Actions / Azure DevOps pipeline builds React SPA → deploys to Static Web App.
   - Pipeline builds .NET 10.0 Web API Docker image → pushes to Azure Container Registry → deploys to Container App.
3. **Develop V1.0:** 1 scene + primary word bank + CSV import + spelling/word choice
4. **Deploy to staging slot** on Static Web App / Container App for testing.
5. **Invite parents and children to test** via staging URL.
6. **Promote to production** after validation.
7. **Cold start:** Share PWA link via class groups, social media, search optimization.

### MVP Development Phases
- **Phase 1:** Magic Forest + primary word bank + listen-and-choose + CSV import + coins
- **Phase 2:** Undersea Kingdom, Star Rescue + junior high word bank + spelling questions
- **Phase 3:** All 10 scenes + senior high/CET-4/CET-6 word banks + pet raising + learning reports
- **Phase 4:** Boss battles, word card gallery, parent sharing, class leaderboard

---

## 7. Key Takeaways

> The core of RPG Word Maze is not "wrapping vocabulary in a game," but making children **need to use words to progress** in a story. 10 scenes provide novelty, self-selected word banks provide adaptability, and import functionality lets teachers, parents, and even children create their own word banks.

> **Anti-addiction is not about locking the door, but teaching children to hold the key themselves.** Account-level age gates provide the baseline defense, the parent panel provides rule boundaries, and in-game positive incentives cultivate self-discipline — ultimately moving from "being managed" to "self-managed."

> **Azure-native deployment** means the entire stack — React PWA on Static Web Apps, .NET 10 API on Container Apps, private audio on Blob Storage, and RESTful import parsing — is managed, scalable, and secure without server ops burden. A teacher can maintain it independently.