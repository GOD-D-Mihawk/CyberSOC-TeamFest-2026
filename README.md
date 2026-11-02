# CyberSOC TeamFest — 2026 Edition 🎄

A standalone CyberSOC year-end outing voting and Secret Santa portal.

- Frontend: static HTML/CSS/JavaScript, designed for GitHub Pages at `cybersocfest.hawklab.app`
- Backend: dedicated Supabase project `wntmqdjmthgbqvovpjrh`
- Voting closes: 3 December 2026, 23:59 Mauritius time
- Event: 19 December 2026
- Secret Santa: every invited participant gives and receives exactly once; no pairings visible to event admins
- Organiser's master list: requires a separate two-part timed cryptographic release at 12:00 Mauritius time on 19 December

**Deployment status:** repository bootstrap. Authentication, voting, wishlists, and status functions are being installed. Invitations, drawing, timed release, automated emails and GitHub Pages/DNS require additional configuration and testing. Do not consider the gift exchange active until the draw and release authority are provisioned.

## Security
Never commit a Supabase service-role key or SMTP/Outlook OAuth credentials to this public repository. Only the Supabase project URL and publishable key can go into frontend configuration. Participant emails and gift assignments belong in Supabase, not GitHub.
