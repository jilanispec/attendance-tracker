# Semester Attendance Manager v3

## What it includes
- Eight independent semesters.
- Page 1: add subjects for the semester, choose a date, choose a subject and Present/Absent for each session, and save.
- Page 2: overall attended/conducted/absent totals, overall percentage, eligibility at 75%, and subject-wise total recorded sessions, attended, absent, percentage and eligibility.
- University holidays can be saved as holidays with zero conducted sessions.
- Saturday and Sunday are holidays by default. If a weekday holiday is compensated by a Saturday working day, mark the weekday as a holiday and select `Saturday working day (WD timetable)` on that Saturday. Choose the actual subjects for each Saturday session.
- Default 7 sessions/day and 75% target.
- JSON backup import/export and CSV export.

## Calculation
Attendance percentage = attended sessions / conducted sessions × 100. Eligibility is 75% or above. Holidays do not count as conducted sessions. Subject-wise calculations only include sessions assigned to that subject. Overall calculation includes every marked Present/Absent session, including auto-absent sessions.

## No fixed timetable
Subjects are chosen for each session on each date. If a day is not entered by the configured cutoff (default 6 PM), the tracker auto-marks weekdays as absent when you next open the site, if the date falls within the configured semester dates. Weekends are not auto-marked absent. Since there is no known timetable, automatic absences are assigned to `Unassigned`; they count toward overall attendance but not a specific subject's attendance.

## GitHub Pages setup
1. Extract this ZIP.
2. Create a GitHub repository named `attendance-tracker`.
3. Upload `index.html` to the repository root.
4. Open **Settings → Pages**.
5. Select **Deploy from a branch**, branch `main`, folder `/(root)`, and Save.
6. Your URL will look like `https://YOUR-USERNAME.github.io/attendance-tracker/`.

## Limitations
GitHub Pages is static hosting; it cannot run cutoff tasks or send notifications while the site is closed. Automatic absence processing occurs when the site is opened again. Data stays in local browser storage and does not sync across devices, so export JSON backups regularly.
