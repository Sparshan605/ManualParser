import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { blobEnabled, uploadImage, saveRecord, type UploadRecord } from "@/lib/azure";
import { visionConfigured, analyzeImageBytes } from "@/lib/vision";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};
const MAX_BYTES = 6 * 1024 * 1024; // 6 MB

// POST a multipart form with field "file": stores the image in Blob Storage,
// analyzes it with Azure AI Vision, persists the record, and returns it.
export async function POST(request: Request) {
  try {
    if (!blobEnabled()) {
      return NextResponse.json(
        { error: "Azure Blob Storage is not configured. See AZURE_SETUP.md." },
        { status: 503 },
      );
    }
    if (!visionConfigured()) {
      return NextResponse.json(
        { error: "Azure AI Vision is not configured. See AZURE_SETUP.md." },
        { status: 503 },
      );
    }

    const form = await request.formData();
    const file = form.get("file");
    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "No file uploaded." }, { status: 400 });
    }
    const ext = ALLOWED[file.type];
    if (!ext) {
      return NextResponse.json(
        { error: `Unsupported type "${file.type}". Use PNG, JPG, WEBP or GIF.` },
        { status: 415 },
      );
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    if (buffer.byteLength > MAX_BYTES) {
      return NextResponse.json({ error: "File too large (max 6 MB)." }, { status: 413 });
    }

    const id = randomUUID();
    const { url } = await uploadImage(id, ext, buffer, file.type);

    // The AI feature: Azure AI Vision tags + captions + OCRs the image.
    const ai = await analyzeImageBytes(buffer);

    const record: UploadRecord = {
      id,
      source: "upload",
      filename: file.name || `${id}.${ext}`,
      image: url,
      ai,
      createdAt: new Date().toISOString(),
    };
    await saveRecord(record); // persist to Blob (history)

    return NextResponse.json(record, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
