# Words Wizard — Admin Portal: UI design brief

> A feature brief for designing the admin portal in Figma Make. It describes what the portal does
> and how every screen behaves. It contains no implementation detail, so a designer or a design
> generator can work from it alone.

## 1. Purpose

Words Wizard teaches English vocabulary to Chinese-speaking children aged 9–12. Its vocabulary —
topics, packs, and words — lives in a database and drives every session a child plays.

Today a vocabulary change means an engineer writing SQL. The **Admin Portal** replaces that: a
separate web app, used at **admin.words.nioh.uk**, where teachers and administrators browse, create,
edit, archive, and restore vocabulary directly. A change saved in the portal is live for the child
app on its next refresh. There is no publish step.

The portal is a calm, efficient tool for adults. It should feel related to Words Wizard — same
purple, same warmth — but it is an administrative workspace, not a child's play surface. No
character art, no playful animation, no oversized tap targets.

## 2. Users and access

Three kinds of people encounter the portal:

| Person | What they see |
|---|---|
| Not signed in | A sign-in screen with one button, “Sign in with Microsoft”. Nothing else. |
| Signed in without a staff role | An **Access Denied** screen: the Words Wizard mark, a short explanation that the portal is for teachers and administrators, the signed-in email, and a “Sign out” action. No navigation, no data. |
| Signed in as a teacher or administrator | The full portal. In this version the two roles are identical and see exactly the same screens and actions. |

A session can expire while someone is working. Then the portal shows a small, non-destructive
banner—“Your session expired. Sign in again to continue.”—keeps the current screen visible behind
it, and returns the person to where they were after signing in.

## 3. The vocabulary model

Three kinds of records, in a hierarchy:

```
Topic  (e.g. “Craft & Build”)
  └── Pack  (e.g. “My Workshop”)
        └── Words  (e.g. “box”, “paper”, “glue”)
```

- A **topic** is a broad area of interest. It has a bilingual title, an icon, and a bilingual
  description. Topics are ordered.
- A **pack** belongs to exactly one topic. It has a bilingual title and is ordered within its
  topic.
- A **word** is shared master data. It has a bilingual record (headword, phonetic, part of speech,
  meanings, definitions, examples), a level, tags, an emoji, and an optional image.
- A word can belong to **many packs**, across different topics. Editing “box” in the word library
  changes it everywhere it appears.
- A pack's words are **ordered**; the order is what a child sees.

Lifecycle rules the interface must express:

- Topics and packs can be **archived** and **restored**. Archiving hides them and their contents
  from children, but keeps their history intact.
- **Words cannot be deleted or archived.** They are created, edited, and added to or removed from
  packs. Removing a word from every pack hides it from children while it remains available in the
  word library.
- A record's **id** is generated from its title or headword, is shown read-only, and is never
  reused.

## 4. Information architecture

A persistent left sidebar, a top bar, and a content area. Desktop-first; the sidebar collapses to
a menu button on narrow screens.

```
┌──────────────────────────────────────────────────────────────────┐
│  Words Wizard  Admin                          signed-in email  ▾ │
├───────────────┬──────────────────────────────────────────────────┤
│  Topics       │                                                  │
│  Words        │   content area for the selected screen           │
│  Archived     │                                                  │
│               │                                                  │
│               │                                                  │
└───────────────┴──────────────────────────────────────────────────┘
```

Sitemap:

```
Sign in
Access denied
Topics (default)
  ├── New topic
  └── Topic
        ├── Edit topic
        └── Packs in this topic
              ├── New pack
              └── Pack
                    ├── Edit pack
                    └── Pack contents
Words
  ├── New word
  └── Word
Archived
  ├── Archived topics
  └── Archived packs
```

The sidebar highlights the current section. Drilling into a topic or pack keeps **Topics**
highlighted. The top bar always shows the signed-in email and a menu with “Sign out”.

## 5. Screens

