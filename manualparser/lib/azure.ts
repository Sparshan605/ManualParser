// Azure Blob Storage data layer for the TTCM Sign Gallery.
//
// Persists two things:
//   uploads/<id>.<ext>   the image the user uploaded
//   records/<id>.json    its analysis record (AI tags, caption, OCR, etc.)
//
// All optional: if AZURE_STORAGE_CONNECTION_STRING is not set the app still runs
// locally (seeded gallery only) and upload/analyze return a friendly message.
import { BlobServiceClient, type ContainerClient } from "@azure/storage-blob";
import type { UploadRecord } from "./types";

export type { UploadRecord } from "./types";
// Read settings from environment variables (set outside the code, e.g. in .env)
const CONN = process.env.AZURE_STORAGE_CONNECTION_STRING;
const CONTAINER = process.env.AZURE_STORAGE_CONTAINER || "signs";
// We only create the Azure client once and reuse it (like a cached connection).
let _service: BlobServiceClient | null = null;
function service(): BlobServiceClient | null {
  if (!CONN) return null;
  if (!_service) _service = BlobServiceClient.fromConnectionString(CONN);
  return _service;
}
// Simple check: is Azure Storage actually set up?
export function blobEnabled(): boolean {
  return Boolean(CONN);
}
// Gets (or creates) the storage "container" — like a folder/bucket in the cloud.
async function container(): Promise<ContainerClient | null> {
  const svc = service();
  if (!svc) return null;
  const c = svc.getContainerClient(CONTAINER);
  await c.createIfNotExists({ access: "blob" }); // blobs are publicly readable
  return c;
}
// Helper: converts a stream of data (used when reading files from Azure) into a normal string.
async function streamToString(
  readable: NodeJS.ReadableStream | undefined,
): Promise<string> {
  if (!readable) return "";
  const chunks: Buffer[] = [];
  for await (const chunk of readable) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf-8");
}

// Upload an image buffer; returns its public Blob URL and blob name.
export async function uploadImage(
  id: string,
  ext: string,
  buffer: Buffer,
  contentType: string,
): Promise<{ name: string; url: string }> {
  const c = await container();
  if (!c) throw new Error("Blob Storage is not configured.");
  const name = `uploads/${id}.${ext}`;
  const blob = c.getBlockBlobClient(name);
  await blob.uploadData(buffer, { blobHTTPHeaders: { blobContentType: contentType } });
  return { name, url: blob.url };
}

// Saves the AI analysis result as a JSON file in Azure.
export async function saveRecord(record: UploadRecord): Promise<void> {
  const c = await container();
  if (!c) throw new Error("Blob Storage is not configured.");
  const blob = c.getBlockBlobClient(`records/${record.id}.json`);
  const body = JSON.stringify(record);
  await blob.upload(body, Buffer.byteLength(body), {
    blobHTTPHeaders: { blobContentType: "application/json" },
  });
}

// Reads back ALL saved analysis records, newest first.
export async function listRecords(): Promise<UploadRecord[]> {
  const c = await container();
  if (!c) return [];
  const records: UploadRecord[] = [];
   // Loop through every file inside the "records/" folder
  for await (const item of c.listBlobsFlat({ prefix: "records/" })) {
    try {
      const dl = await c.getBlockBlobClient(item.name).download();
      records.push(JSON.parse(await streamToString(dl.readableStreamBody)) as UploadRecord);
    } catch {
      /* skip unreadable record */
    }
  }
  // Sort so the newest upload appears first
  records.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  return records;
}
