# Group6
Sparshan 
Protsahan
Can
Pragunya
Manpreet

# TTCM Sign Gallery — Cloud + AI Prototype

A web app where you **upload a traffic-sign image** and **Azure AI Vision** tags
it, captions it, and reads any visible text (OCR). Uploaded images and their
analysis are stored in **Azure Blob Storage**, and results appear in a gallery.
The gallery is pre-seeded with **74 sample signs parsed from the Temporary Traffic
Control Manual (TTCM)**, each labelled with its official **TAC code** — so you can
compare the manual's code with what the AI sees.

> Course: INTP302 Emerging Trends in Software Development — Midterm Team Mini-Project
> (Cloud + AI Prototype). Based on idea #3, *Cloud Photo Gallery with AI Image Tags*.

---

## What it does (maps to the assignment)

| Requirement | How this project meets it |
|---|---|
| **Azure Deployment** | Next.js app hosted on **Azure App Service** |
| **Persistent Data** | Uploaded images + JSON analysis records in **Azure Blob Storage** |
| **AI Feature** | **Azure AI Vision** image analysis: tags, caption, OCR |
| **User Interaction** | Upload an image; see tags/caption/OCR; browse & search the gallery |
| **Config & Security** | Keys in App Settings / `.env.local`; all AI calls are server-side |
| **Documentation** | This README + [`AZURE_SETUP.md`](AZURE_SETUP.md) |
| **Responsible AI** | See the [Responsible AI Review](#responsible-ai-review) below |

---

## Architecture

```
Browser (upload image)
        │  multipart POST /api/upload
        ▼
Next.js API route (Azure App Service)  ── key stays server-side ──┐
        │                                                          │
        ├─► Azure Blob Storage   uploads/<id>.png   (the image)    │
        ├─► Azure AI Vision      analyze bytes → tags/caption/OCR ◄┘
        └─► Azure Blob Storage   records/<id>.json  (the result)
        ▼
Gallery (GET /api/signs) ── seeds from manifest + uploads from Blob ──► UI cards
```

- The **Next.js app** (frontend + API routes) lives at the repo root.
- **`parser/`** — a one-time Python tool that produced the 74 sample signs from
  the TTCM PDF (sample-data preparation; **not** part of the live app).

---

## Tech stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript**
- **Tailwind CSS v4** (+ a small plain-CSS layer for the gallery)
- **@azure/storage-blob** for Blob Storage
- **Azure AI Vision** Image Analysis 4.0 REST API
- **Python + PyMuPDF** for the one-time parser

---

## Responsible AI Review

- **Fairness** — Azure AI Vision is trained on general imagery, not Canadian
  traffic signs. It may tag a regulatory sign generically ("sign", "red") and can
  perform worse on stylised, damaged, low-contrast, or non-English signs. The
  manual's TAC code is the authoritative label; the AI tags are assistive only.
- **Reliability & Safety** — AI tags/captions are best-effort and sometimes wrong.
  Nothing safety-critical should rely on them. OCR can misread short codes. The
  app shows confidence scores so users can judge trust.
- **Privacy & Security** — Only sample sign images are used (no personal data).
  Keys are stored in Azure App Settings / `.env.local`, never in client code, and
  every AI call is made server-side. `.env.local` is git-ignored.
- **Inclusiveness** — Users may upload their own images; captions can double as
  draft alt-text to improve accessibility.
- **Transparency** — The UI clearly labels AI output ("Azure AI Vision") and shows
  confidence, so users know AI is involved and how sure it is.
- **Accountability** — A human reviews the AI tags; the manual's official code
  remains the source of truth. The AI never makes an automatic decision.

---

## Known limitations

- Azure AI Vision returns descriptive tags, not the manual's catalog code
  (a STOP sign isn't printed with "RA-1"). The code comes from the parsed manual.
- The **caption** feature is region-restricted; outside supported regions set
  `VISION_FEATURES=tags,read`.
- The parser targets the TTCM "Appendix E" table layout; other layouts need tuning.
- Blob listing loads each record JSON; fine for a class demo, not tuned for scale.

---

## Future extension (Unit 3 / capstone)

Add an AI **agent** that, given an uploaded sign, matches it to the manual's code,
explains the rule, and (with human approval) drafts a work-zone setup or a support
reply — using tool/API calls and safe access.