Every screen below lists its fields and actions, and the states a designer must draw.

### 5.1 Sign in

- Centred card on a pale purple background.
- Words Wizard mark and the title “Words Wizard Admin”.
- One primary button: **Sign in with Microsoft**.
- A short line: “For teachers and administrators.”
- Error state: a red-free, calm amber banner — “Sign-in did not complete. Try again.” — with the
  button still available.

### 5.2 Access denied

- Same centred card style.
- Title: “You don't have access to the admin portal.”
- Body: “The admin portal is for teachers and administrators. Ask your administrator if you think
  this is a mistake.”
- Show the signed-in email.
- Secondary button: **Sign out**.

### 5.3 Topics list

Purpose: see and manage the top level of the vocabulary.

Layout: page title “Topics”, a primary **New topic** button top-right, then a card per topic in
their curated order.

Each topic card shows:

- the topic icon (emoji) in a pale-purple rounded square;
- the English title, with the Chinese title beneath in muted text;
- a short description line, truncated to one line;
- a metadata line: number of packs, number of words;
- a status chip when archived (not shown here; archived topics live in the Archived view);
- actions: **Edit**, **View packs**, **Archive**.

Screen states:

- **Loading** — three skeleton cards.
- **Empty** — a friendly empty panel: “No topics yet. Create the first topic to start building the
  vocabulary.” with the **New topic** button.
- **Error** — a banner above the list: “Couldn't load topics. Try again.” with a **Retry** button.

### 5.4 Topic editor

Used for both creating and editing a topic. A single centred form card, max width ~720 px.

Fields:

| Field | Control | Required | Notes |
|---|---|---|---|
| English title | Text input | Yes | e.g. “Craft & Build” |
| Chinese title | Text input | Yes | e.g. “手工与建造” |
| Icon | Emoji input | Yes | one emoji, chosen or typed |
| English description | Textarea, 2–3 rows | Yes | one or two sentences |
| Chinese description | Textarea, 2–3 rows | Yes | |
| Id | Read-only text | — | generated after save; hidden on create |

Actions: **Save** (primary), **Cancel** (secondary). When editing an existing topic, a **danger
zone** at the bottom offers **Archive topic** with the consequence spelled out: “Archived topics
and their packs are hidden from children. You can restore them from the Archived view.”

States: saving (button shows a spinner and is disabled), saved (return to the Topics list with a
brief success toast), validation failed (field-level messages; see §6), server error (banner at the
top of the form, form values preserved).

### 5.5 Packs list (inside a topic)

Header: breadcrumb “Topics / Craft & Build”, the topic title, and a primary **New pack** button.

Below, a compact numbered list of packs in their order. Each row shows:

- position number;
- English title with the Chinese title beneath;
- word count;
- actions: **Move up**, **Move down**, **Edit**, **Contents**, **Archive**.

Ordering is immediate: moving a pack up or down reorders the list and saves.

States: loading (skeleton rows), empty (“No packs in this topic yet. Create the first pack.”), error
banner with retry.

### 5.6 Pack editor

Fields:

| Field | Control | Required | Notes |
|---|---|---|---|
| English title | Text input | Yes | |
| Chinese title | Text input | Yes | |
| Topic | Read-only text | — | the pack's topic; cannot be changed after creation |
| Id | Read-only text | — | generated after save |

Actions: **Save**, **Cancel**, and when editing, **Archive pack** in a danger zone with the
consequence: “Archived packs are hidden from children. The words stay in the word library.”

### 5.7 Pack contents

Purpose: curate which words a child practises in this pack, and in what order.

Layout: breadcrumb “Topics / Craft & Build / My Workshop”, the pack title, and a primary **Add
words** button. Then an ordered list of word rows:

- position number, drag handle;
- image thumbnail when present, otherwise the emoji tile;
- English headword with phonetic beneath;
- Chinese meaning on the right;
- level chip;
- **Remove** action (an x icon with an accessible label).

