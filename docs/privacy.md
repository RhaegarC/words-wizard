# Privacy

Words Wizard is a children's vocabulary app. This page explains what the app
stores, where it lives, and how deletion works. The same notice is published at
`/privacy.html` and linked from Settings.

## What we store

- The Microsoft Entra **object id (`oid`)** for the signed-in account. It is the
  only user key the API uses. We do not store the email address, display name,
  photo, or tenant list Microsoft may return.
- The buddy name, chosen avatar, current topic, locale, XP, streak, Care Token
  state, and progress through the vocabulary.
- Session history and the per-user counters shown in Settings (for example
  sessions completed, words learned, and words mastered).
- Pack introductions, which record that a word was introduced in a particular
  pack so the next pack can unlock.
- A small set of device flags in the browser, such as whether the app is
  installed and whether read-aloud is available. These stay in `localStorage`;
  they are not sent to the API.

The learning content itself — topics, packs, words, definitions, and examples —
is not personal data.

## Where it lives

- **Cloudflare D1** stores the `oid` and the per-user rows. Cloudflare also
  serves the Worker API and the Pages app.
- **Microsoft** handles sign-in. The app never sees the account password.
- The browser stores the Entra session, the outbox for an unsent session, and
  the device flags. The outbox is removed when it is applied or when the user
  signs out.

## What we do not do

- We do not run analytics, advertising, or third-party tracking.
- We do not sell or share personal data.
- We do not read email, contacts, files, or other Microsoft data.
- We do not keep a copy after a verified deletion request.

## Retention and deletion

Progress stays while the account exists. A parent or account holder can ask for
deletion at any time through the repository issue tracker at
<https://github.com/RhaegarC/words-wizard/issues>. The operator confirms the
request with the account holder and runs the documented admin-only procedure
against production:

1. Read the `users` row by `oid`.
2. Delete that row with `DELETE FROM users`; every user-owned table cascades.
3. Run `PRAGMA foreign_key_check`.
4. Record the date and `oid` in the operations log, without the child's name.

Deletion removes the profile, progress, sessions, metrics, and pack
introductions. It does not remove the content tables. There is no user-facing
delete or reset control; deletion is an operator procedure, recorded in
[operations.md](operations.md).

## Children's privacy

The app collects the minimum needed for a child's progress to follow them to
another device. It does not ask for an email address, a real name, a photo, or
a school. The buddy name is a nickname chosen by the child.

## Contact

Questions or deletion requests: <https://github.com/RhaegarC/words-wizard/issues>.
