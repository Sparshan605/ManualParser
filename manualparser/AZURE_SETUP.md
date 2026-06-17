# Azure Setup & Deployment — TTCM Sign Gallery

Step-by-step guide to deploy this Next.js app to **Azure App Service** with
**Azure Blob Storage** (persistent data) and **Azure AI Vision** (the AI feature).

> **Group 6** — Sparshan, Protsahan, Can, Pragunya, Manpreet
> Course: INTP302 — Midterm Cloud + AI Prototype.

You will create **three** Azure resources, wire them together with environment
variables, deploy the app, and verify the public URL from another computer
(the rubric checks live deployment).

---

## At a glance

```
1. Azure AI Vision resource   → gives VISION_ENDPOINT + VISION_KEY
2. Storage account + container → gives AZURE_STORAGE_CONNECTION_STRING
3. App Service (Linux/Node 20) → hosts the Next.js app
4. Deploy from VS Code        → §5
5. Paste the keys into App settings → §6
6. Set startup command + restart → §7
7. Test the public URL from another device → §8
```

Put all five resources in **one resource group** (e.g. `rg-ttcm-gallery`) and the
**same region** (recommended: **East US** — it supports AI Vision *caption* and
the Free App Service tier) so they are easy to find, share, and delete later.

---

## §1 Prerequisites

