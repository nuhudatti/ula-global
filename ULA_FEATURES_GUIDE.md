# IBBUL ULA — What We Built (Plain-Language Guide)

**For everyone on the team** — no technical background needed.

---

## In one sentence

**IBBUL ULA** is the university’s digital archive for course materials. **Lecturers** are the official publishers. **Students** can *suggest* helpful files only when a lecturer allows them. **Heads of Department** and **Faculty** offices oversee people and structure — not every single upload.

---

## Who uses what?

| Who | What they do in ULA | Where they sign in |
|-----|---------------------|-------------------|
| **Student** | Browse, download, and (if allowed) suggest materials | Main site → **Contribute** |
| **Lecturer** | Publish notes & past questions; allow students; review suggestions | **Lecturer workspace** |
| **Head of Department (HOD)** | Manage lecturers, see catalog & resources in one department | **Department workspace** |
| **Faculty Administrator** | Add departments, assign HODs, see whole faculty activity | **Faculty workspace** |

---

## The big idea (three rules)

1. **Only lecturers publish to the official archive** — what students see as “from the department” is under a lecturer’s name.
2. **Courses appear naturally** when lecturers publish — no one has to manually “create every course” in advance.
3. **Students never upload directly to the public site** — they can only *suggest*, and the lecturer decides.

---

## Feature 1 — Student contributions (suggest → lecturer approves)

*This is the newest flow. Lecturers stay in charge.*

### What problem does this solve?

Students often have useful past questions, tutorials, or notes — but open student uploads would be messy, unverified, and lecturers would not trust the system. So we built **invitation-only suggestions**.

### How it works (step by step)

```
┌─────────────┐     allows      ┌─────────────┐     submits      ┌─────────────┐
│  Lecturer   │ ──────────────► │   Student   │ ──────────────► │   Lecturer  │
│  (pick who) │                 │  Contribute │                 │   Inbox     │
└─────────────┘                 └─────────────┘                 └──────┬──────┘
                                                                       │
                    Approve & publish (lecturer's name)                │
                                                                       ▼
                                                              ┌─────────────┐
                                                              │  Public     │
                                                              │  catalogue  │
                                                              └─────────────┘
```

| Step | Who | What happens |
|------|-----|----------------|
| **1** | Lecturer | Opens **Contributors**, searches for a **registered student** in the department, taps **Allow**. Only those students get access — not everyone. |
| **2** | Student | Signs in. If allowed, they see **Contribute** in the menu. If not allowed, they only browse — no suggest button. |
| **3** | Student | Chooses **which lecturer** allowed them, picks **course**, writes a short title and reason, attaches a **PDF or document**, and confirms it is appropriate. |
| **4** | System | Sends the file to that lecturer’s **Student inbox**. It is **not public** yet. |
| **5** | Lecturer | Opens **Student inbox**, previews the file, then **Approve & publish** or **Decline**. |
| **6** | Everyone | If approved, the material appears in the **public catalogue** under the **lecturer’s name** (official publisher). The student can appear as **“Compilation: [student name]”** — credit without replacing the lecturer. |

### What students should understand

- You are **not publishing** — you are **proposing**.
- Your lecturer may edit the title, decline, or take time to review.
- There is a limit on how many pending suggestions you can have at once (so the inbox stays manageable).

### What lecturers should understand

- You control **who** can suggest (search by name or email).
- You can **revoke** access anytime.
- When you approve, **your name** is on the archive entry — you remain the trusted academic voice.
- Declining is normal; you are not obligated to publish everything.

### Try it (demo)

| Role | Email | Password |
|------|--------|----------|
| Student (already allowed by demo lecturer) | `student@demo.ibbul.edu` | `StudentDemo123!` |
| Lecturer | `lecturer@demo.ibbul.edu` | `LecturerDemo123!` |

**Quick test:** Student → **Contribute** → submit a small PDF → Lecturer → **Student inbox** → **Approve & publish** → check the main **Browse** page.

---

## Feature 2 — Lecturer publishing (trusted upload)

| What | Detail |
|------|--------|
| **Who** | Lecturers |
| **Action** | Upload lecture notes, past questions, handouts, etc. |
| **Result** | Material goes **live immediately** in the department catalogue (trusted publisher model). |
| **Course** | Lecturer types **course code + title**; the system registers the course if it is new. |

Students and the public see materials under the **lecturer’s name**.

---

## Feature 3 — Department workspace (HOD)

| What | Detail |
|------|--------|
| **Who** | Head of Department |
| **Focus** | **One department** — people, live catalog, resources, analytics, notices |
| **Not for** | Manually building course lists with levels/semesters or assigning every lecturer to every course |

The HOD **governs people and publications**, not a spreadsheet of courses.

**Demo:** `hod@demo.ibbul.edu` / `HodDemo123!` → **Department workspace**

---

## Feature 4 — Faculty workspace (faculty-wide structure)

