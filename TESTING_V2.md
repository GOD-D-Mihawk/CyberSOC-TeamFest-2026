# TeamFest V2 — Deployment & acceptance testing

## Live paths
- Main portal: https://god-d-mihawk.github.io/CyberSOC-TeamFest-2026/
- Hughes ADM: https://god-d-mihawk.github.io/CyberSOC-TeamFest-2026/admin.html
- Participant example (only after participant email is recorded): https://god-d-mihawk.github.io/CyberSOC-TeamFest-2026/cedric.lacharmante
- Supabase backend: project `wntmqdjmthgbqvovpjrh`

## Administrator acceptance checks
1. Log in as Hughes ADM with the existing verified Outlook email and PIN. It must show 20 participants and a separate admin.
2. Navigate Participants, edit the name/role/slug/email of an unactivated participant, Save, refresh, and confirm the data survives reload.
3. Copy an invitation; paste it into Outlook to send manually. Mark Sent **only after sending**. This does not itself send email.
4. Voting: date is loaded from Supabase. Extend voting time; refresh; confirm the new deadline persists. Final choice totals must stay hidden until the deadline.
5. Activity Logs: verify the server logged participant edits and the deadline change.
6. Dry-run draw: should report exactly 20 givers, 20 distinct recipients, zero self matches, and `stored:false`. Does not create assignments.
7. Real draw: must remain unavailable until the 20 emails have been populated, every participant has confirmed login, and the New Analyst placeholder has been named. Never run while testing.
8. Decryption: Code A blocked before 2026-12-18 00:00 MUT; Code B blocked before 2026-12-19 12:00 MUT; master blocked until Code B release and both codes supplied.

## Participant acceptance checks (requires a genuine invited address)
1. Open the colleague's unique URL on the same domain.
2. Activate using the verified invited email and a personal eight-digit PIN.
3. Follow the Supabase confirmation email, then sign in. Logging into another colleague's URL must not grant access.
4. Vote for one option; refresh; update that vote; refresh; confirm the latest choice persists.
5. Save wishlist likes/avoid/gift ideas; refresh; verify only that participant's data is visible.
6. Before a real draw: Recipient should show pending. After the real draw: only their own recipient and wishlist should be shown.

## Important boundaries
- Participant emails have not been supplied yet. No invitations are sent.
- The static site contains only a public Supabase publishable key; never store service-role keys, recipient maps, or Microsoft tokens in GitHub.
- The encrypted master and both random recovery codes are kept in Supabase private tables. Codes are gated by a server-side timestamp; **this is operational time gating, not independent custody from the Supabase project owner**. For strict zero-knowledge protection use an external, independently controlled release authority.
- Outlook is available as a connected app in ChatGPT. The GitHub Pages website cannot inherit that authorization. Automated future email delivery requires a Microsoft Graph integration and proper credentials/consent.
- Supabase Auth uses an eight-digit PIN as a password. Enable anti-abuse protections and preferably MFA before production launch.
- App updates are additive. Never truncate, reset, drop, or recreate existing tables.
