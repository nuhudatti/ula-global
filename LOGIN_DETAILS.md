# ULA — Login Details and System Visibility

## ULA Global Platform (operations only)

Separate from any university workspace. Institution users must **not** use this login.

### Production (first deploy)

| Step | URL |
|------|-----|
| First-time setup (once only) | `/platform/setup` |
| Sign in after setup | `/platform/login` → `/platform` |

No demo platform password is seeded in production. Create the super admin on `/platform/setup` (bcrypt-hashed, strong password rules). Setup locks permanently when a `PLATFORM_SUPER_ADMIN` exists.

### Local development

| Option | Details |
|--------|---------|
| First-run setup | `/platform/setup` on empty DB |
| Demo institution users | `SEED_DEMO_ACCOUNTS=true npm run db:seed` (institution demos only — **not** platform admin) |

Platform workspace modules: Overview, Institutions, Backup & recovery, Monitoring, Platform settings, Audit log.

## IBBUL institution workspace

Path-based tenant: **`/ibbul`** (legacy `/`, `/login`, `/admin` still work for IBBUL).

## Demo Login Accounts

These are seeded demo accounts from `prisma/seed.js`.

- Institution Administrator  
  - Email: `admin@demo.ibbul.edu`  
  - Password: `InstAdmin123!`  
  - Workspace: `/ibbul/admin` or `/admin` — faculties, institution branding  
  - Does **not** access `/platform` or backup & recovery (platform-only)

- HOD (Department governance)  
  - Email: `hod@demo.ibbul.edu`  
  - Password: `HodDemo123!`  
  - Workspace: `/department`

- Lecturer  
  - Email: `lecturer@demo.ibbul.edu`  
  - Password: `LecturerDemo123!`  
  - Workspace: `/lecturer`  
  - Also: **Contributors** (allow students) · **Student inbox** (approve suggestions)

- Student  
  - Email: `student@demo.ibbul.edu`  
  - Password: `StudentDemo123!`  
  - **Contribute** (only if a lecturer has allowed this account)

- Faculty Administrator (department governance)  
  - Email: `faculty@demo.ibbul.edu`  
  - Password: `FacultyDemo123!`  
  - Workspace: **`/faculty`** — departments, HODs, faculty branding, faculty-wide archive

## Identity & Settings (`/settings`)

All signed-in users can manage **personal identity** (profile photo, banner, bio, display name).

| Role | What they see in Settings |
|------|---------------------------|
| Student / Lecturer | **Personal only** — photo, banner, bio |
| HOD / Dept admin | Personal + **Department** (in department workspace Settings) |
| Faculty admin | Personal + **Faculty** branding (`/faculty` → Settings) |
| Institution admin | Personal + **Institution** only (`/settings` or `/admin`) |

Lecturers and students do **not** see department, faculty, or institution tabs.

Uploads: PNG, JPG, or WEBP · max 5 MB · drag-and-drop.

## How To Ensure Demo Accounts Exist

Run:

```bash
npm run db:seed
```

This creates/updates the demo users and baseline faculty/department/course data.

## Authentication lifecycle (SaaS)

### Forgot password
1. Sign in page → **Forgot password?**
2. Enter email → reset link sent (60 min, single use)
3. Open link → set new password → signed in

**Dev:** emails saved to `data/email-outbox/` when SMTP is not configured.

### Staff invitation (lecturer / HOD)
1. Department or Faculty admin adds user by email
2. System emails **activation link** + **8-character one-time password**
3. User opens link → enters OTP + permanent password → workspace access

### Direct account creation
1. Admin creates account without invite link flow
2. System emails **temporary password**
3. First sign-in → forced **Set permanent password** screen

### Email configuration (production)
Set in `.env`: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `APP_PUBLIC_URL`

---

## Login Flow (How The System Works)

1. User submits email/password on `/login`.
2. Frontend calls `POST /api/auth/login`.
3. API verifies password hash with bcrypt.
4. API returns JWT token + safe user profile.
5. Frontend stores auth session and redirects:
   - Faculty admin → `/faculty`
   - Lecturer role → `/lecturer`
   - HOD / Department admin → `/department`
   - Student → browse home (`/`); **Contribute** if allowed  
   - Super admin → `/admin` (institution branding in **Settings** or **Institution** tab in admin)

## Role Visibility in Current Build

- `STUDENT`
  - Browse, search, download materials.
  - Register with a department.
  - **Contribute** (suggest materials) only if a lecturer allowed them — not public until lecturer approves.

- `LECTURER`
  - Publish materials (trusted, live immediately).
  - Allow specific students under **Contributors**.
  - Review **Student inbox** → approve (publish under lecturer name) or decline.

- `HOD`, `DEPARTMENT_ADMIN`
  - **Department workspace** at `/department` — people, catalog, resources, analytics, notices.

- `FACULTY_ADMIN`, `SUPER_ADMIN`
  - **Faculty workspace** at `/faculty` — departments, HOD assignment, faculty-wide catalog & analytics.

**Plain-language guide for the team:** see `ULA_FEATURES_GUIDE.md`.

## Required Environment For Login/Auth

Check `.env` has:

- `JWT_SECRET` — institution/tenant user tokens (dev placeholder OK; production ≥ 64 chars)
- `PLATFORM_JWT_SECRET` — platform operator tokens (optional in dev; **required** separate secret in production)
- Generate production secrets: `npm run jwt:generate`
- `DATABASE_URL` (SQLite path or production DB)
- `CLIENT_ORIGIN` and `PORT` correctly set

## Security Note

These demo credentials are for development only.  
Before production:
- remove/rotate demo accounts,
- use strong secrets,
- enforce password policy and reset flow,
- add rate limiting and auth monitoring.
