// Uploads the parsed sign images + manifest to Azure Blob Storage.
//
//   1. Put AZURE_STORAGE_CONNECTION_STRING (and optionally AZURE_STORAGE_CONTAINER)
//      in .env.local
//   2. Make sure public/signs exists (created by the Python parser step).
//   3. Run:  npm run upload
//
// The container is created if missing. Images are made publicly readable so the
// gallery and Azure AI Vision can load them by URL.

import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { BlobServiceClient } from "@azure/storage-blob";

// Load .env.local manually (no extra dependency).
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
try {
  const env = await readFile(path.join(root, ".env.local"), "utf-8");
  for (const line of env.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
} catch {
  /* no .env.local; rely on real environment variables */
}

const CONN = process.env.AZURE_STORAGE_CONNECTION_STRING;
const CONTAINER = process.env.AZURE_STORAGE_CONTAINER || "signs";
if (!CONN) {
  console.error("AZURE_STORAGE_CONNECTION_STRING is not set. See AZURE_SETUP.md.");
  process.exit(1);
}

const CONTENT_TYPES = { ".png": "image/png", ".json": "application/json" };

async function main() {
  const svc = BlobServiceClient.fromConnectionString(CONN);
  const container = svc.getContainerClient(CONTAINER);
  await container.createIfNotExists({ access: "blob" }); // public read of blobs
  console.log(`Container "${CONTAINER}" ready.`);

  const signsDir = path.join(root, "public", "signs");
  const imagesDir = path.join(signsDir, "images");
  const images = await readdir(imagesDir);

  let uploaded = 0;
  for (const file of images) {
    const ext = path.extname(file).toLowerCase();
    const blob = container.getBlockBlobClient(`images/${file}`);
    await blob.uploadFile(path.join(imagesDir, file), {
      blobHTTPHeaders: { blobContentType: CONTENT_TYPES[ext] || "application/octet-stream" },
    });
    uploaded++;
    if (uploaded % 10 === 0) console.log(`  ${uploaded}/${images.length} images…`);
  }

  const manifest = container.getBlockBlobClient("tags.json");
  await manifest.uploadFile(path.join(signsDir, "tags.json"), {
    blobHTTPHeaders: { blobContentType: "application/json" },
  });

  const base = `${svc.url.replace(/\/+$/, "")}/${CONTAINER}`;
  console.log(`\nDone: ${uploaded} images + tags.json uploaded.`);
  console.log(`Set this in .env.local so the gallery serves from Blob:`);
  console.log(`  NEXT_PUBLIC_BLOB_BASE_URL=${base}`);
}

main().catch((err) => {
  console.error("Upload failed:", err.message);
  process.exit(1);
});