**Add words** opens a search dialog: a search field (English or Chinese), a scrollable list of
library words with checkbox selection, showing which are already in the pack (disabled), and an
**Add selected** button. Words can be added in bulk.

The list is a working draft: reordering, adding, and removing change the list immediately, and a
sticky footer offers **Save changes** (primary) and **Discard changes** (secondary). Leaving with
unsaved changes asks for confirmation.

States:

- **Empty** — “This pack has no words yet. Add words from the library.” with **Add words**.
- **Saving**, **saved toast**, **error banner** preserving the draft.
- **Too few words** — a gentle warning chip when the pack holds fewer than the recommended minimum:
  “Packs usually hold at least 5 words.”

### 5.8 Words library

Purpose: master data for every word, shared by all packs.

Header: “Words”, a primary **New word** button, and a search field (“Search English or Chinese”).

A table or card list, one row per word:

- thumbnail or emoji;
- headword, phonetic, part of speech;
- Chinese meaning;
- level chip;
- “Used in N packs” — with the pack names on hover or a secondary line;
- row action: open editor.

Search filters as the user types, matching English headword, Chinese meaning, and phonetic. A
secondary filter offers level (all, 1, 2, 3).

Words that belong to no pack are marked with a muted chip: “Not in any pack — hidden from children”.

States: loading, empty library (“No words yet.”), empty search (“No words match ‘xyz’.”), error
banner.

### 5.9 Word editor

The largest form. Grouped into cards, max width ~880 px.

**Basics**

| Field | Control | Required | Notes |
|---|---|---|---|
| English headword | Text input | Yes | e.g. “box” |
| Phonetic | Text input | Yes | e.g. “/bɒks/” |
| Part of speech | Text input | Yes | free text, e.g. “noun” |
| Id | Read-only text | — | generated from the headword after save |

**Meanings**

- English meaning — text input, required.
- Chinese meaning — text input, required.

**Definitions**

- English definition — textarea, required.
- Chinese definition — textarea, required.

**Examples**

A repeater: each example has an English sentence and its Chinese translation. At least one is
required; **Add example** appends a pair; each row has **Remove example** (disabled when only one
remains). The first example should contain the headword — show an editorial warning if it does not
(see §6).

**Classification**

| Field | Control | Notes |
|---|---|---|
| Level | Segmented control 1 / 2 / 3 | 1 = easiest |
| Tags | Token input | free-form; suggested tags include “abstract” |
| Emoji | Single emoji input | tile fallback when no image |

**Image**

A dedicated card:

- empty state: a dashed drop zone — “Upload an image (PNG, JPEG, or WebP, up to 2 MB)”;
- with an image: a preview at a fixed aspect ratio, the file name, and two actions — **Replace
  image** and **Remove image**;
- uploading: a progress state on the preview area; actions disabled;
- error: “That file isn't a supported image. Choose a PNG, JPEG, or WebP under 2 MB.”

Actions: **Save** (primary), **Cancel** (secondary). No delete action exists for a word.

### 5.10 Archived

Purpose: view and restore archived topics and packs. Words never appear here because words are
never archived.

Two tabs: **Topics** and **Packs**. Each tab lists archived items in a compact table:

- title (English and Chinese);
- the date it was archived;
- for packs, the topic it belonged to;
- action: **Restore**.

A short explanation at the top: “Archived items are hidden from children. Restoring makes them
visible again immediately.”

States: active tab empty (“Nothing is archived.”), loading, error banner, restore confirmation
(lightweight, with **Restore** and **Cancel**).

## 6. Shared behaviours

**Live saves.** Every save takes effect immediately for children. The interface must say so in
context, not bury it in help: a one-line note on create/edit screens — “Changes are live as soon as
you save.” — and a success toast after each save.

**Validation errors versus warnings.**

- **Errors** block saving. Show them beside the field they concern, in a calm red, and summarise
  at the top of the form: “Check the highlighted fields.”
