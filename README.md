# Glass Attendance — GitHub Pages + Supabase

This is a static frontend with secure authentication and per-user cloud data using Supabase. The site is glassmorphism-styled and uses cards, not tables.

## What is included
- Sign up and sign in with a password via Supabase Auth.
- Private attendance payload per account protected by Row Level Security (RLS).
- 8 independently configurable semesters.
- Semester 1 timetable preloaded from the supplied image:
  - Monday: DT, PSC, Chemistry, English, Library (optional), Mentoring (optional), Chemistry
  - Tuesday: Maths, DT, PSC, ES, ES, English, DT
  - Wednesday: IE, Counselling (optional), PSC Lab, PSC Lab, PSC, Maths Lab, Maths Lab
  - Thursday: Chemistry, IE, English Lab, English Lab, Maths, Biology, ES
  - Friday: Maths, IE, Chemistry Lab, Chemistry Lab, PSC, Chemistry, IE
- Optional Library, Mentoring and Counselling default to Not Held; Not Held is excluded from conducted totals.
- University holidays exclude all sessions for that date.
- Saturday/Sunday default to holidays. A replacement Saturday can use the selected weekday's timetable (Friday by default).
- Subject-wise and overall attendance cards, attendance percent, eligibility at 75%, daily history, JSON backup import/export.
- Historical opening balances per subject, so you do not have to enter every already-completed day.

## Important timetable note
The timetable image appears to use abbreviated subject labels and course codes. Review the preloaded subjects and edit/add/remove them as needed. Timetable sessions are not attributed to a subject's report unless their subject name and code match a configured subject. Duplicate subject labels with different course codes are kept separate when possible.

## Deploy setup

### 1. Create a Supabase project
1. Open https://supabase.com and create a project.
2. In the project dashboard, open **SQL Editor**, create a new query, paste all of `supabase-schema.sql`, and run it.
3. Open **Project Settings → API**. Copy the **Project URL** and **anon/public key**.

### 2. Configure the frontend
1. Edit `config.js`.
2. Replace `YOUR_SUPABASE_PROJECT_URL` and `YOUR_SUPABASE_ANON_KEY` with your actual values.
3. Do not put a `service_role` key in the website. Never expose it in a public repository.

### 3. Enable auth
1. In Supabase, open **Authentication → Providers → Email** and enable Email provider.
2. For this starter's username-only form, the frontend maps username to a synthetic email address (`username@attendance.local`). This is convenient for a class demo but Supabase email confirmation cannot deliver to that address.
3. For a real production deployment, the recommended choice is to change the form to collect a real email address and keep email confirmation enabled. If you want username-only signup, disable email confirmation in Supabase Auth settings and understand that password recovery by email will not work.
4. Set your GitHub Pages URL in Supabase **Authentication → URL Configuration → Site URL / Redirect URLs**. Add `https://YOUR-USERNAME.github.io/YOUR-REPOSITORY/`.

### 4. Publish with GitHub Pages
1. Create a GitHub repository.
2. Upload `index.html`, `config.js`, and `supabase-schema.sql` (README optional) to the repository root.
3. Open **Settings → Pages**.
4. Select **Deploy from a branch**, branch `main`, folder `/(root)`, then Save.
5. Open the published URL. Use HTTPS.

## Security
- Only the Supabase anon/public key belongs in browser code. The database has RLS policies restricting each row to `auth.uid()`.
- Never use a Supabase service-role key in frontend files.
- Friends can register independently; each account reads/writes only its own row.
- The app currently stores all of one user's attendance state in a JSON payload. It is private due to RLS but a future larger version could normalize each session into separate rows.
- Supabase cloud data is used only after successful sign-in. Without config, the page tells you to set up Supabase rather than silently treating a fake login as secure.

## Backfilling the half-semester already completed
Use **Subject report → Historical opening balance**. For every subject, enter:
- Conducted before tracker: how many sessions have already been held.
- Attended before tracker: how many of those you attended.
Then new daily entries are added to those totals. This avoids manually entering 50 days. For a subject-wise accurate percentage, use official course-wise conducted/attended counts from your college portal if available.

## Known limitations
- GitHub Pages cannot run cutoff jobs or notifications while the browser is closed. This starter does not auto-mark unentered dates absent; record actual outcomes, or use the opening balance to backfill.
- No table UI is used in the app. Attendance reports and history use responsive cards.
- Do not upload private credentials. `config.js` contains only the public anon key; RLS is what protects user records.
