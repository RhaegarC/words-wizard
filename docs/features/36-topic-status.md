# Feature 36 — Topic Status

> Priority: Must · Mission 4 · **Status: Specced**
> Depends on: 35 (the persisted exam completion signal). Blocks: none.
> Source of truth: [Mission 4 sprint](00-mission-4-sprint.md).

## Summary

Show a status for every topic — **None**, **Learning**, or **Completed** — on the topic picker and
on the practice hub's exam card. Two of the three are derived from introductions the app already
stores; only completion is persisted, and it comes from the exam.

The feature deliberately adds no status column and no second table. The exam's `completed_at` is
the single fact behind Completed; everything else is a pure function of introductions.

## User story

As a **child**, I want to see which topics I have started and which I have finished, so I know
where to go next. As a **parent**, I want the status to mean something: Completed should require
passing the topic exam, not just opening a pack.

## Design

### Status model

| Status | Definition |
|---|---|
| `none` | No word in any pack of the topic has an introduction row for this user. |
| `learning` | At least one introduction in the topic, and the exam is not completed. |
| `completed` | `topic_exam_progress.completed_at` is set (sticky). |

- **None → Learning** happens on the first introduction, which is the first committed session that
  introduces a new word.
- **Learning → Completed** happens only when the exam's final part passes (feature 35).
- There is no path back to Learning or None. A demoted word, a weaker strength, a retake or a
  content change never clears Completed.
- A topic that has been archived in content keeps any recorded completion; the topic picker only
  shows live topics.

### Derivation

A pure `deriveTopicStatus({ topicId, packs, introductions, exams })` lives in the shared domain and
is used by both display surfaces:

- `none` when no `(packId, wordId)` introduction belongs to a pack of the topic;
- `completed` when the exam state has `completedAt`;
- otherwise `learning`.

The selector handles a word that appears in several packs of the same topic (one introduction is
enough), ignores introductions for unknown or archived packs, and treats legacy import rows without
introductions as `none` until a normal session introduces a word.

### Read surfaces

- **Topic picker:** every topic card shows a status badge. The picker already loads topics and packs
  from content; it additionally reads introductions and exam states through the progress provider
  (the new `getExams()` accessor). A loading state is shown while that read is in flight and a
  generic error if it fails.
- **Practice hub:** the Topic Exam card shows the current topic's status and the exam gate
  (`introduced / total`). The card is disabled when the status is not sufficient for the exam gate;
  the gate itself remains the Worker's decision.
- The status is read on render; content is never captured at module scope.

### Copy and layout

- Three short labels, in both locales: None / Learning / Completed (and their Chinese equivalents).
- The badge is a small inline tag on the topic card, not a full card redesign; the existing
  selected-topic treatment and pack count remain.
- Completed topics show the trophy-adjacent treatment defined by feature 37 only after that feature
  lands; this feature owns the status label, not the badge artwork.

## Acceptance criteria

- [ ] A topic with no introductions shows None; after one committed introduction it shows Learning.
- [ ] A topic shows Completed only after every exam part has passed, and never returns to
      Learning or None.
- [ ] The topic picker and the hub exam card agree for the same topic.
- [ ] A demoted or weaker word does not change the status.
- [ ] Words shared by several packs in one topic count once for Learning; unknown or archived packs
      do not count.
- [ ] A legacy import without introductions leaves the topic None until a normal session
      introduces a word.
- [ ] Content growth on a completed topic does not clear Completed.
- [ ] Both locales cover the three labels and the gate copy.

## Test plan

- **Unit** — `deriveTopicStatus` boundary cases: no introductions, one introduction, completed,
  completed with new words, shared word across packs, unknown pack, imported rows.
- **Host** — a real Worker/D1 flow creates an introduction and shows Learning; a passed exam shows
  Completed; a retake stays Completed.
- **Page** — the topic picker badge states and loading/error handling; the hub card gate copy;
  i18n key parity.
- **Manual** — start a fresh topic (None), complete a daily session (Learning), pass the exam
  (Completed), then retake it and confirm the status stays Completed.

## Documentation impact

PRD §6.5/§7.8/Appendix A (status and entry points); privacy (completion is part of the exam record);
the topic picker and hub copy in both locales when the feature lands.

## Out of scope

Editing a status by hand; teacher or parent views of topic status; filtering or sorting by status;
per-topic progress percentages; changing the pack-unlock rule; using status to gate daily practice;
a stored status column or a second status table.
