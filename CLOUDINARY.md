# IBBUL ULA — Cloudinary Setup & Testing Guide

ULA is **Cloudinary-only** for files. No `uploads/` folder. No disk writes. Every PDF, assignment, profile photo, and student submission goes:

```
Browser → Express API → Multer (memory) → Cloudinary stream → Prisma metadata → CDN URL
```

---

## 1. Create a Cloudinary account (5 minutes)

1. Go to [https://cloudinary.com/users/register/free](https://cloudinary.com/users/register/free)
2. Sign up (free tier is enough to launch — 25 GB storage, 25 GB bandwidth/month)
3. Open the **Dashboard**
4. Copy from the top-right **Account Details** box:
   - **Cloud name**
   - **API Key**
   - **API Secret** (click “reveal”)

Keep API Secret private — never commit it to Git.

---

## 2. Add credentials to `.env`

In your project root (`IBBUL ULA/.env`):

```env
CLOUDINARY_CLOUD_NAME=your_cloud_name_here
CLOUDINARY_API_KEY=your_api_key_here
CLOUDINARY_API_SECRET=your_api_secret_here
CLOUDINARY_FOLDER=ula_files
```

| Variable | What it does |
|----------|----------------|
| `CLOUDINARY_CLOUD_NAME` | Your account identifier |
| `CLOUDINARY_API_KEY` | Upload API access |
| `CLOUDINARY_API_SECRET` | Signing & delete operations |
| `CLOUDINARY_FOLDER` | Root folder in Media Library (default: `ula_files`) |

**Folder layout in Cloudinary:**

```
ula_files/
  resources/              ← lecturer published materials
  assignments/
    attachments/          ← question papers
    submissions/          ← student uploads
  suggestions/            ← student suggestions (pending)
  identity/               ← profile photos & banners
```

Restart the dev server after saving `.env`:

```bash
npm run dev
```

You should see in the terminal:

```
[ibbul-ula] File storage: Cloudinary CDN (ula_files/)
```

If you see *“Cloudinary not configured — uploads will fail”*, check spelling and that `.env` is in the project root.

---

## 3. Verify configuration (30 seconds)

### Health check

Open or curl:

```
http://localhost:4000/api/health
```

Expected:

```json
{
  "ok": true,
  "service": "ibbul-ula",
  "storage": "cloudinary",
  "folder": "ula_files"
}
```

If `"storage": "unconfigured"` → env vars are missing or server wasn’t restarted.

### Legacy uploads path disabled

```
http://localhost:4000/uploads/anything
```

Expected: `410` with message that local storage is disabled.

---

## 4. End-to-end tests (do all four before go-live)

### TEST 1 — Lecturer publish (resource upload)

1. Sign in as lecturer (`lecturer@demo.ibbul.edu` if seeded)
2. **Publish material** → choose a PDF → publish
3. **Pass when:**
   - Toast: “Published to students”
   - Cloudinary Dashboard → Media Library → `ula_files/resources/` → new file
   - Browse page → material appears → **Download** saves file

### TEST 2 — Assignment question + student submit

1. Lecturer → **Assignments** → new assignment → attach question PDF → publish
2. Student → Browse → Assignments → **Download** question paper (saves to device)
3. Student → **Submit assignment** → upload file
4. **Pass when:**
   - `ula_files/assignments/attachments/` has question file
   - `ula_files/assignments/submissions/` has student file
   - Student card shows **My copy** → download works

### TEST 3 — Server restart (no disk dependency)

1. Upload a file (any of the above)
2. Stop server (`Ctrl+C`)
3. Start again: `npm run dev`
4. Open the same file URL or download again
5. **Pass when:** file still works (served from Cloudinary CDN, not local disk)

### TEST 4 — Delete resource

1. Lecturer → **My materials** → open material → **Remove**
2. **Pass when:**
   - Gone from catalogue
   - Cloudinary asset removed (or marked deleted in dashboard)

---

## 5. How uploads work in code (for your team)

| Layer | File |
|-------|------|
| Config | `server/config/cloudinary.js` |
| Stream upload + delete | `server/services/cloudinaryService.js` |
| App-wide upload API | `server/services/fileService.js` |
| CDN download proxy | `server/services/download.js` |

**Upload flow (mandatory pattern):**

- `multer.memoryStorage()` only — never `diskStorage`
- `uploadAppFile({ buffer, originalName, subfolder, maxBytes })`
- Returns `{ fileUrl, publicId, originalFileName, mimeType, sizeBytes }`
- Prisma stores `fileUrl` + `cloudinaryPublicId` on Resource, Assignment, Submission, etc.

**Optimization enabled:** `quality: auto`, `fetch_format: auto`, `resource_type: auto`

---

## 6. Production requirements

| Rule | Status |
|------|--------|
| Cloudinary env vars set | **Required** — server exits on startup if missing in `NODE_ENV=production` |
| Local `/uploads` serving | **Disabled** (410 Gone) |
| File size limits | Resources 40 MB · Assignments 25 MB · Identity 5 MB · General max 50 MB |
| Auth on uploads | All upload routes require authenticated users |

Add to production `.env` (same keys as dev):

```env
NODE_ENV=production
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
CLOUDINARY_FOLDER=ula_files
```

See also: [DEPLOYMENT.md](./DEPLOYMENT.md)

---

## 7. Troubleshooting

| Problem | Fix |
|---------|-----|
| `Cloudinary is required` on upload | Set all three `CLOUDINARY_*` vars, restart server |
| Upload slow first time | Normal — stream upload + CDN propagation; usually under 2s |
| Download fails | Check file exists in Cloudinary; old local URLs from before migration won’t work |
| `storage: unconfigured` in health | Typo in env or `.env` not loaded |
| CORS error | Set `CLIENT_ORIGIN` to your frontend URL |
| Image broken in UI | Cloudinary URLs should be full `https://res.cloudinary.com/...` — no `/uploads/` |

### Test upload from terminal (optional)

With a valid lecturer JWT and a test PDF:

```bash
curl -X POST http://localhost:4000/api/resources \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@test.pdf" \
  -F "title=Cloudinary test" \
  -F "courseId=COURSE_ID" \
  -F "kind=LECTURE_NOTES"
```

Response should include `fileUrl` starting with `https://res.cloudinary.com/`.

---

## 8. Migrating old local files

Files uploaded **before** this migration (stored under `/uploads/` on disk) will **not** download until re-uploaded to Cloudinary.

**Options:**

1. **Recommended for launch:** Lecturers re-publish critical materials (small catalogue)
2. **Bulk migration:** Upload old files from `uploads/` folder to Cloudinary via script (ask IT if you have many GB)

New uploads are always Cloudinary-only.

---

## 9. Checklist — “Cloudinary is live”

- [ ] Cloudinary account created
- [ ] `.env` has all four `CLOUDINARY_*` variables
- [ ] `/api/health` shows `"storage": "cloudinary"`
- [ ] TEST 1 publish — file in `ula_files/resources/`
- [ ] TEST 2 assignment — question + submission in Cloudinary
- [ ] TEST 3 restart — files still work
- [ ] TEST 4 delete — removed from catalogue
- [ ] Production `.env` on server (not in Git)

When all boxes are checked, ULA file infrastructure is **SaaS-grade**: instant CDN delivery, zero server disk dependency, survives crashes and scales to thousands of users.

---

*ULA 2.0 · Cloudinary-only · folder `ula_files` · stream upload · no local disk*
