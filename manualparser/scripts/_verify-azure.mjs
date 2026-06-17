// Temporary one-off: verifies the live Azure credentials in .env.local.
// Tests (1) AI Vision analyze on a seed image, (2) Blob connect + anonymous-access.
import { readFileSync } from "node:fs";
import { BlobServiceClient } from "@azure/storage-blob";

// --- load .env.local without a dependency ---
const env = {};
for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf-8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}

let ok = true;

// --- 1. Azure AI Vision ---
try {
  const endpoint = env.VISION_ENDPOINT.replace(/\/+$/, "");
  const features = env.VISION_FEATURES || "caption,tags,read";
  const bytes = readFileSync(new URL("../public/signs/images/RA-1.png", import.meta.url));
  const url = `${endpoint}/computervision/imageanalysis:analyze?api-version=2024-02-01&features=${encodeURIComponent(features)}`;
  let res = await fetch(url, {
    method: "POST",
    headers: { "Ocp-Apim-Subscription-Key": env.VISION_KEY, "Content-Type": "application/octet-stream" },
    body: new Uint8Array(bytes),
  });
  if (!res.ok && /caption/i.test(features)) {
    const retry = `${endpoint}/computervision/imageanalysis:analyze?api-version=2024-02-01&features=tags,read`;
    res = await fetch(retry, { method: "POST", headers: { "Ocp-Apim-Subscription-Key": env.VISION_KEY, "Content-Type": "application/octet-stream" }, body: new Uint8Array(bytes) });
    if (res.ok) console.log("⚠️  AI Vision: caption NOT supported in this region — falls back to tags,read. Set VISION_FEATURES=tags,read for a clean run.");
  }
  if (res.ok) {
    const j = await res.json();
    const tags = (j.tagsResult?.values ?? []).slice(0, 3).map(t => `${t.name} ${Math.round(t.confidence*100)}%`).join(", ");
    const cap = j.captionResult?.text;
    console.log("✅ AI Vision OK — tags:", tags || "(none)", cap ? `| caption: "${cap}"` : "| caption: (not returned)");
  } else {
    ok = false;
    console.log(`❌ AI Vision FAILED (${res.status}): ${(await res.text()).slice(0, 200)}`);
  }
} catch (e) { ok = false; console.log("❌ AI Vision error:", e.message); }

// --- 2. Blob Storage ---
try {
  if (!env.AZURE_STORAGE_CONNECTION_STRING) throw new Error("no connection string");
  const svc = BlobServiceClient.fromConnectionString(env.AZURE_STORAGE_CONNECTION_STRING);
  const c = svc.getContainerClient(env.AZURE_STORAGE_CONTAINER || "signs");
  await c.createIfNotExists({ access: "blob" }); // this line needs anonymous blob access enabled
  const props = await c.getProperties();
  console.log(`✅ Blob OK — container "${env.AZURE_STORAGE_CONTAINER || "signs"}" reachable, public access: ${props.blobPublicAccess || "none"}`);
  if (!props.blobPublicAccess) { ok = false; console.log("   ⚠️  public access is 'none' — gallery images won't load. Enable 'Allow Blob anonymous access' on the storage account."); }
} catch (e) {
  ok = false;
  console.log("❌ Blob error:", e.message);
  if (/PublicAccessNotPermitted/i.test(e.message)) console.log("   → Enable 'Allow Blob anonymous access' on the storage account (Portal → Configuration), then re-run.");
}

console.log(ok ? "\n🎉 All credentials verified — ready to deploy." : "\n⚠️  Fix the items above before deploying.");
process.exit(ok ? 0 : 1);