- An Azure subscription (Azure for Students is fine).
- [VS Code](https://code.visualstudio.com/) with the
  **Azure App Service** extension (publisher: Microsoft). Install from the
  Extensions panel, or get the **Azure Tools** bundle.
- Node.js 20+ locally (you have v24) to test before deploying.
- This repo cloned locally. Build once to confirm it's healthy:

  ```bash
  cd manualparser
  npm install
  npm run build      # must say "Compiled successfully"
  ```

**Who provides what (Group 6):** Can + Pragunya own the Azure resources, so the
key/endpoint/connection-string values in §6 come from them. Collect those before
deploying. Never paste real keys into git — they go only into `.env.local`
(git-ignored) and the App Service **App settings**.

---

## §2 Create the Azure AI Vision resource  → `VISION_ENDPOINT`, `VISION_KEY`

1. [Azure Portal](https://portal.azure.com) → **Create a resource** → search
   **"Computer Vision"** (a.k.a. *Azure AI Vision*) → **Create**.
2. Settings:
   - **Resource group:** `rg-ttcm-gallery` (create new).
   - **Region:** **East US** (needed for the *caption* feature — see note below).
   - **Name:** `ttcm-vision` (must be globally unique-ish).
   - **Pricing tier:** **Free F0** if available, otherwise **Standard S1**.
   - Tick the Responsible AI notice → **Review + create** → **Create**.
3. When deployed → **Go to resource** → left menu **Keys and Endpoint**:
   - Copy **Endpoint** → this is `VISION_ENDPOINT`
     (looks like `https://ttcm-vision.cognitiveservices.azure.com/`).
   - Copy **KEY 1** → this is `VISION_KEY`.

> **Caption is region-restricted.** Image captioning (Image Analysis 4.0) is only
> in select regions (East US, West US 2, etc.). The app auto-retries without
> caption if it isn't available, but for a clean demo deploy in **East US** and
> keep `VISION_FEATURES=caption,tags,read`. Outside a supported region, set
> `VISION_FEATURES=tags,read`.

---

## §3 Create the Storage account + container  → `AZURE_STORAGE_CONNECTION_STRING`

1. Portal → **Create a resource** → **Storage account** → **Create**.
2. Settings:
   - **Resource group:** `rg-ttcm-gallery`.
   - **Name:** lowercase, 3–24 chars, globally unique, e.g. `ttcmgallery6`.
   - **Region:** East US. **Redundancy:** LRS (cheapest).
   - **Review + create** → **Create** → **Go to resource**.
3. **Enable anonymous blob access** (the app serves images publicly):
   - Left menu → **Settings → Configuration** → set
     **"Allow Blob anonymous access"** to **Enabled** → **Save**.
   - *(Why: the app calls `createIfNotExists({ access: "blob" })`. Without this
     toggle, uploads fail with `PublicAccessNotPermitted`.)*
4. Get the connection string:
   - Left menu → **Security + networking → Access keys** → **Show** →
     copy **key1 → Connection string** → this is
     `AZURE_STORAGE_CONNECTION_STRING`.
5. The container named `signs` is **created automatically** by the app on first
   upload — you don't need to make it by hand. (`AZURE_STORAGE_CONTAINER`
   defaults to `signs`.)

> **Optional — pre-seed the 74 sample signs into Blob.** By default the gallery
> serves seed images from `/public/signs` (no extra config). If your instructor
> wants the seeds in Blob too, run `npm run upload` locally (it reads
> `.env.local`) and then set
> `NEXT_PUBLIC_BLOB_BASE_URL=https://<account>.blob.core.windows.net/signs`.
> ⚠️ `NEXT_PUBLIC_*` vars are baked in at **build time**, so if you set this you
> must deploy/rebuild **after** adding it (see §6 note).

---

## §4 Create the App Service (host)

You can create it in the portal first, **or** let VS Code create it during deploy
(§5). To do it in the portal:

1. Portal → **Create a resource** → **Web App** → **Create**.
2. Settings:
   - **Resource group:** `rg-ttcm-gallery`.
   - **Name:** `ttcm-gallery6` → your URL becomes
     `https://ttcm-gallery6.azurewebsites.net`.
   - **Publish:** Code. **Runtime stack:** **Node 20 LTS**.
   - **Operating System:** **Linux**.
   - **Region:** East US. **Pricing plan:** **Free F1**.
   - **Review + create** → **Create**.

---

## §5 Deploy the app

### Option A — VS Code Azure App Service extension (recommended)

1. Open the **`manualparser`** folder in VS Code (open this folder specifically —
   not the parent `ManualParser` — so the right `package.json` is the deploy root).
2. Click the **Azure** icon in the Activity Bar → **Sign in to Azure**.
3. Expand **App Services** under your subscription.
4. **Set "build during deploy" first** (so Azure runs `npm install && npm run
   build` on the server — you don't upload `node_modules`/`.next`):
   - Right-click your Web App → **Settings → Add New Setting…**
   - Name `SCM_DO_BUILD_DURING_DEPLOYMENT`, value `true`.
   - *(Or add it in the portal per §6 before deploying.)*
5. Right-click the Web App → **Deploy to Web App…**
   - Pick the **`manualparser`** folder as the source.
   - If you didn't create the app in §4, choose **+ Create new Web App… (Advanced)**
     → Linux → **Node 20 LTS** → **Free F1**.
   - Confirm the "Are you sure you want to deploy…" / overwrite prompt → **Deploy**.
6. Watch the **Output** panel. First deploy takes a few minutes (Azure builds).
   When it finishes, click **Browse Website**.

> The app will **load but uploads/AI won't work yet** until you add the keys in
> §6. That's expected on the first open.

### Option B — Azure CLI (alternative)

Requires the Azure CLI (`winget install Microsoft.AzureCLI`, then restart the
terminal).

```bash
az login
cd manualparser

# Build happens on the server (Oryx) because of the app setting below.
az webapp up \
  --name ttcm-gallery6 \
  --resource-group rg-ttcm-gallery \
  --runtime "NODE:20-lts" \
  --sku F1 \
  --location eastus

az webapp config appsettings set \
  --name ttcm-gallery6 --resource-group rg-ttcm-gallery \
  --settings SCM_DO_BUILD_DURING_DEPLOYMENT=true
# then re-run `az webapp up` so the build picks it up, and set the keys in §6.
```

---

## §6 Configure environment variables (App settings)

Portal → your **App Service** → left menu **Settings → Environment variables**
→ **App settings** tab → **+ Add** for each row → **Apply/Save**:

| Name | Value | Notes |
|---|---|---|
| `VISION_ENDPOINT` | from §2 | e.g. `https://ttcm-vision.cognitiveservices.azure.com/` |
| `VISION_KEY` | from §2 | KEY 1 — keep secret |
| `VISION_FEATURES` | `tags,read` | verified: this resource's region has no caption, so `tags,read` is correct |
| `AZURE_STORAGE_CONNECTION_STRING` | from §3 | the whole `DefaultEndpoints…` string |
| `AZURE_STORAGE_CONTAINER` | `signs` | optional; this is the default |
| `SCM_DO_BUILD_DURING_DEPLOYMENT` | `true` | makes Azure build on deploy |
| `NEXT_PUBLIC_BLOB_BASE_URL` | *(optional)* | only if you pre-seeded Blob — see §3 |

> **Server vs build-time vars:** `VISION_*` and `AZURE_STORAGE_*` are read at
> **runtime**, so you can add them any time and just **Restart**. But
> `NEXT_PUBLIC_BLOB_BASE_URL` is inlined at **build time** — if you add or change
> it, you must **redeploy** (§5) so the build picks it up. The recommended order
> is: set all app settings **before** your first deploy.

Click **Apply** → confirm the restart prompt.

---

## §7 Startup command + restart

1. Portal → App Service → **Settings → Configuration → General settings**
   (older portals: **Configuration → General settings**).
2. **Startup Command:** `npm run start`
   - This runs `next start`, which listens on the port Azure provides via `PORT`.
3. **Save** → confirm restart. (Or **Overview → Restart** any time.)

---

## §8 Test the live deployment (rubric)

1. Open `https://<your-app>.azurewebsites.net` — the gallery loads with the 74
   seeded TTCM signs.
2. **Upload a traffic-sign image** → you should see AI **tags**, a **caption**,
   and any **OCR text**, and the image should appear as a new gallery card.
3. **Verify persistence:** in the portal, open the Storage account →
   **Containers → signs** → you should see `uploads/…` and `records/…` blobs.
4. **Open the URL from a different computer or your phone** (off your home
   network / different browser). The rubric checks that it's genuinely public,
   not just `localhost`. Free F1 has a cold start, so the first hit may take
   10–20 s.

---

## §9 Troubleshooting

| Symptom | Fix |
|---|---|
| Page loads but **upload says "Blob Storage is not configured"** | `AZURE_STORAGE_CONNECTION_STRING` missing/typo'd → §6, then Restart. |
| Upload fails with **`PublicAccessNotPermitted`** | Enable **Allow Blob anonymous access** on the storage account → §3 step 3. |
| **AI returns nothing / 401 / 403** | `VISION_KEY` or `VISION_ENDPOINT` wrong → re-copy from §2. Endpoint must end in `.cognitiveservices.azure.com/`. |
| **Caption never appears** | Vision resource not in a caption region → set `VISION_FEATURES=tags,read`, or recreate Vision in East US. |
| **Deploy "succeeds" but site shows default Azure page / 500** | `SCM_DO_BUILD_DURING_DEPLOYMENT` not set, or startup command missing → §5 step 4 + §7. Check **Log stream** / **Advanced Tools (Kudu) → Log files**. |
| **App Container didn't start / wrong port** | Confirm startup command is `npm run start` (not `npm run dev`) → §7. |
| Local build warns about **two lockfiles** | Keep only `manualparser/package-lock.json`; delete any `package-lock.json` in the parent `ManualParser/` folder. |
| **Free F1 keeps sleeping** mid-demo | Expected (no Always On on Free). Hit the URL ~30 s before presenting, or temporarily scale to Basic B1. |

**Useful logs:** App Service → **Monitoring → Log stream**, or
`https://<app>.scm.azurewebsites.net` (Kudu) → **Bash / Log files**.

---

## §10 Demo talking points (maps to the rubric)

- **Azure deployment:** show the live `*.azurewebsites.net` URL (open from a
  second device to prove it's public).
- **Persistent data:** upload a sign live, then show the new `uploads/` and
  `records/` blobs in the Storage container.
- **AI feature:** point to the tags / caption / OCR returned by **Azure AI
  Vision**, and the confidence scores.
- **Config & security:** keys live in **App settings** / `.env.local`, never in
  client code; every AI call is server-side (`lib/vision.ts`).
- **Architecture:** walk the diagram in `README.md` (Browser → Next.js API →
  Blob + Vision → Gallery).
- **Responsible AI:** reference the Responsible AI Review section of `README.md`.

---

## Cleanup (after grading)

Delete everything in one shot by removing the resource group:

```
Portal → Resource groups → rg-ttcm-gallery → Delete resource group
```

or `az group delete --name rg-ttcm-gallery --yes`.