- **Warnings** do not block. Show them in an amber panel above the form with a “Save anyway”
  implication, e.g. “The first example doesn't contain the headword ‘box’.”
- Server-side rejections with no specific field (e.g. a duplicate headword) appear in a banner at
  the top of the form with an actionable message.

**Archive and restore.** Archiving always asks for confirmation, names the consequence, and
confirms with an **Archive** button. Restoring is immediate and offers **Undo** in the toast for a
few seconds.

**Unsaved changes.** Leaving an edited form or pack contents asks: “Discard unsaved changes?” with
**Discard** and **Keep editing**.

**Read-only ids.** Show the generated id in a muted, monospaced style with a small “generated”
label. It is never editable, even on create.

**Toasts.** Bottom-right, short (3–4 s), never cover primary actions. Success is neutral; errors
stay until dismissed.

**Dates.** Show human dates (“Archived 6 Nov 2026”), not raw timestamps.

## 7. Visual language

Match the product's existing tokens:

| Token | Value | Use |
|---|---|---|
| Purple | `#7059dc` | primary buttons, links, active nav |
| Dark purple | `#5942c0` | hover/pressed primary |
| Pale purple | `#eeeafd` | selected rows, icon tiles, empty-state panels |
| Ink | `#302747` | primary text |
| Muted | `#777180` | secondary text, metadata |
| Line | `#e9e5ed` | borders and dividers |
| Green | `#56a87c` | success, “in use” |
| Amber | `#b07e26` on `#fff2d2` | warnings |
| Coral | `#d97854` on `#ffeadf` | destructive actions and errors |
| Blue | `#4489a5` | informational chips |
| Pink | `#c45f87` | level accents, sparingly |

Shape and space: cards with 12–15 px radius; inputs 9–12 px radius; generous 16–24 px padding;
clear 8 px grid. Use one sans-serif family throughout (the product's existing stack).

Density: administrative, not airy. Tables are comfortable but compact; the screen should show
10–15 rows without scrolling where possible.

Responsive: desktop-first. At tablet widths the sidebar collapses to icons; forms remain usable.
The portal is not a phone-first product, but no screen should break on a phone.

Motion: minimal. No bounce, no confetti. Transitions under 200 ms.

## 8. Copy guidelines

- Use the vocabulary's own words: **topic, pack, word, archive, restore, level, tag**.
- Buttons are verbs: **Save**, **Create topic**, **Add words**, **Restore**, **Archive pack**.
- Destructive actions name their consequence rather than saying “Are you sure?”.
- Bilingual field labels are explicit: “English title”, “Chinese title”, “English meaning”,
  “Chinese meaning”.
- No engineering jargon: never “database”, “API”, “release”, “deploy”, “record”, or “entity”.
  Say “word”, “pack’s words”, “changes are live”.
- Keep sentences short. Explain archiving once on the screen where it happens.

## 9. Out of scope for this design

- A Release or Publish button, drafts, approval, or sign-off states.
- Who changed what (audit history).
- Managing users, teachers, or roles.
- Deleting or archiving words.
- Bulk import or export, CSV upload, or printing.
- Portal offline use or installability.
- Child-facing screens.
- Artwork review and approval beyond uploading an image file.

## 10. Design checklist

- [ ] Signed-out, access-denied, session-expired, and error states are drawn.
- [ ] Topics, packs, pack contents, words, word editor, and archived screens are all present.
- [ ] Create, edit, archive/restore, reorder, add/remove membership, and image upload are each
      represented by a control and a state.
- [ ] Empty, loading, and error states exist for every list and form.
- [ ] Validation errors and non-blocking warnings are visually distinct.
- [ ] No screen offers deleting or archiving a word.
- [ ] The generated id is shown read-only wherever a record has one.
- [ ] Brand tokens, radii, and copy tone follow §7 and §8.