| What | Detail |
|------|--------|
| **Who** | Faculty Administrator (e.g. Dean’s office) |
| **Focus** | **Whole faculty** — add departments, assign or invite HODs, view catalog and activity across units |
| **Not for** | Replacing lecturers or approving every student file |

Faculty sets **structure and visibility**; departments run day-to-day publishing.

**Demo:** `faculty@demo.ibbul.edu` / `FacultyDemo123!` → **Faculty workspace**

---

## Feature 5 — Authentication lifecycle (enterprise SaaS)

| Flow | What happens |
|------|----------------|
| **Forgot password** | User requests reset → email link (60 min) → new password |
| **Invite lecturer/HOD** | Admin adds email → invitation with **OTP + activation link** → user sets permanent password |
| **Direct create** | Admin creates account → **temporary password** emailed → first login forces password change |

**Dev:** without SMTP, emails are written to `data/email-outbox/`.  
**Production:** configure `SMTP_*` and `APP_PUBLIC_URL` in `.env`.

---

## Feature 6 — Identity & Settings (photos, logos, banners)

| What | Detail |
|------|--------|
| **Who** | Everyone (personal profile); HOD (department); Faculty admin (faculty); Super admin (institution) |
| **Where** | **Settings** in the main nav (`/settings`), or **Settings** inside each workspace |
| **Upload** | Drag-and-drop · PNG / JPG / WEBP · 5 MB max |
| **Shows on** | Nav bar, workspace sidebars, resource cards (lecturer photo), public header (institution logo) |

**Demo institution editing:** `super@demo.ibbul.edu` / `SuperDemo123!` → **Settings** → **Institution** tab.

---

## Feature 7 — Public catalogue (everyone)

Anyone can **browse and download** published materials (filter by faculty, department, course, type, year).

Approved student suggestions appear like any other resource — **lecturer as publisher**, optional student compilation line.

---

## How the roles fit together

```
                    ┌──────────────────────┐
                    │  Faculty Admin       │
                    │  (structure)         │
                    │  departments, HODs │
                    └──────────┬───────────┘
                               │
              ┌────────────────┼────────────────┐
              ▼                ▼                ▼
       ┌────────────┐   ┌────────────┐   ┌────────────┐
       │ Department │   │ Department │   │ Department │
       │     A      │   │     B      │   │     C      │
       └─────┬──────┘   └─────┬──────┘   └────────────┘
             │                │
        HOD governs      Lecturers publish
             │                │
             │         ┌──────┴──────┐
             │         │  Students   │
             │         │  browse +   │
             │         │  suggest*   │
             │         └─────────────┘
             │
             * only if lecturer allowed them
```

---

## Short WhatsApp update (copy & send)

> **IBBUL ULA update**
>
> We added **student contributions** — lecturers still fully in charge.
>
> • Lecturer **allows** specific students (search in department — invite only).  
> • Student sees **Contribute** → sends PDF/material to that lecturer.  
> • Lecturer **Student inbox** → approve or decline.  
> • If approved → goes public under **lecturer’s name**; student can show as compilation credit.  
> • No random student uploads.
>
> Also live: **Faculty workspace** (add departments, assign HODs) + existing HOD & lecturer tools.
>
> Demo: student `student@demo.ibbul.edu` · lecturer `lecturer@demo.ibbul.edu` · faculty `faculty@demo.ibbul.edu` — passwords end with `Demo123!`

---

## All demo logins

| Role | Email | Password |
|------|--------|----------|
| Super Administrator | `super@demo.ibbul.edu` | `SuperDemo123!` |
| Faculty Admin | `faculty@demo.ibbul.edu` | `FacultyDemo123!` |
| Head of Department | `hod@demo.ibbul.edu` | `HodDemo123!` |
| Lecturer | `lecturer@demo.ibbul.edu` | `LecturerDemo123!` |
| Student | `student@demo.ibbul.edu` | `StudentDemo123!` |

Run `npm run db:seed` if accounts are missing.

---

## Glossary (simple words)

| Term | Meaning |
|------|---------|
| **Catalogue / catalog** | List of courses that exist because people published to them — grows over time. |
| **Contribute** | Student area to *suggest* a file (not publish). |
| **Student inbox** | Lecturer’s queue of pending student suggestions. |
| **Approve & publish** | Lecturer accepts and releases material under their name. |
| **Compilation credit** | Line showing a student helped gather the material; lecturer remains publisher. |
| **Contributors** | Lecturer screen to allow or revoke which students may suggest. |
| **Governance** | Oversight — who is allowed, what is live, what is removed — without doing lecturers’ teaching job for them. |

---

## What is planned later (not in this guide as “live”)

- Student **enrollment** per course (for electives across departments)  
- Expanded **university-wide** super-admin console (beyond institution branding)  
- Email notifications for invites and suggestion status  

---

**ULA — TEAM 5IRE**  
*Learning · Collaboration · Impact*

*Last updated: identity & settings, student contributions, faculty workspace, department & lecturer governance.*
